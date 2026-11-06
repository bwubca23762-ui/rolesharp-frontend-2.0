import { q } from "./db";
import type { SessionUser } from "./auth";
import { userCredits } from "./credits";
import { env } from "./env";
import { countDevResumesSince, getDevCredits } from "./local-dev-store";
import { getUsageLimits } from "./settings";
import { featuresFor, type TierFeatures } from "./tier-features";

// The tier→function map lives in lib/tier-features.ts (client-safe, so the
// admin matrix renders from the same source the server enforces); it is
// re-exported here because everything that already asks entitlements for
// truth should keep asking entitlements.
export { featuresFor };
export type { TierFeatures };

export const FREE_MONTHLY_LIMIT = env.freeMonthlyLimit;
export const PREMIUM_MONTHLY_LIMIT = env.premiumMonthlyLimit;
// Student offer: premium features at a reduced allowance — half the paid tier,
// so upgrading to paid Premium still means something.
export const STUDENT_MONTHLY_LIMIT = env.studentMonthlyLimit;
export const PREMIUM_CURRENCY = env.premiumCurrency;
const FREE_MODEL: "claude" | "gemini" = (process.env.GEMINI_KEYS ?? "").trim() ? "gemini" : "claude";

// Plans — priced low to undercut competitors ($25-29/mo elsewhere).
export const PLANS = {
  monthly: {
    id: "monthly",
    label: "Monthly",
    cents: env.priceMonthlyCents, // $12/mo by default
    days: env.daysMonthly,
  },
  yearly: {
    id: "yearly",
    label: "Yearly",
    cents: env.priceYearlyCents, // $79/yr by default (~$6.58/mo, save 45%)
    days: env.daysYearly,
  },
  // Student win-back: one-time 20% off first period. NOT purchasable from the
  // normal pricing UI — /api/pay/crypto/create gates these to expired student
  // accounts; the win-back email links through /api/student/winback.
  monthly_student20: {
    id: "monthly_student20",
    label: "Monthly (student win-back, 20% off)",
    cents: Math.round(env.priceMonthlyCents * 0.8), // $9.60 by default
    days: env.daysMonthly,
  },
  yearly_student20: {
    id: "yearly_student20",
    label: "Yearly (student win-back, 20% off)",
    cents: Math.round(env.priceYearlyCents * 0.8), // $63.20 by default
    days: env.daysYearly,
  },
} as const;
export type PlanId = keyof typeof PLANS;
export function getPlan(id?: string) {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "monthly"];
}
export function isWinbackPlan(id: string) {
  return id === "monthly_student20" || id === "yearly_student20";
}
// A user qualifies for the win-back discount only if their Premium came from
// the student offer and has already expired.
export async function winbackEligible(userId: string): Promise<boolean> {
  const u = (await q<{ premium_until: string | null; premium_source: string | null }>(
    "select premium_until, premium_source from users where id=$1",
    [userId],
  ))[0];
  return !!u && u.premium_source === "student" && !!u.premium_until && new Date(u.premium_until) <= new Date();
}

// legacy default still referenced in places
export const PREMIUM_DAYS = PLANS.monthly.days;

export type Entitlement = {
  premium: boolean;
  premiumUntil: string | null;
  limit: number;       // resumes allowed in the current period
  used: number;        // resumes used in the current period
  remaining: number;
  credits: number;
  canUseCredit: boolean;
  period: "month";
  canGenerate: boolean;
  model: "claude" | "gemini"; // internal routing only — not shown to users
  features: TierFeatures;
};

async function countSince(userId: string, sql: string): Promise<number> {
  return Number(
    (await q<{ n: string }>(
      `select count(*)::int as n from resumes where user_id_text=$1 and created_at >= ${sql}`,
      [userId],
    ))[0]?.n ?? 0,
  );
}

