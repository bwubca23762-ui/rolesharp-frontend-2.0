import { q, withTransaction, type TransactionQuery } from "./db";
import { grantCredits } from "./credits";
import { createHash } from "crypto";
import { env } from "./env";
import { grantSocialDailyMatchesTrial } from "./feature-access";
import { jobsWorkflowConfig } from "./jobs-workflow/config";
import { sellerFromEnv } from "./invoice";
import { workflowFlagEnabled } from "./jobs-workflow/flags";
import type { StaffPrincipal } from "./staff-auth";

// Social follow rewards (migration 065): a logged-in, email-verified user
// claims a per-platform reward (+N credits) for following the official
// RoleSharp profile on X / LinkedIn / Instagram. No platform API can verify
// follows without enterprise OAuth — the anti-sybil work happens in the
// database instead: UNIQUE (user_id, platform) and UNIQUE (platform, handle)
// make one social identity claimable exactly once across every account, so
// so farming accounts buys nothing beyond the one reward the handle is worth.

export type RewardPlatform = "x" | "linkedin" | "instagram";

export const SOCIAL_PLATFORMS: readonly RewardPlatform[] = ["x", "linkedin", "instagram"];

export type SocialRewardConfig = {
  active: boolean;
  credits_per_platform: number;
  daily_matches_days: number;
  review_required: boolean;
};

export async function socialRewardConfig(): Promise<SocialRewardConfig> {
  const rows = await q<SocialRewardConfig>(
    "select active, credits_per_platform, premium_bonus_days as daily_matches_days,review_required from social_reward_config where id = true",
  );
  return rows[0] ?? { active: false, credits_per_platform: 1, daily_matches_days: 0, review_required: true };
}

// Runtime gate: env master switch AND the database feature flag AND the
// config row. Any one being off closes claiming.
export async function socialRewardsOpen(): Promise<boolean> {
  if (!env.socialRewardsEnabled) return false;
  const flag = await q<{ enabled: boolean }>(
    "select enabled from feature_flags where name='social_rewards'",
  );
  if (!flag[0]?.enabled) return false;
  const config = await socialRewardConfig();
  return config.active;
}

// Normalize to what the platform uses: no leading @, lowercase, trimmed.
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/u, "").toLowerCase();
}

const HANDLE_RE = /^[a-z0-9._-]{1,60}$/u;

export type ClaimResult =
  | { ok: true; creditsAwarded: number; creditsRemaining: number; reviewStatus: "pending" | "approved" }
  | { ok: false; error: string };

