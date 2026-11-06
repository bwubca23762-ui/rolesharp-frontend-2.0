import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { activateSocialDailyMatchesBonus } from "@/lib/social-rewards";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "social-reward-bonus", 5);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many attempts right now. Please wait a moment." }, {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }
  const result = await activateSocialDailyMatchesBonus(user.id, user.emailVerified);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, dailyMatchesDaysGranted: result.daysGranted });
}