export async function getEntitlement(user: SessionUser | null): Promise<Entitlement> {
  // DB-backed owner overrides win over env; see lib/settings.ts.
  const limits = await getUsageLimits();
  if (!user) {
    return { premium: false, premiumUntil: null, limit: limits.freeMonthly, used: 0, remaining: 0, credits: 0, canUseCredit: false, period: "month", canGenerate: false, model: "gemini", features: featuresFor(null, false) };
  }
  // Must verify email before generating — prevents spam signups and unconfirmed addresses.
  if (!user.emailVerified) {
    return { premium: false, premiumUntil: null, limit: limits.freeMonthly, used: 0, remaining: 0, credits: 0, canUseCredit: false, period: "month", canGenerate: false, model: "gemini", features: featuresFor(user.premiumSource, false) };
  }
  const credits = await userCredits(user.id);
  if (env.localDevMode) {
    const devCredits = await getDevCredits(user.id);
    if (user.premium) {
      const used = await countDevResumesSince(user.id, Date.now() - 30 * 24 * 60 * 60 * 1000);
      const remaining = Math.max(0, PREMIUM_MONTHLY_LIMIT - used);
      return { premium: true, premiumUntil: user.premiumUntil, limit: PREMIUM_MONTHLY_LIMIT, used, remaining, credits: devCredits, canUseCredit: false, period: "month", canGenerate: remaining > 0, model: "claude", features: featuresFor(user.premiumSource, true) };
    }
    const used = await countDevResumesSince(user.id, Date.now() - 30 * 24 * 60 * 60 * 1000);
    const remaining = Math.max(0, FREE_MONTHLY_LIMIT - used);
    return { premium: false, premiumUntil: user.premiumUntil, limit: FREE_MONTHLY_LIMIT, used, remaining, credits: devCredits, canUseCredit: remaining <= 0 && devCredits > 0, period: "month", canGenerate: remaining > 0 || devCredits > 0, model: "gemini", features: featuresFor(user.premiumSource, false) };
  }
  if (user.premium) {
    // Premium: all premium features unlocked. Paid accounts get the full
    // allowance; student-offer accounts get the reduced one.
    const isStudent = user.premiumSource === "student";
    const cap = isStudent ? limits.studentMonthly : limits.premiumMonthly;
    const used = await countSince(user.id, "now() - interval '30 days'");
    const remaining = Math.max(0, cap - used);
    // Students can spend credits past their cap, paid accounts cannot. Without
    // this the student allowance is the only tier with no way out: students
    // already have every template, so credits earned from invites and reviews
    // would buy them nothing, and they are the group most able to invite
    // (one campus, one graduating class, all applying at once).
    return {
      premium: true, premiumUntil: user.premiumUntil,
      limit: cap, used, remaining, credits,
      canUseCredit: isStudent && remaining <= 0 && credits > 0,
      period: "month",
      canGenerate: remaining > 0 || (isStudent && credits > 0),
      model: "claude",
      features: featuresFor(user.premiumSource, true),
    };
  }
  // Free: configured rolling monthly limit.
  const used = await countSince(user.id, "now() - interval '30 days'");
  const remaining = Math.max(0, limits.freeMonthly - used);
  return {
    premium: false, premiumUntil: user.premiumUntil,
    limit: limits.freeMonthly, used, remaining, credits, canUseCredit: remaining <= 0 && credits > 0, period: "month",
    canGenerate: remaining > 0 || credits > 0, model: remaining > 0 ? FREE_MODEL : "claude",
    features: featuresFor(user.premiumSource, false),
  };
}

export async function grantPremium(userId: string, days = PREMIUM_DAYS, source: "paid" | "admin" | "student" = "paid") {
  // premium_source drives the allowance (student = STUDENT_MONTHLY_LIMIT,
  // everything else = PREMIUM_MONTHLY_LIMIT). A paid or admin grant upgrades a
  // student account to the full allowance; the student confirm route passes
  // source="student" explicitly.
  await q(
    `update users set
       premium_until = greatest(coalesce(premium_until, now()), now()) + ($2 || ' days')::interval,
       premium_source = $3
     where id=$1`,
    [userId, String(days), source],
  );
}

// Serialize quota admission per user inside one PostgreSQL statement. A
// reservation stops parallel requests from all observing the same remaining
// slot before any worker has persisted its resume.
//
// ponytail: the 10-minute reservation window below is a self-healing lease, not
// a guarantee. It has to expire on its own so a crashed worker cannot strand a
// user's slot forever, but that means a generation still running past 10
// minutes stops being counted while it runs. Generation is queued with
// attempts: 2 and exponential backoff (app/api/generate/route.ts), so during an
// LLM provider outage a slow first attempt plus a retry can cross that line and
// let the user start one extra generation. The overage is bounded at one slot
// per stuck generation and cannot compound: the resume row itself is counted
// the moment it persists. If provider latency ever makes this routine rather
// than exceptional, the fix is to heartbeat the reservation from the worker
// rather than to lengthen the window, which would only make crashes stickier.
export async function reserveGeneration(userId: string, resumeId: string, limit: number) {
  const rows = await q<{ id: string }>(
    `with locked as (
       select pg_advisory_xact_lock(hashtext($1))
     ), usage as (
       select
         (select count(*) from resumes where user_id_text=$1 and created_at >= now() - interval '30 days') +
         (select count(*) from generation_reservations r
          where r.user_id=$1
            and r.created_at >= now() - interval '10 minutes'
            and not exists (select 1 from resumes x where x.id=r.id)) as used
       from locked
     )
     insert into generation_reservations (id, user_id)
     select $2::uuid, $1 from usage where used < $3
     on conflict do nothing
     returning id`,
    [userId, resumeId, limit],
  );
  return !!rows[0];
}

export async function releaseGenerationReservation(userId: string, resumeId: string) {
  const rows = await q<{ id: string }>(
    "delete from generation_reservations where id=$2::uuid and user_id=$1 returning id",
    [userId, resumeId],
  );
  return Boolean(rows[0]);
}