export async function claimPlatformReward(
  userId: string,
  emailVerified: boolean,
  platform: string,
  rawHandle: string,
  followed: boolean,
  ipHash: string | null,
): Promise<ClaimResult> {
  if (!SOCIAL_PLATFORMS.includes(platform as RewardPlatform)) {
    return { ok: false, error: "Unknown platform." };
  }
  const handle = normalizeHandle(rawHandle);
  if (!HANDLE_RE.test(handle)) {
    return { ok: false, error: "That does not look like a valid profile handle." };
  }
  if (!followed) {
    return { ok: false, error: "Confirm that you followed the channel before claiming its reward." };
  }
  if (!emailVerified) {
    return { ok: false, error: "Please verify your email address before claiming social rewards." };
  }
  if (!env.socialRewardsEnabled) {
    return { ok: false, error: "The social rewards event is not running right now." };
  }

  const result = await withTransaction(async (query) => {
    // Serialize a user's claims so the final platform cannot race another
    // claim and miss the once-only completion reward.
    const owner = (await query<{ email_verified_at: string | null }>(
      "select email_verified_at from users where id=$1 and deleting_at is null for update",
      [userId],
    ))[0];
    if (!owner) return { ok: false, error: "Your account is unavailable." } as const;
    if (!owner.email_verified_at) return { ok: false, error: "Please verify your email address before claiming social rewards." } as const;

    const flags = await query<{ enabled: boolean }>(
      "select enabled from feature_flags where name='social_rewards' for share",
    );
    const configs = await query<{ active: boolean; credits_per_platform: number; daily_matches_days: number; review_required: boolean }>(
      "select active,credits_per_platform,premium_bonus_days as daily_matches_days,review_required from social_reward_config where id=true for share",
    );
    const config = configs[0];
    if (!flags[0]?.enabled || !config?.active) {
      return { ok: false, error: "The social rewards event is not running right now." } as const;
    }
    const credits = Number(config.credits_per_platform);
    const dailyMatchesDays = Number(config.daily_matches_days);
    if (credits <= 0 && dailyMatchesDays <= 0) return { ok: false, error: "No reward is configured for this event right now." } as const;

    const inserted = await query<{ id: number }>(
      `insert into social_reward_claims (user_id,platform,handle,credits_awarded,ip_address,requested_credits,review_status)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing returning id`,
      [userId, platform, handle, config.review_required ? 0 : credits, ipHash, credits, config.review_required ? "pending" : "approved"],
    );
    if (!inserted[0]) {
      return { ok: false, error: "This reward has already been claimed — either by this account or with that handle." } as const;
    }

    if (!config.review_required) await grantCredits(userId, credits, "social_reward", { platform, handle, claimId: inserted[0].id }, null, query);
    const balance = (await query<{ credits: number }>("select credits from users where id=$1", [userId]))[0];

    // Completion nudge, after commit: the third claim means the Daily
    // Matches trial is ready but the timer only starts on explicit
    // activation, so tell the user it is waiting. Transactional in nature
    // (triggered by their own claim), still carries the postal footer.
    const claims = await query<{ n: number }>(
      "select count(distinct platform)::int as n from social_reward_claims where user_id=$1 and review_status='approved'",
      [userId],
    );
    let notification: { to: string; days: number } | null = null;
    if ((claims[0]?.n ?? 0) >= SOCIAL_PLATFORMS.length && Number(config.daily_matches_days) > 0) {
      const email = (await query<{ email: string }>(
        "select email from users where id=$1 and email_verified_at is not null",
        [userId],
      ))[0];
      if (email) notification = { to: email.email, days: Number(config.daily_matches_days) };
    }

    return {
      ok: true,
      creditsAwarded: config.review_required ? 0 : credits,
      creditsRemaining: Number(balance?.credits ?? 0),
      reviewStatus: config.review_required ? "pending" : "approved",
      notification,
    } as const;
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "social_reward_feature_access_unavailable") {
      return { ok: false, error: "Daily Matches access is restricted for this account. Please contact support before claiming the final reward." } as const;
    }
    throw error;
  });
  if (result.ok && result.notification) void sendSocialRewardCompletionEmail(result.notification.to, result.notification.days);
  return result;
}

