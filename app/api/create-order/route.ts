import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasDb, q } from "@/lib/db";
import { env } from "@/lib/env";
import { LegalAcceptanceRequiredError, requireCurrentLegalAcceptance } from "@/lib/legal";
import { createRazorpayClient, getRazorpayPlan, newRazorpayReceipt, razorpayConfigured } from "@/lib/razorpay";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Creates a server-priced Razorpay order. The client may choose a plan, never
// an amount, currency, receipt, or user identity.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "create-razorpay-order", 5);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  if (!razorpayConfigured()) return NextResponse.json({ error: "payment_not_configured" }, { status: 503 });
  // Do not create a provider order unless we can persist the matching local
  // receipt. Otherwise a completed checkout could never be verified or grant
  // the purchased access.
  if (!hasDb()) return NextResponse.json({ error: "payment_unavailable" }, { status: 503 });

  try {
    await requireCurrentLegalAcceptance(user.id);
  } catch (error) {
    if (!(error instanceof LegalAcceptanceRequiredError)) throw error;
    return NextResponse.json({ error: error.code, pending: error.pending }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = getRazorpayPlan(body.plan);
  if (!plan || plan.amount < 100) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  const razorpay = createRazorpayClient();
  if (!razorpay) return NextResponse.json({ error: "payment_not_configured" }, { status: 503 });

  const receipt = newRazorpayReceipt();
  try {
    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: plan.currency,
      receipt,
      notes: { plan: plan.id, product: "rolesharp_premium" },
    });
    if (!order.id || Number(order.amount) !== plan.amount || order.currency !== plan.currency) {
      console.error("[pay:razorpay] provider returned an invalid order", { hasId: Boolean(order.id) });
      return NextResponse.json({ error: "provider_order_invalid" }, { status: 500 });
    }
    await q(
      `insert into razorpay_payments
         (razorpay_order_id, receipt, user_id_text, plan, days, amount_paise, currency, status)
       values ($1,$2,$3,$4,$5,$6,$7,'created')`,
      [order.id, receipt, user.id, plan.id, plan.days, plan.amount, plan.currency],
    );
    return NextResponse.json({
      order_id: order.id,
      amount: plan.amount,
      currency: plan.currency,
      key_id: env.razorpayKeyId,
      email: user.email,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode ?? error?.status ?? 0);
    console.error("[pay:razorpay] order creation failed", { statusCode: statusCode || undefined, code: error?.error?.code ?? error?.code });
    if (statusCode === 401) return NextResponse.json({ error: "provider_auth_failed" }, { status: 401 });
    return NextResponse.json({ error: "provider_unavailable" }, { status: 500 });
  }
}
