import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeHandle, SOCIAL_PLATFORMS, SOCIAL_LINKS } from "../lib/social-rewards";
import { clientIpFromRequest } from "../lib/anti-farming";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("social follow rewards: platforms, handles, and official URLs are strictly validated", () => {
  assert.deepEqual([...SOCIAL_PLATFORMS], ["x", "linkedin", "instagram"]);

  // Official profile URLs
  assert.equal(SOCIAL_LINKS.x.url, "https://x.com/rolesharpai");
  assert.equal(SOCIAL_LINKS.linkedin.url, "https://www.linkedin.com/company/rolesharpai");
  assert.equal(SOCIAL_LINKS.instagram.url, "https://instagram.com/rolesharp");

  // Handle normalization
  assert.equal(normalizeHandle("@RoleSharpAI"), "rolesharpai");
  assert.equal(normalizeHandle("  @johndoe_123  "), "johndoe_123");
  assert.equal(normalizeHandle("jane.doe-dev"), "jane.doe-dev");
});

test("anti-farming: client IP resolution protects against loopback and extracts first hop", () => {
  const req1 = new Request("https://rolesharp.com/api/auth/signup", {
    headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
  });
  assert.equal(clientIpFromRequest(req1), "203.0.113.195");

  const req2 = new Request("https://rolesharp.com/api/auth/signup");
  assert.equal(clientIpFromRequest(req2), "unknown");
});

test("anti-farming: disposable email patterns reject burner inbox domains", () => {
  const code = source("lib/anti-farming.ts");
  assert.match(code, /DISPOSABLE_PATTERNS/);
  assert.match(code, /mailinator/);
  assert.match(code, /guerrilla/);
  assert.match(code, /yopmail/);
  assert.match(code, /burner\(mail\|email\)/);
  assert.match(code, /10minute/);
  assert.match(code, /trashmail/);
  assert.match(code, /sharklasers/);
});

test("architecture contracts: signup rejects disposable emails and throttles IP velocity before insert", () => {
  const signupCode = source("app/api/auth/signup/route.ts");
  assert.match(signupCode, /isDisposableEmail\(cleanEmail\)/);
  assert.match(signupCode, /checkIpSignupVelocity\(ip\)/);
  assert.match(signupCode, /disposable_email_rejected/);
  assert.match(signupCode, /signup_rate_limited/);
});