// "Your trial is ready" — sent once the third channel is claimed. The trial
// deliberately waits for an explicit activation click, so this email is the
// pointer that closes the loop. Failures land in email_log via sendMail and
// must never fail the claim itself.
export async function sendSocialRewardCompletionEmail(to: string, days: number) {
  const seller = sellerFromEnv();
  const address = seller.addressLines.join(", ");
  const footer = address ? `${seller.name} · ${address}` : seller.name;
  const cta = `${env.siteUrl}/social-rewards`;
  const text = `You followed all three RoleSharp channels. Your ${days}-day Daily Matches trial is ready — activate it and matched jobs start landing in your inbox every morning: ${cta}`;
  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:32px 24px;border-top:6px solid #2563eb">
    <div style="font-size:14px;font-weight:700;letter-spacing:2px;color:#64748b;margin-bottom:18px">ROLE<span style="color:#2563eb">SHARP</span></div>
    <h2 style="margin:0 0 10px;font-weight:700">Your ${days}-day Daily Matches trial is ready</h2>
    <p>You followed all three RoleSharp channels — thank you. One click starts the trial:</p>
    <p><a href="${cta}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">Activate my ${days} free days</a></p>
    <p>Once active, matched jobs land in your inbox every morning for ${days} days. Your interview credits are already in your account.</p>
    <p style="color:#64748b;font-size:12px;margin-top:28px">${footer} · ${env.siteUrl}</p>
  </div>`;
  try {
    await import("./email").then((m) => m.sendMail({
      to,
      subject: `Activate your ${days}-day Daily Matches trial`,
      text,
      html,
      type: "social_reward",
    }));
  } catch (error) {
    console.error("[social-rewards] completion email failed:", error instanceof Error ? error.message : error);
  }
}

type DailyMatchesBonusGrant = { ok: true; daysGranted: number } | { ok: false; error: string };

async function grantDailyMatchesBonusInTransaction(
  query: TransactionQuery,
  userId: string,
  days: number,
): Promise<DailyMatchesBonusGrant> {
  const claims = await query<{ n: number }>(
    "select count(distinct platform)::int as n from social_reward_claims where user_id=$1 and review_status='approved'",
    [userId],
  );
  if ((claims[0]?.n ?? 0) < SOCIAL_PLATFORMS.length) {
    return { ok: false, error: "Claim each channel reward before activating the Daily Matches bonus." };
  }
  const eventFlag = await query<{ enabled: boolean }>(
    "select enabled from feature_flags where name='social_rewards' for share",
  );
  if (!eventFlag[0]?.enabled) {
    return { ok: false, error: "The social rewards event is not running right now." };
  }
  const existing = await query<{ user_id: string }>(
    "select user_id from social_reward_bonus where user_id=$1 for update",
    [userId],
  );
  if (existing[0]) return { ok: true, daysGranted: 0 };
  const ready = jobsWorkflowConfig().workflowsEnabled
    ? await query<{ enabled: boolean }>("select (enabled and workflow_rollout_allows(name,$1)) enabled from feature_flags where name='jobs_daily_matches' for share", [userId])
    : [];
  if (!ready[0]?.enabled) {
    return { ok: false, error: "Daily Matches is not active yet. Your trial will not start until the service is ready." };
  }
  const access = (await query<{ state: string }>(
    "select state from feature_access_grants where user_id=$1 and feature_key='daily_matches' for share",
    [userId],
  ))[0];
  if (access?.state === "suspended" || access?.state === "revoked") {
    return { ok: false, error: "Daily Matches access is restricted for this account. Please contact support." };
  }
  const locked = await query<{ user_id: string }>(
    `insert into social_reward_bonus (user_id,premium_days) values ($1,$2)
     on conflict (user_id) do nothing returning user_id`,
    [userId, days],
  );
  if (!locked[0]) return { ok: true, daysGranted: 0 };
  const expiry = (await query<{ trial_expires_at: Date | string }>(
    "select now() + make_interval(days => $1) as trial_expires_at",
    [days],
  ))[0];
  if (!expiry) throw new Error("social_reward_trial_expiry_failed");
  await grantSocialDailyMatchesTrial(query, userId, new Date(expiry.trial_expires_at));
  return { ok: true, daysGranted: days };
}

export async function activateSocialDailyMatchesBonus(
  userId: string,
  emailVerified: boolean,
): Promise<DailyMatchesBonusGrant> {
  if (!emailVerified) return { ok: false, error: "Please verify your email address before activating the bonus." };
  if (!jobsWorkflowConfig().workflowsEnabled) {
    return { ok: false, error: "Daily Matches is not active yet. Your trial will not start until the service is ready." };
  }
  return withTransaction(async (query) => {
    const owner = (await query<{ email_verified_at: string | null }>(
      "select email_verified_at from users where id=$1 and deleting_at is null for update",
      [userId],
    ))[0];
    if (!owner?.email_verified_at) return { ok: false, error: "Please verify your email address before activating the bonus." } as const;
    const config = (await query<{ active: boolean; daily_matches_days: number }>(
      "select active,premium_bonus_days as daily_matches_days from social_reward_config where id=true for share",
    ))[0];
    if (!env.socialRewardsEnabled || !config?.active || !config.daily_matches_days || config.daily_matches_days <= 0) {
      return { ok: false, error: "The Daily Matches bonus is not configured right now." } as const;
    }
    return grantDailyMatchesBonusInTransaction(query, userId, Number(config.daily_matches_days));
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "social_reward_feature_access_unavailable") {
      return { ok: false, error: "Daily Matches access is restricted for this account. Please contact support." };
    }
    throw error;
  });
}

export type RewardStatus = {
  open: boolean;
  creditsPerPlatform: number;
  dailyMatchesDays: number;
  dailyMatchesEnabled: boolean;
  allClaimed: boolean;
  bonusClaimed: boolean;
  claimed: Record<RewardPlatform, boolean>;
  reviewRequired: boolean;
  pending: Partial<Record<RewardPlatform, boolean>>;
  rejected: Partial<Record<RewardPlatform, string>>;
};

export async function rewardStatusFor(userId: string | null): Promise<RewardStatus> {
  const config = await socialRewardConfig();
  const open = await socialRewardsOpen();
  const dailyMatchesEnabled = await workflowFlagEnabled("jobs_daily_matches", userId ?? undefined);
  const claimed: Record<RewardPlatform, boolean> = { x: false, linkedin: false, instagram: false };
  const pending: RewardStatus["pending"] = {};
  const rejected: RewardStatus["rejected"] = {};
  let allClaimed = false;
  let bonusClaimed = false;
  if (userId) {
    const rows = await q<{ platform: RewardPlatform; review_status: string; review_note: string | null }>(
      "select platform,review_status,review_note from social_reward_claims where user_id=$1",
      [userId],
    );
    for (const row of rows) {
      if (row.review_status === "approved") claimed[row.platform] = true;
      else if (row.review_status === "pending") pending[row.platform] = true;
      else rejected[row.platform] = row.review_note || "Please contact support about this claim.";
    }
    allClaimed = SOCIAL_PLATFORMS.every((p) => claimed[p]);
    if (allClaimed) {
      const bonus = await q<{ user_id: string }>(
        "select user_id from social_reward_bonus where user_id=$1",
        [userId],
      );
      bonusClaimed = Boolean(bonus[0]);
    }
  }
  return {
    open,
    creditsPerPlatform: config.credits_per_platform,
    dailyMatchesDays: config.daily_matches_days,
    dailyMatchesEnabled,
    allClaimed,
    bonusClaimed,
    claimed,
    reviewRequired: config.review_required,
    pending,
    rejected,
  };
}

export async function reviewSocialRewardClaim(id: number, action: "approve" | "reject", note: string, actor: StaffPrincipal) {
  return withTransaction(async (query) => {
    const owner = (await query<{ user_id: string }>("select user_id from social_reward_claims where id=$1", [id]))[0];
    if (!owner) throw new Error("claim_not_found");
    const user = (await query<{ id: string; email_verified_at: string | null; is_banned: boolean }>("select id,email_verified_at,is_banned from users where id=$1 and deleting_at is null for update", [owner.user_id]))[0];
    if (!user) throw new Error("claim_not_found");
    const claim = (await query<{ review_status: string; requested_credits: number; platform: string; handle: string }>("select review_status,requested_credits,platform,handle from social_reward_claims where id=$1 for update", [id]))[0];
    if (!claim) throw new Error("claim_not_found");
    if (claim.review_status !== "pending") return { ok: true, reviewStatus: claim.review_status, alreadyReviewed: true, creditsAwarded: 0 };
    if (action === "approve" && (!user.email_verified_at || user.is_banned)) throw new Error("claim_account_ineligible");
    const status = action === "approve" ? "approved" : "rejected";
    const credits = action === "approve" ? Number(claim.requested_credits) : 0;
    if (!Number.isInteger(credits) || credits < 0 || credits > 100) throw new Error("invalid_claim_reward");
    if (credits > 0) await grantCredits(user.id, credits, "social_reward", { platform: claim.platform, handle: claim.handle, claimId: id }, null, query);
    await query("update social_reward_claims set review_status=$2,credits_awarded=$3,reviewed_at=now(),reviewed_by=$4,review_note=$5 where id=$1", [id, status, credits, actor.staffAccountId, note || null]);
    await query("insert into admin_actions(action,target_user_id,details,staff_account_id,authentication_method) values('social_reward_review',$1,$2,$3,$4)", [user.id, JSON.stringify({ claimId: id, status, creditsAwarded: credits }), actor.staffAccountId, actor.authenticationMethod]);
    return { ok: true, reviewStatus: status, creditsAwarded: credits };
  });
}

export const SOCIAL_LINKS: Record<RewardPlatform, { label: string; url: string }> = {
  x: { label: "Follow @rolesharpai on X", url: "https://x.com/rolesharpai" },
  linkedin: { label: "Follow RoleSharp on LinkedIn", url: "https://www.linkedin.com/company/rolesharpai" },
  instagram: { label: "Follow @rolesharp on Instagram", url: "https://instagram.com/rolesharp" },
};

// Hashed IP for the claim ledger: abuse forensics without storing raw IPs.
export function ipHashFromRequest(req: Request): string | null {
  const header = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "";
  const ip = header.split(",")[0]?.trim();
  if (!ip) return null;
  return createHash("sha256").update(`social-reward:${ip}`).digest("hex");
}
