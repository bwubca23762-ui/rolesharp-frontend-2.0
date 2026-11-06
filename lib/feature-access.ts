import { q, withTransaction, type TransactionQuery } from "./db";

export const FEATURE_ACCESS_KEYS = [
  "daily_matches",
  "role_apply_prepare",
  "role_apply_gmail",
  "role_apply_microsoft",
] as const;

export type FeatureAccessKey = (typeof FEATURE_ACCESS_KEYS)[number];
export type FeatureAccessState = "unavailable" | "requested" | "approved" | "suspended" | "revoked" | "expired";

export type FeatureAccessStatus = Readonly<{
  featureKey: FeatureAccessKey;
  state: FeatureAccessState;
  active: boolean;
  dailyCap: number | null;
  providerLimit: number | null;
  expiresAt: string | null;
}>;

type FeatureAccessRow = {
  feature_key: FeatureAccessKey;
  state: Exclude<FeatureAccessState, "unavailable">;
  daily_cap: number | null;
  provider_limit: number | null;
  expires_at: string | null;
};

function normalize(row: FeatureAccessRow | undefined, featureKey: FeatureAccessKey): FeatureAccessStatus {
  if (!row) {
    return { featureKey, state: "unavailable", active: false, dailyCap: null, providerLimit: null, expiresAt: null };
  }
  const expired = row.state === "approved" && !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
  const state = expired ? "expired" : row.state;
  return {
    featureKey,
    state,
    active: state === "approved",
    dailyCap: row.daily_cap,
    providerLimit: row.provider_limit,
    expiresAt: row.expires_at,
  };
}

export async function featureAccessStatus(userId: string, featureKey: FeatureAccessKey): Promise<FeatureAccessStatus> {
  const row = (await q<FeatureAccessRow>(
    `select feature_key,state,daily_cap,provider_limit,expires_at
     from feature_access_grants where user_id=$1 and feature_key=$2`,
    [userId, featureKey],
  ))[0];
  return normalize(row, featureKey);
}

export async function listFeatureAccess(userId: string): Promise<readonly FeatureAccessStatus[]> {
  const rows = await q<FeatureAccessRow>(
    `select feature_key,state,daily_cap,provider_limit,expires_at
     from feature_access_grants where user_id=$1 and feature_key=any($2::text[])`,
    [userId, FEATURE_ACCESS_KEYS],
  );
  const byKey = new Map(rows.map((row) => [row.feature_key, row]));
  return FEATURE_ACCESS_KEYS.map((featureKey) => normalize(byKey.get(featureKey), featureKey));
}

export async function hasActiveFeatureAccess(userId: string, featureKey: FeatureAccessKey): Promise<boolean> {
  const rows = await q<{ active: boolean }>(
    `select exists (
       select 1 from feature_access_grants
       where user_id=$1 and feature_key=$2 and state='approved'
         and (expires_at is null or expires_at>now())
     ) active`,
    [userId, featureKey],
  );
  return rows[0]?.active === true;
}

export async function activeFeatureAccessInTransaction(
  query: TransactionQuery,
  userId: string,
  featureKey: FeatureAccessKey,
): Promise<FeatureAccessStatus> {
  const row = (await query<FeatureAccessRow>(
    `select feature_key,state,daily_cap,provider_limit,expires_at
     from feature_access_grants
     where user_id=$1 and feature_key=$2
     for share`,
    [userId, featureKey],
  ))[0];
  const status = normalize(row, featureKey);
  if (!status.active) throw new FeatureAccessDeniedError(featureKey, status.state);
  return status;
}

export async function requireActiveFeatureAccess(userId: string, featureKey: FeatureAccessKey): Promise<FeatureAccessStatus> {
  const status = await featureAccessStatus(userId, featureKey);
  if (!status.active) throw new FeatureAccessDeniedError(featureKey, status.state);
  return status;
}

export type FeatureAccessManagementInput = Readonly<{
  state: "approved" | "suspended" | "revoked";
  reason: string;
  dailyCap?: number | null;
  providerLimit?: number | null;
  expiresAt?: Date | null;
}>;

