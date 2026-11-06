import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { grantPremium, getPlan } from "@/lib/entitlements";
import { now } from "@/lib/nowpay";
import { env } from "@/lib/env";
import { grantDevPremium } from "@/lib/local-dev-store";

export const runtime = "nodejs";

// DEV ONLY: simulate a confirmed crypto payment for the chosen plan.
// Production answers 404 — not 403 — so the route's existence is not
// confirmed to anyone probing the bundle (an audit finding: the reference in
// the client bundle advertised the endpoint; the reference is dev-flow only,
// and in production the server now pretends the path does not exist).
export async function POST(req: NextRequest) {
  if (env.production) return new NextResponse("Not Found", { status: 404 });
  if (!now.dev && !env.localDevMode) return NextResponse.json({ error: "disabled" }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const { plan: planId } = await req.json().catch(() => ({}));
  const plan = getPlan(planId);
  if (env.localDevMode) {
    await grantDevPremium(user.id, plan.days);
    return NextResponse.json({ premium: true, plan: plan.id, days: plan.days, localDev: true });
  }
  await grantPremium(user.id, plan.days);
  return NextResponse.json({ premium: true, plan: plan.id, days: plan.days });
}
