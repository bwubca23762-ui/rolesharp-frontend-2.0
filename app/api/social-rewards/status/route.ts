import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rewardStatusFor, SOCIAL_PLATFORMS } from "@/lib/social-rewards";

export const runtime = "nodejs";

// GET /api/social-rewards/status — campaign status for the claim surface:
// whether it is running, the per-platform reward, and what this account
// already claimed. Unauthenticated callers get the campaign facts with
// nothing claimed.
export async function GET() {
  try {
    const user = await currentUser();
    const status = await rewardStatusFor(user?.id ?? null);
    return NextResponse.json({
      open: status.open,
      creditsPerPlatform: status.creditsPerPlatform,
      dailyMatchesDays: status.dailyMatchesDays,
      dailyMatchesEnabled: status.dailyMatchesEnabled,
      allClaimed: status.allClaimed,
      bonusClaimed: status.bonusClaimed,
      platforms: SOCIAL_PLATFORMS,
      claimed: status.claimed,
      reviewRequired: status.reviewRequired,
      pending: status.pending,
      rejected: status.rejected,
    });
  } catch {
    return NextResponse.json({
      open: false,
      creditsPerPlatform: 1,
      dailyMatchesDays: 0,
      dailyMatchesEnabled: false,
      allClaimed: false,
      bonusClaimed: false,
      platforms: SOCIAL_PLATFORMS,
      claimed: { x: false, linkedin: false, instagram: false },
    });
  }
}
