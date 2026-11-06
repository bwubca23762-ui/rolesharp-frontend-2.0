import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { cancelPendingInvoice, createRecoverableInvoice } from "@/lib/crypto-payments";
import { getPlan, isWinbackPlan, winbackEligible } from "@/lib/entitlements";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { LegalAcceptanceRequiredError, requireCurrentLegalAcceptance } from "@/lib/legal";
import { applyDiscount, redeemPromoCode, validatePromoCode, type PromoValidation } from "@/lib/promo-codes";

export const runtime = "nodejs";

// Create a crypto invoice for the chosen plan (monthly/yearly).
// Optional promo code: validated against plan applicability, discount applied
// to the invoice amount, and the redemption recorded atomically with creation.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "create-invoice", 5);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  try {
    await requireCurrentLegalAcceptance(user.id);
  } catch (error) {
    if (!(error instanceof LegalAcceptanceRequiredError)) throw error;
    return NextResponse.json({ error: error.code, pending: error.pending }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const planId = body.plan;
  const promoInput = typeof body.promoCode === "string" ? body.promoCode.trim() : "";
  const plan = getPlan(planId);
  // Win-back pricing is reserved for expired student-offer accounts.
  if (isWinbackPlan(plan.id) && !(await winbackEligible(user.id))) {
    return NextResponse.json({ error: "not_eligible" }, { status: 403 });
  }

  // Promo validation happens before invoice creation so a bad code never
  // creates an orphan order. Win-back plans are already discounted — no stack.
  let promo: PromoValidation | null = null;
  let priceCents = plan.cents;
  if (promoInput) {
    if (isWinbackPlan(plan.id)) {
      return NextResponse.json({ error: "promo_not_applicable" }, { status: 400 });
    }
    const check = await validatePromoCode(promoInput, plan.id);
    if ("error" in check) {
      return NextResponse.json({ error: "promo_invalid", reason: check.error }, { status: 400 });
    }
    promo = check;
    priceCents = applyDiscount(plan.cents, promo);
  }

  if (env.localDevMode) {
    return NextResponse.json({
      invoiceUrl: `${env.siteUrl}/build?dev_crypto=${plan.id}`,
      id: `dev_${plan.id}_${user.id}`,
      live: false,
      devMode: true,
      plan: plan.id,
      amount: Math.round(priceCents / 100),
      ...(promo ? { promoApplied: promo.code } : {}),
    });
  }

  const invoice = await createRecoverableInvoice(user.id, { ...plan, cents: priceCents }).catch(() => null);
  if (!invoice) {
    return NextResponse.json({ error: "payment_not_configured" }, { status: 503 });
  }

  // Redemption is recorded only after the invoice exists — a failed invoice
  // creation must not burn a redemption slot.
  if (promo) {
    const redeemed = await redeemPromoCode(promo.code, user.id, plan.cents - priceCents, invoice.providerInvoiceId ?? undefined).catch(() => false);
    if (!redeemed) {
      // Lost race or already-used-by-this-user code: tell the client honestly
      // rather than charging full price silently after showing a discount.
      // Cancel the just-created invoice too — otherwise it sits in the
      // recovery window as a discounted orphan a later retry could recover.
      if (invoice.providerInvoiceId) await cancelPendingInvoice(invoice.providerInvoiceId).catch(() => null);
      return NextResponse.json({ error: "promo_invalid", reason: "exhausted" }, { status: 400 });
    }
  }

  if (!invoice.invoiceUrl) {
    return NextResponse.json({ error: "checkout_pending", retryable: true }, { status: 503 });
  }
  return NextResponse.json({
    invoiceUrl: invoice.invoiceUrl,
    id: invoice.providerInvoiceId,
    live: invoice.live,
    devMode: !invoice.live,
    plan: plan.id,
    amount: Math.round(priceCents / 100),
    recovered: invoice.recovered,
    ...(promo ? { promoApplied: promo.code } : {}),
  });
}