test("architecture contracts: hard auto-ban terminates active sessions and blocks login", () => {
  const authCode = source("lib/auth.ts");
  assert.match(authCode, /if \(u\.is_banned\) return null;/);

  const loginCode = source("app/api/auth/login/route.ts");
  assert.match(loginCode, /if \(u\.is_banned\) \{/);
  assert.match(loginCode, /account_suspended/);
});

test("architecture contracts: live interview credit bridge unlocks full premium session with voice evaluation", () => {
  const interviewCode = source("app/api/interview/route.ts");
  assert.match(interviewCode, /spendActionCredit\(user\.id, crypto\.randomUUID\(\), "interview_premium_spend"\)/);
  assert.match(interviewCode, /refundActionCredit\(user\.id, creditEventId\)/);
  assert.match(interviewCode, /tier = "premium"/);

  const answerCode = source("app/api/interview/[id]/answer/route.ts");
  assert.match(answerCode, /evaluateVoiceAnswer\(audio, mimeType, question\)/);
  assert.match(answerCode, /if \(session\.tier !== "premium"\)/);
});

test("database contracts: migration 065 enforces anti-sybil unique constraints for social rewards", () => {
  const migration065 = source("db/migrations/065_social_rewards_and_student_controls.sql");
  assert.match(migration065, /constraint social_reward_claims_user_platform_unique unique \(user_id, platform\)/);
  assert.match(migration065, /constraint social_reward_claims_platform_handle_unique unique \(platform, handle\)/);
});

test("database contracts: migration 068 makes the completion bonus once-per-user and admin-settable", () => {
  const migration068 = source("db/migrations/068_social_reward_premium_bonus.sql");
  assert.match(migration068, /add column if not exists premium_bonus_days int not null default 15/);
  assert.match(migration068, /create table if not exists social_reward_bonus/);
  // The user_id primary key is the once-only lock for the premium grant.
  assert.match(migration068, /user_id uuid primary key/);
});

test("architecture contracts: social rewards are atomic and the completion bonus grants Daily Matches access", () => {
  const code = source("lib/social-rewards.ts");
  assert.match(code, /return withTransaction\(async \(query\)/);
  assert.match(code, /select email_verified_at from users where id=\$1 and deleting_at is null for update/);
  assert.match(code, /grantCredits\(userId, credits, "social_reward", \{ platform, handle, claimId: inserted\[0\]\.id \}, null, query\)/);
  assert.match(code, /insert into social_reward_bonus \(user_id,premium_days\)/);
  assert.match(code, /on conflict \(user_id\) do nothing returning user_id/);
  assert.match(code, /grantSocialDailyMatchesTrial\(query, userId, new Date\(expiry\.trial_expires_at\)\)/);
  assert.doesNotMatch(code, /update users set premium_until/);
  assert.match(code, /jobsWorkflowConfig\(\)\.workflowsEnabled/);
  assert.match(code, /count\(distinct platform\)::int as n/);

  const access = source("lib/feature-access.ts");
  assert.match(access, /daily_cap=5/);
  assert.match(access, /actor_kind,actor_staff_id,reason,grant_snapshot/);
  assert.match(access, /social_reward_trial/);
});

test("database contracts: migration 071 permits only the bounded social system grant without staff approver", () => {
  const migration071 = source("db/migrations/071_social_reward_daily_matches_access.sql");
  assert.match(migration071, /state = 'approved'/);
  assert.match(migration071, /approved_by is not null or reason = 'social_reward_trial'/);
  assert.match(migration071, /state = 'suspended'.*approved_by is not null or reason like 'social_reward_trial%'/s);
  assert.match(migration071, /state = 'expired'.*approved_by is not null/s);
  assert.match(migration071, /from social_reward_bonus b/);
  assert.match(migration071, /claimed_at \+ make_interval\(days => b\.premium_days\) > now\(\)/);
  assert.match(migration071, /where feature_access_grants\.state in \('requested','expired'\)/);
});

test("social reward completion sends users to campaign setup and accurately describes the trial", () => {
  const component = source("components/SocialRewardModal.tsx");
  assert.match(component, /Set up Daily Matches/);
  assert.match(component, /set up your profile and campaign in settings/i);
  assert.match(component, /I followed this channel/);
  assert.match(component, /activate-bonus/);
  assert.match(component, /not enabled yet/);
  assert.doesNotMatch(component, /Daily job-suggestion emails land in your inbox every morning/);
  const page = source("app/social-rewards/page.tsx");
  assert.match(page, /free Daily Matches trial/);
  assert.match(page, /self-attested, not independently verified/i);
  const settings = source("app/campaign-settings/campaign-settings-client.tsx");
  assert.match(settings, /fetch\("\/api\/feature-access"/);
  assert.match(settings, /dailyLimit: dailyMatchesLimit/);
  assert.match(settings, /Matches per day \(maximum \{dailyMatchesCap\}\)/);
});

test("social claims require an explicit attestation and persist its timestamp", () => {
  const route = source("app/api/social-rewards/claim/route.ts");
  const lib = source("lib/social-rewards.ts");
  const migration = source("db/migrations/072_social_follow_attestation.sql");
  assert.match(route, /followed: z\.literal\(true\)/);
  assert.match(route, /\.strict\(\)/);
  assert.match(lib, /if \(!followed\)/);
  assert.match(migration, /follow_attested_at timestamptz/);
  assert.match(migration, /not third-party verification/i);
});

test("Daily Matches activation is gated and does not grant general Premium", () => {
  const lib = source("lib/social-rewards.ts");
  const route = source("app/api/social-rewards/activate-bonus/route.ts");
  assert.match(route, /activateSocialDailyMatchesBonus/);
  assert.match(lib, /if \(!jobsWorkflowConfig\(\)\.workflowsEnabled\)/);
  assert.match(lib, /workflow_rollout_allows\(name,\$1\).*from feature_flags where name='jobs_daily_matches' for share/);
  assert.doesNotMatch(lib, /update users set premium_until/);
});

test("architecture contracts: lapsed daily alerts fall back to the weekly window", () => {
  const code = source("lib/job-alerts.ts");
  assert.match(code, /a\.frequency = 'daily' and u\.premium_until > now\(\)/);
  assert.match(code, /a\.frequency = 'daily' and \(u\.premium_until is null or u\.premium_until < now\(\)\)/);
});

test("database contracts: migration 067 enforces auto-ban and anti-farming audit ledger", () => {
  const migration067 = source("db/migrations/067_hard_autoban_and_anti_farming.sql");
  assert.match(migration067, /add column if not exists is_banned boolean not null default false/);
  assert.match(migration067, /add column if not exists signup_ip text/);
  assert.match(migration067, /create table if not exists banned_identifiers/);
});

test("architecture contracts: student offer farm guards ban on sight, not just reject", () => {
  const sendRoute = source("app/api/student/send/route.ts");
  // IP blocklist precheck before any token work.
  assert.match(sendRoute, /isIpBanned\(ip\)/);
  // Burner inbox on an academic-shaped domain = direct ban.
  assert.match(sendRoute, /isDisposableEmail\(raw\)/);
  assert.match(sendRoute, /banUser\(user\.id, "student_offer_disposable_email", ip\)/);
  // Multi-account IP farm = direct ban (the velocity check blocklists the IP).
  assert.match(sendRoute, /checkIpStudentVelocity\(ip\)/);
  assert.match(sendRoute, /banUser\(user\.id, "student_offer_ip_velocity_farm", ip\)/);
  // Tokens record the requesting IP so the velocity check has data.
  assert.match(sendRoute, /createStudentToken\(user\.id, claimKey, query, ip\)/);
});

test("database contracts: migration 069 records the requesting IP on student tokens", () => {
  const migration069 = source("db/migrations/069_student_farm_guard.sql");
  assert.match(migration069, /add column if not exists request_ip text/);
  assert.match(migration069, /create index if not exists student_verif_ip_created_idx/);
});

test("architecture contracts: banned users cannot activate student tokens", () => {
  const code = source("lib/student.ts");
  assert.match(code, /where id=\$1 and is_banned = false/);
  assert.match(code, /student account missing or banned/);
});

test("architecture contracts: student IP velocity threshold auto-blocklists farm IPs", () => {
  const code = source("lib/anti-farming.ts");
  assert.match(code, /STUDENT_ACCOUNTS_PER_IP_PER_DAY = 3/);
  assert.match(code, /student_offer_multi_account_ip_farm/);
  assert.match(code, /count\(distinct user_id\)::int as n/);
});
