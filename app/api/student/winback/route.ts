import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createRecoverableInvoice } from "@/lib/crypto-payments";
import { getPlan, winbackEligible } from "@/lib/entitlements";
import { env } from "@/lib/env";
import { LegalAcceptanceRequiredError, requireCurrentLegalAcceptance } from "@/lib/legal";

export const runtime = "nodejs";

// GET /api/student/winback?plan=monthly|yearly — the click-through target of
// the win-back email. Logs the user in via the normal session, verifies
// eligibility, creates the 20%-off invoice, and 302s straight to checkout.
export async function GET(req: NextRequest) {
  const planParam = req.nextUrl.searchParams.get("plan") === "yearly" ? "yearly_student20" : "monthly_student20";
  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(`${env.siteUrl}/login?next=${encodeURIComponent(`/api/student/winback?plan=${req.nextUrl.searchParams.get("plan") || "monthly"}`)}`);
  }
  if (!(await winbackEligible(user.id))) {
    return NextResponse.redirect(`${env.siteUrl}/pricing?student=winback-ineligible`);
  }
  try {
    await requireCurrentLegalAcceptance(user.id);
  } catch (error) {
    if (!(error instanceof LegalAcceptanceRequiredError)) throw error;
    return NextResponse.redirect(`${env.siteUrl}/pricing?legal=acceptance-required`);
  }

  const plan = getPlan(planParam);
  if (env.localDevMode) {
    return NextResponse.redirect(`${env.siteUrl}/build?dev_crypto=${plan.id}`);
  }
  const invoice = await createRecoverableInvoice(user.id, plan).catch(() => null);
  if (!invoice?.invoiceUrl) {
    return NextResponse.redirect(`${env.siteUrl}/pricing?student=checkout-unavailable`);
  }
  return NextResponse.redirect(invoice.invoiceUrl);
}
