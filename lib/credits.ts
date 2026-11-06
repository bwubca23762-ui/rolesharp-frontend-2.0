import { randomBytes } from "crypto";
import { q, withTransaction, type TransactionQuery } from "./db";
import { env } from "./env";
import { getDevCredits, getDevInviteCode, spendDevCredit } from "./local-dev-store";

const REFERRAL_CREDIT_REWARD = env.referralCreditReward;

function makeInviteCode() {
  return randomBytes(5).toString("base64url").toLowerCase();
}

async function ensureInviteCodeWithQuery(userId: string, query: TransactionQuery) {
  const row = (await query<{ invite_code: string | null }>("select invite_code from users where id=$1", [userId]))[0];
  if (row?.invite_code) return row.invite_code;
  for (let i = 0; i < 5; i++) {
    const code = makeInviteCode();
    const updated = await query<{ invite_code: string }>(
      `update users set invite_code=$1
       where id=$2 and invite_code is null
         and not exists (select 1 from users where invite_code=$1)
       returning invite_code`,
      [code, userId],
    );
    if (updated[0]) return updated[0].invite_code;
    const existing = (await query<{ invite_code: string | null }>(
      "select invite_code from users where id=$1",
      [userId],
    ))[0]?.invite_code;
    if (existing) return existing;
  }
  throw new Error("could_not_create_invite_code");
}

export async function ensureInviteCode(userId: string, query?: TransactionQuery) {
  if (env.localDevMode) return getDevInviteCode(userId);
  if (query) return ensureInviteCodeWithQuery(userId, query);
  return withTransaction((transactionQuery) => ensureInviteCodeWithQuery(userId, transactionQuery));
}

export async function userCredits(userId: string) {
  if (env.localDevMode) return getDevCredits(userId);
  const row = (await q<{ credits: number }>("select credits from users where id=$1", [userId]))[0];
  return Number(row?.credits ?? 0);
}

export async function grantCredits(
  userId: string,
  delta: number,
  kind: string,
  details: any = {},
  refUserId?: string | null,
  query: TransactionQuery = q,
) {
  const rows = await query<{ id: number }>(
    `with inserted as (
       insert into credit_events (user_id, kind, delta, details, ref_user_id)
       values ($1,$2,$3,$4,$5)
       on conflict do nothing
       returning id, user_id, delta
     ), credited as (
       update users
       set credits=greatest(0, users.credits + inserted.delta)
       from inserted
       where users.id=inserted.user_id
       returning inserted.id
     )
     select id from credited`,
    [userId, kind, delta, JSON.stringify(details), refUserId ?? null],
  );
  return rows[0]?.id ?? null;
}

export async function spendCredit(userId: string, resumeId: string) {
  if (env.localDevMode) return (await spendDevCredit(userId)) ? 1 : null;
  const event = await q<{ id: number }>(
    `with existing as (
       select id
       from credit_events
       where user_id=$1 and kind='premium_resume_spend' and resume_id=$2::uuid
     ), spent as (
       update users
       set credits=credits-1
       where id=$1 and credits > 0 and not exists (select 1 from existing)
       returning id
     ), inserted as (
       insert into credit_events (user_id, kind, delta, resume_id, details)
       select id, 'premium_resume_spend', -1, $2, $3
       from spent
       on conflict do nothing
       returning id
     )
     select id from existing
     union all
     select id from inserted
     limit 1`,
    [userId, resumeId, JSON.stringify({ resumeId })],
  );
  if (event[0]?.id) return event[0].id;

  // A concurrent retry can begin with a snapshot taken before the winning
  // spend commits, wait behind its user-row update, and then correctly skip
  // the debit while its original `existing` CTE remains empty. Re-read in a
  // fresh statement so that retry returns the durable idempotency receipt.
  const existing = await q<{ id: number }>(
    `select id from credit_events
     where user_id=$1 and kind='premium_resume_spend' and resume_id=$2::uuid`,
    [userId, resumeId],
  );
  return existing[0]?.id ?? null;
}

export async function refundGenerationCredit(userId: string, resumeId: string) {
  if (env.localDevMode) return null;
  const rows = await q<{ id: number }>(
    `with original_spend as (
       select user_id, resume_id
       from credit_events
       where user_id=$1 and resume_id=$2::uuid and kind='premium_resume_spend'
       limit 1
     ), inserted as (
       insert into credit_events (user_id, kind, delta, resume_id, details)
       select user_id, 'refund_failed_generation', 1, resume_id, $3
       from original_spend
       on conflict do nothing
       returning id, user_id
     ), credited as (
       update users
       set credits=users.credits + 1
       from inserted
       where users.id=inserted.user_id
       returning inserted.id
     )
     select id from credited`,
    [userId, resumeId, JSON.stringify({ reason: "generation_failed" })],
  );
  return rows[0]?.id ?? null;
}

export async function spendActionCredit(
  userId: string,
  actionId: string,
  kind: string,
  query: TransactionQuery = q,
) {
  if (env.localDevMode) return (await spendDevCredit(userId)) ? 1 : null;
  const event = await query<{ id: number }>(
    `with spent as (
       update users set credits=credits-1
       where id=$1 and credits > 0
       returning id
     )
     insert into credit_events (user_id, kind, delta, resume_id, details)
     select id, $3, -1, $2::uuid, $4 from spent
     returning id`,
    [userId, actionId, kind, JSON.stringify({ actionId })],
  );
  return event[0]?.id ?? null;
}

export async function refundActionCredit(userId: string, eventId: number) {
  if (env.localDevMode) return;
  await q(
    `with removed as (
       delete from credit_events where id=$2 and user_id=$1 and delta=-1 returning user_id
     )
     update users set credits=credits+1 from removed where users.id=removed.user_id`,
    [userId, eventId],
  );
}

// The referrer earns only when the referred user generates a first resume.
// Idempotency is enforced by the credit_events_referral_once database index;
// a rolling cap limits referral abuse.
export async function grantReferralCreditForActiveUser(newUserId: string) {
  const row = (await q<{ referred_by: string | null; email_verified_at: string | null }>(
    "select referred_by, email_verified_at from users where id=$1",
    [newUserId],
  ))[0];
  if (!row?.referred_by || !row.email_verified_at || row.referred_by === newUserId) return null;
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recent = await q<{ count: number }>(
    "select count(*)::int as count from credit_events where user_id=$1 and kind='referral_verified' and created_at > $2",
    [row.referred_by, since.toISOString()],
  );
  if ((recent[0]?.count ?? 0) >= env.referralMonthlyCap) return null;
  return grantCredits(row.referred_by, REFERRAL_CREDIT_REWARD, "referral_verified", { referredUserId: newUserId, trigger: "first_resume" }, newUserId);
}