export async function manageFeatureAccess(
  query: TransactionQuery,
  input: {
    userId: string;
    featureKey: FeatureAccessKey;
    actorKind: "staff" | "break_glass";
    actorStaffId: string | null;
    change: FeatureAccessManagementInput;
  },
): Promise<FeatureAccessStatus> {
  const current = (await query<FeatureAccessRow & { id: string; approved_by: string | null; reason: string | null }>(
    `select id,feature_key,state,daily_cap,provider_limit,expires_at,approved_by,reason
     from feature_access_grants where user_id=$1 and feature_key=$2 for update`,
    [input.userId, input.featureKey],
  ))[0];
  if (!current) throw new Error("feature_access_request_not_found");
  if (input.actorKind === "staff" && !input.actorStaffId) throw new Error("staff_actor_required");
  if (input.actorKind === "break_glass" && input.actorStaffId) throw new Error("invalid_break_glass_actor");
  if (input.actorKind === "break_glass" && input.change.state === "approved") {
    throw new Error("feature_access_named_approver_required");
  }
  const suppliedReason = input.change.reason.trim();
  if (!suppliedReason) throw new Error("feature_access_reason_required");
  // Keep the system-grant marker when staff suspend a social trial. The DB
  // check uses it to distinguish this legitimate null approver.
  const reason = input.change.state === "suspended"
    && current.approved_by === null
    && current.reason === "social_reward_trial"
    ? `social_reward_trial — ${suppliedReason}`
    : suppliedReason;
  if (input.change.state === "approved" && input.change.expiresAt && input.change.expiresAt <= new Date()) {
    throw new Error("feature_access_expiry_invalid");
  }
  const row = (await query<FeatureAccessRow & { id: string }>(
    `update feature_access_grants set state=$3,reason=$4,
       daily_cap=case when $3='approved' then $5 else daily_cap end,
       provider_limit=case when $3='approved' then $6 else provider_limit end,
       expires_at=case when $3='approved' then $7 else expires_at end,
       approved_at=case when $3='approved' then now() else approved_at end,
       approved_by=case when $3='approved' then $8 else approved_by end,
       suspended_at=case when $3='suspended' then now() else null end,
       revoked_at=case when $3='revoked' then now() else null end,
       updated_at=now()
     where id=$1 and user_id=$2
     returning id,feature_key,state,daily_cap,provider_limit,expires_at`,
    [current.id, input.userId, input.change.state, reason, input.change.dailyCap ?? null,
      input.change.providerLimit ?? null, input.change.expiresAt ?? null, input.actorStaffId],
  ))[0];
  if (!row) throw new Error("feature_access_update_failed");
  await query(
    `insert into feature_access_events
       (grant_id,user_id,feature_key,previous_state,new_state,actor_kind,actor_staff_id,reason,grant_snapshot)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [row.id, input.userId, input.featureKey, current.state, row.state, input.actorKind,
      input.actorStaffId, reason, JSON.stringify(row)],
  );
  return normalize(row, input.featureKey);
}

/** Grant the bounded, auditable Daily Matches access attached to the social reward.
 * The caller owns a transaction and a lock on the user's row, so this grant is
 * committed or rolled back together with the reward claim and premium period.
 */
export async function grantSocialDailyMatchesTrial(
  query: TransactionQuery,
  userId: string,
  expiresAt: Date,
): Promise<void> {
  const current = (await query<FeatureAccessRow & { id: string; approved_by: string | null }>(
    `select id,feature_key,state,daily_cap,provider_limit,expires_at,approved_by
     from feature_access_grants where user_id=$1 and feature_key='daily_matches' for update`,
    [userId],
  ))[0];

  // Preserve staff approval metadata and only extend it when the promo window
  // would otherwise expire later. Explicit suspensions and revocations remain
  // authoritative.
  if (current?.state === "approved" && current.approved_by) {
    if (!current.expires_at || new Date(current.expires_at).getTime() >= expiresAt.getTime()) return;
    const extended = (await query<FeatureAccessRow & { id: string }>(
      `update feature_access_grants set expires_at=$2,updated_at=now()
       where id=$1 returning id,feature_key,state,daily_cap,provider_limit,expires_at`,
      [current.id, expiresAt],
    ))[0];
    if (!extended) throw new Error("social_reward_feature_access_failed");
    await query(
      `insert into feature_access_events
         (grant_id,user_id,feature_key,previous_state,new_state,actor_kind,actor_staff_id,reason,grant_snapshot)
       values($1,$2,'daily_matches','approved','approved','system',null,'social_reward_trial',$3)`,
      [extended.id, userId, JSON.stringify(extended)],
    );
    return;
  }
  if (current?.state === "suspended" || current?.state === "revoked") {
    throw new Error("social_reward_feature_access_unavailable");
  }

  const reason = "social_reward_trial";
  const row = current
    ? (await query<FeatureAccessRow & { id: string }>(
      `update feature_access_grants set state='approved',daily_cap=5,provider_limit=null,
         reason=$2,risk_notes=null,approved_at=now(),approved_by=null,expires_at=$3,
         suspended_at=null,revoked_at=null,updated_at=now()
       where id=$1 returning id,feature_key,state,daily_cap,provider_limit,expires_at`,
      [current.id, reason, expiresAt],
    ))[0]
    : (await query<FeatureAccessRow & { id: string }>(
      `insert into feature_access_grants
         (user_id,feature_key,state,daily_cap,reason,approved_at,approved_by,expires_at)
       values($1,'daily_matches','approved',5,$2,now(),null,$3)
       returning id,feature_key,state,daily_cap,provider_limit,expires_at`,
      [userId, reason, expiresAt],
    ))[0];
  if (!row) throw new Error("social_reward_feature_access_failed");
  await query(
    `insert into feature_access_events
       (grant_id,user_id,feature_key,previous_state,new_state,actor_kind,actor_staff_id,reason,grant_snapshot)
     values($1,$2,'daily_matches',$3,'approved','system',null,$4,$5)`,
    [row.id, userId, current?.state ?? null, reason, JSON.stringify(row)],
  );
}

export async function requestFeatureAccess(userId: string, featureKey: FeatureAccessKey): Promise<FeatureAccessStatus> {
  return withTransaction(async (query) => {
    const current = (await query<FeatureAccessRow & { id: string }>(
      `select id,feature_key,state,daily_cap,provider_limit,expires_at
       from feature_access_grants where user_id=$1 and feature_key=$2 for update`,
      [userId, featureKey],
    ))[0];
    const currentStatus = normalize(current, featureKey);
    if (current && !["revoked", "expired"].includes(currentStatus.state)) return currentStatus;

    const row = current
      ? (await query<FeatureAccessRow & { id: string }>(
        `update feature_access_grants set state='requested',daily_cap=null,provider_limit=null,
           reason=null,risk_notes=null,requested_at=now(),approved_at=null,approved_by=null,
           expires_at=null,suspended_at=null,revoked_at=null,updated_at=now()
         where id=$1 and user_id=$2
         returning id,feature_key,state,daily_cap,provider_limit,expires_at`,
        [current.id, userId],
      ))[0]
      : (await query<FeatureAccessRow & { id: string }>(
        `insert into feature_access_grants (user_id,feature_key,state)
         values ($1,$2,'requested')
         returning id,feature_key,state,daily_cap,provider_limit,expires_at`,
        [userId, featureKey],
      ))[0];
    if (!row) throw new Error("feature_access_request_failed");
    await query(
      `insert into feature_access_events
         (grant_id,user_id,feature_key,previous_state,new_state,actor_kind,grant_snapshot)
       values ($1,$2,$3,$4,'requested','user',$5)`,
      [row.id, userId, featureKey, currentStatus.state === "unavailable" ? null : currentStatus.state, JSON.stringify(row)],
    );
    return normalize(row, featureKey);
  });
}

export class FeatureAccessDeniedError extends Error {
  readonly name = "FeatureAccessDeniedError";

  constructor(
    readonly featureKey: FeatureAccessKey,
    readonly accessState: FeatureAccessState,
  ) {
    super(`feature_access_${accessState}`);
  }
}
