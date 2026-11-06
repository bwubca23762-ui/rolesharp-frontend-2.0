import { NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { PLANS, FREE_MONTHLY_LIMIT, PREMIUM_MONTHLY_LIMIT } from "@/lib/entitlements";
import { getUsageLimits } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  if (!(await hasAdminPermission("payments.read"))) return NextResponse.json({ error: "admin_required" }, { status: 403 });

  let plans: any[] = [];
  try {
    plans = await q("select * from plans order by id");
  } catch {
    // plans table may not exist yet — that's fine
  }

  const envPricing = {
    freeLimit: FREE_MONTHLY_LIMIT,
    premiumLimit: PREMIUM_MONTHLY_LIMIT,
    monthlyCents: PLANS.monthly.cents,
    yearlyCents: PLANS.yearly.cents,
    daysMonthly: PLANS.monthly.days,
    daysYearly: PLANS.yearly.days,
  };
  // Effective limits include owner overrides saved in Settings; envPricing keeps
  // the env values so the page can show both when they differ.
  const limits = await getUsageLimits();

  return NextResponse.json({ plans, envPricing, limits });
}
