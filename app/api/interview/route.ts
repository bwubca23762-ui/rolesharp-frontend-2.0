import { NextRequest, NextResponse } from "next/server";
import { getUserResume, q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { getDevUserResume, updateDevResume } from "@/lib/local-dev-store";
import { z } from "zod";
import { ResumeContent } from "@/lib/types";
import { buildEvidenceInterview } from "@/lib/evidence-content";
import { buildStarGuidance } from "@/lib/interview-star";
import { spendActionCredit, refundActionCredit, userCredits } from "@/lib/credits";
import {
  createSession,
  FREE_SESSIONS_PER_MONTH,
  questionCountFor,
  questionsFor,
  sessionsUsedThisMonth,
  tierFor,
} from "@/lib/interview-session";

export const runtime = "nodejs";

const Body = z.object({
  resumeId: z.string().uuid(),
  // Credit bridge: a free user can spend 1 credit for a full premium session
  // (the follow-event / referral credits' main sink).
  useCredit: z.boolean().optional(),
});

// Interview prep, two tiers (VOICE-INTERVIEW-PLAN §0b):
// - Premium: the full evidence question set + STAR scaffolds (as before), plus
//   an interactive practice session.
// - Free: ONE practice session per rolling month over the first 5 questions,
//   with deterministic readouts. The old unconditional premium gate is gone —
//   the 402 only fires when the free monthly session is already used
//   ({error:"limit_reached", upgrade:true}, the uniform contract shape).
// No model call is made on either tier in V-1; the readouts are deterministic
// (lib/interview-session.ts), which is what makes the free tier free.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "interview", 10);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid resume ID" }, { status: 400 });
  const { resumeId } = parsed.data;
  const r = await (env.localDevMode ? getDevUserResume(resumeId, user.id) : getUserResume(resumeId, user.id));
  if (!r) return NextResponse.json({ error: "resume not found" }, { status: 404 });
  const parsedContent = ResumeContent.safeParse(r.content);
  if (!parsedContent.success) return NextResponse.json({ error: "resume_invalid" }, { status: 422 });

  const unlocked = "premium_unlock" in r ? r.premium_unlock : (r as { premiumUnlock?: boolean }).premiumUnlock;
  let tier = tierFor(Boolean(user.premium) || Boolean(unlocked));

  let used = 0;
  let creditEventId: number | null = null;
  if (tier === "free" && parsed.data.useCredit) {
    // The bridge: 1 credit buys this whole session at premium tier — full
    // question set, STAR guidance, and voice answer evaluation.
    creditEventId = await spendActionCredit(user.id, crypto.randomUUID(), "interview_premium_spend");
    if (creditEventId === null) {
      return NextResponse.json({
        error: "no_credits",
        message: "You have no credits to spend. Earn them by following RoleSharp's channels or inviting friends.",
        canUseCredit: false,
        socialRewardsAvailable: true,
      }, { status: 402 });
    }
    tier = "premium";
  }
  if (tier === "free") {
    used = await sessionsUsedThisMonth(user.id, tier);
    if (used >= FREE_SESSIONS_PER_MONTH) {
      return NextResponse.json({
        error: "limit_reached",
        upgrade: true,
        sessionsRemaining: 0,
        canUseCredit: (await userCredits(user.id)) > 0,
        socialRewardsAvailable: true,
      }, { status: 402 });
    }
  }

  const { questions, star } = questionsFor(parsedContent.data, tier);
  const interview = buildEvidenceInterview(parsedContent.data);
  let session: Awaited<ReturnType<typeof createSession>> | null = null;
  try {
    session = await createSession(user.id, resumeId, tier, questions.length);
    // Keep the existing resume snapshot in sync. If this persistence fails,
    // do not leave a paid credit charged for a session the client never got.
    const withStar = { ...interview, star: buildStarGuidance(parsedContent.data, interview.items.map((item) => item.q)) };
    if (env.localDevMode) await updateDevResume(resumeId, { interview: withStar });
    else await q("update resumes set interview=$1 where id=$2 and user_id_text=$3", [JSON.stringify(withStar), resumeId, user.id]);
  } catch (error) {
    if (creditEventId !== null) await refundActionCredit(user.id, creditEventId);
    throw error;
  }
  // The free monthly session is NOT burned here — question retrieval costs
  // nothing. Consumption happens on the first submitted answer
  // (answer/route.ts → consumeSessionOnce), so browsing questions and
  // closing the tab never spends the month's session.

  // Keep the saved full interview + STAR on the resume for premium (existing
  // behavior); the session carries its own tier-scoped question set.
  if (!session) throw new Error("interview_session_not_created");

  return NextResponse.json({
    interview: { ...interview, items: interview.items.slice(0, questionCountFor(tier, interview.items.length)), star: { entries: star } },
    // Remaining is the pre-answer count: the session burns on first answer,
    // so a fresh free session still shows the full allowance here.
    session: { id: session.sessionId, tier, questionCount: questions.length, creditSpent: creditEventId !== null, sessionsRemaining: tier === "free" ? FREE_SESSIONS_PER_MONTH - used : null },
  });
}
