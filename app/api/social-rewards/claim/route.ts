import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { claimPlatformReward, ipHashFromRequest, SOCIAL_PLATFORMS, type RewardPlatform } from "@/lib/social-rewards";
import { z } from "zod";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "social-reward-claim", 10);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many attempts right now. Please wait a moment." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  const parsed = z.object({
    platform: z.string().min(1).max(20),
    handle: z.string().trim().min(1).max(60),
    followed: z.literal(true),
  }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirm that you followed the channel and enter your profile handle." }, { status: 400 });
  }
  const { platform, handle, followed } = parsed.data;
  if (!SOCIAL_PLATFORMS.includes(platform as RewardPlatform)) {
    return NextResponse.json({ error: "Unknown platform." }, { status: 400 });
  }

  const result = await claimPlatformReward(user.id, user.emailVerified, platform, handle, followed, ipHashFromRequest(req));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error.startsWith("Please verify") ? 403 : 400 });
  }
  return NextResponse.json({
    ok: true,
    creditsAwarded: result.creditsAwarded,
    reviewStatus: result.reviewStatus,
  });
}
