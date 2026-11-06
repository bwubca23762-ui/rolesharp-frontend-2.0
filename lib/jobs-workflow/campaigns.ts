import { withTransaction, type TransactionQuery } from "../db";
import { activeFeatureAccessInTransaction, type FeatureAccessKey } from "../feature-access";
import { jobsWorkflowConfig } from "./config";
import { requireCurrentLegalAcceptance } from "../legal";
import type { ApplicationSendPolicyInput, CampaignCreateInput, CampaignUpdateInput } from "./contracts";

type ProfileRow = { id: string; version: number };

function featureForMode(mode: "daily_matches" | "role_apply"): FeatureAccessKey {
  return mode === "daily_matches" ? "daily_matches" : "role_apply_prepare";
}

function assertFloors(mode: "daily_matches" | "role_apply", _authorization: "review_each" | "campaign_policy", fit: number, confidence: number) {
  const floors = mode === "daily_matches" ? [70, 60] : [75, 65];
  if (fit < floors[0] || confidence < floors[1]) throw new Error("score_floor_too_low");
}

async function ownedProfile(query: TransactionQuery, userId: string, id: string): Promise<ProfileRow> {
  const row = (await query<ProfileRow>(
    "select id,version from career_profile_versions where id=$1 and user_id=$2", [id, userId],
  ))[0];
  if (!row) throw new Error("profile_not_found");
  return row;
}

async function activeOwnedConnection(query: TransactionQuery, userId: string, id: string | null | undefined) {
  if (!id) throw new Error("active_mailbox_connection_required");
  const row = (await query<{ id: string }>(
    "select id from email_connections where id=$1 and user_id=$2 and status='active' for key share",
    [id, userId],
  ))[0];
  if (!row) throw new Error("active_mailbox_connection_required");
  return row.id;
}

export async function materializeCurrentAccountEmail(query: TransactionQuery, userId: string) {
  const user = (await query<{ email: string | null; email_verified_at: string | null }>(
    "select email,email_verified_at from users where id=$1 and deleting_at is null for update", [userId],
  ))[0];
  if (!user?.email || !user.email_verified_at) throw new Error("verified_account_email_required");
  const email = user.email.trim().toLocaleLowerCase("en");
  const current = (await query<{ id: string; version: number; normalized_email: string }>(
    "select id,version,normalized_email from account_email_versions where user_id=$1 and superseded_at is null for update",
    [userId],
  ))[0];
  if (current?.normalized_email === email) return current;
  if (current) await query("update account_email_versions set superseded_at=now() where id=$1", [current.id]);
  const version = Number((await query<{ version: number }>(
    "select coalesce(max(version),0)+1 version from account_email_versions where user_id=$1", [userId],
  ))[0]?.version ?? 1);
  return (await query<{ id: string; version: number; normalized_email: string }>(
    `insert into account_email_versions(user_id,version,normalized_email,verification_source,verified_at)
     values($1,$2,$3,'account',$4) returning id,version,normalized_email`,
    [userId, version, email, user.email_verified_at],
  ))[0];
}

export async function upsertApplicationSendPolicy(userId: string, input: ApplicationSendPolicyInput) {
  const adminCap = jobsWorkflowConfig().applicationEmailAdminDailyLimit;
  return withTransaction(async (query) => {
    const owner = (await query<{ id: string }>("select id from users where id=$1 and deleting_at is null for update", [userId]))[0];
    if (!owner) throw new Error("account_unavailable");
    const current = (await query<{ quota_timezone: string; timezone_generation: number }>(
      "select quota_timezone,timezone_generation from application_send_policies where user_id=$1 for update", [userId],
    ))[0];
    if (!current) {
      return (await query(
        `insert into application_send_policies(user_id,quota_timezone,timezone_generation,user_cap,admin_cap_snapshot)
         values($1,$2,1,$3,$4) returning *`, [userId, input.timezone, input.userLimit, adminCap],
      ))[0];
    }
    if (current.quota_timezone === input.timezone) {
      return (await query(
        `update application_send_policies set user_cap=$2,admin_cap_snapshot=$3,updated_at=now()
         where user_id=$1 returning *`, [userId, input.userLimit, adminCap],
      ))[0];
    }
    return (await query(
      `update application_send_policies set user_cap=$2,admin_cap_snapshot=$3,
         pending_quota_timezone=$4,pending_timezone_generation=timezone_generation+1,
         next_generation_activation_date=(now() at time zone quota_timezone)::date+1,updated_at=now()
       where user_id=$1 returning *`, [userId, input.userLimit, adminCap, input.timezone],
    ))[0];
  });
}

export async function getApplicationSendPolicy(userId: string) {
  return withTransaction(async (query) => (await query(
    `select user_id,quota_timezone,timezone_generation,user_cap,admin_cap_snapshot,effective_cap,
       pending_quota_timezone,pending_timezone_generation,next_generation_activation_date,updated_at
     from application_send_policies where user_id=$1`, [userId],
  ))[0] ?? null);
}

export async function createCampaign(userId: string, input: CampaignCreateInput) {
  assertFloors(input.mode, input.authorizationMode, input.fitScoreFloor, input.confidenceScoreFloor);
  if (input.mode === "role_apply" && input.authorizationMode !== "review_each") {
    throw new Error("daily_batch_approval_required");
  }
  return withTransaction(async (query) => {
    const owner = (await query<{ id: string }>("select id from users where id=$1 and deleting_at is null for update", [userId]))[0];
    if (!owner) throw new Error("account_unavailable");
    await requireCurrentLegalAcceptance(userId, query);
    const access = await activeFeatureAccessInTransaction(query, userId, featureForMode(input.mode));
    if (access.dailyCap !== null && input.dailyLimit > access.dailyCap) throw new Error("feature_access_daily_cap_exceeded");
    const profile = await ownedProfile(query, userId, input.profileVersionId);
    if (input.mode === "daily_matches") await materializeCurrentAccountEmail(query, userId);
    if (input.mode === "role_apply" && input.status === "active") {
      await activeOwnedConnection(query, userId, input.pinnedConnectionId);
    }
    const consentVersion = null;
    const consentExpiresAt = null;
    const pinned = input.mode === "role_apply" ? input.pinnedConnectionId ?? null : null;
    const row = (await query(
      `insert into job_campaigns(user_id,mode,authorization_mode,status,profile_version_id,
         profile_version,criteria_version,criteria,timezone,timezone_generation,daily_time,daily_limit,
         fit_score_floor,confidence_score_floor,pinned_connection_id,consent_version,consent_expires_at)
       values($1,$2,$3,$4,$5,$6,1,$7,$8,1,$9,$10,$11,$12,$13,$14,$15) returning *`,
      [userId, input.mode, input.authorizationMode, input.status, profile.id, profile.version,
        input.criteria, input.timezone, input.dailyTime, input.dailyLimit, input.fitScoreFloor,
        input.confidenceScoreFloor, pinned, consentVersion, consentExpiresAt],
    ))[0];
    return row;
  });
}

export async function listCampaigns(userId: string) {
  return withTransaction((query) => query(
    `select * from job_campaigns where user_id=$1 order by created_at desc`, [userId],
  ));
}

export async function getCampaign(userId: string, campaignId: string) {
  return withTransaction(async (query) => (await query(
    "select * from job_campaigns where id=$1 and user_id=$2", [campaignId, userId],
  ))[0] ?? null);
}

export async function updateCampaign(userId: string, campaignId: string, input: CampaignUpdateInput) {
  return withTransaction(async (query) => {
    const current = (await query<any>(
      "select * from job_campaigns where id=$1 and user_id=$2 for update", [campaignId, userId],
    ))[0];
    if (!current) return null;
    const activating = current.status === "active" || input.action === "resume";
    if (activating) {
      await requireCurrentLegalAcceptance(userId, query);
      const access = await activeFeatureAccessInTransaction(query, userId, featureForMode(current.mode));
      const dailyLimit = input.dailyLimit ?? Number(current.daily_limit);
      if (access.dailyCap !== null && dailyLimit > access.dailyCap) throw new Error("feature_access_daily_cap_exceeded");
    }
    if (current.mode === "role_apply" && current.authorization_mode !== "review_each") {
      throw new Error("daily_batch_approval_required");
    }
    if (current.mode === "role_apply" && input.dailyLimit !== undefined && input.dailyLimit > 5) {
      throw new Error("application_daily_limit_exceeded");
    }
    const profile = input.profileVersionId ? await ownedProfile(query, userId, input.profileVersionId) : {
      id: current.profile_version_id as string, version: Number(current.profile_version),
    };
    const fit = input.fitScoreFloor ?? Number(current.fit_score_floor);
    const confidence = input.confidenceScoreFloor ?? Number(current.confidence_score_floor);
    assertFloors(current.mode, current.authorization_mode, fit, confidence);
    let status = current.status as string;
    if (input.action === "pause" && status === "active") status = "paused";
    if (input.action === "resume" && ["paused", "needs_user"].includes(status)) status = "active";
    if (input.action === "cancel") status = "canceled";
    if (input.action && status === current.status) throw new Error("invalid_campaign_transition");
    const pinnedConnectionId = input.pinnedConnectionId !== undefined
      ? input.pinnedConnectionId : current.pinned_connection_id as string | null;
    if (current.mode === "role_apply" && status === "active") {
      await activeOwnedConnection(query, userId, pinnedConnectionId);
    }
    const materialChange = Object.keys(input).some((key) => key !== "action");
    const consentVersion = current.mode === "role_apply" ? null : current.consent_version;
    const consentExpiresAt = current.mode === "role_apply" ? null : current.consent_expires_at;
    const updated = (await query<any>(
      `update job_campaigns set status=$3,profile_version_id=$4,profile_version=$5,
         criteria=coalesce($6,criteria),criteria_version=criteria_version+case when $6 is null then 0 else 1 end,
         pending_timezone=case when $7::text is null then pending_timezone when $7::text=timezone then null else $7::text end,
         pending_timezone_generation=case when $7::text is null then pending_timezone_generation
           when $7::text=timezone then null else timezone_generation+1 end,
         next_timezone_activation_date=case when $7::text is null then next_timezone_activation_date
           when $7::text=timezone then null else (now() at time zone timezone)::date+1 end,
         daily_time=coalesce($8,daily_time),daily_limit=coalesce($9,daily_limit),
         fit_score_floor=$10,confidence_score_floor=$11,
         pinned_connection_id=case when $12 then $13 else pinned_connection_id end,
         consent_version=$14,consent_expires_at=$15,
         canceled_at=case when $3='canceled' then now() else null end,updated_at=now()
       where id=$1 and user_id=$2 returning *`,
      [campaignId, userId, status, profile.id, profile.version, input.criteria ?? null,
        input.timezone ?? null, input.dailyTime ?? null, input.dailyLimit ?? null, fit, confidence,
        input.pinnedConnectionId !== undefined, input.pinnedConnectionId ?? null, consentVersion, consentExpiresAt],
    ))[0];
    if (materialChange) {
      await query("update job_matches set status='stale' where campaign_id=$1 and user_id=$2 and status in ('eligible','excluded')", [campaignId, userId]);
      await query(
        `update application_mail_attempts a set status='canceled',retry_not_before=null,
           provider_call_started_at=null,terminal_at=now(),updated_at=now()
         where a.user_id=$1 and a.campaign_id=$2
           and a.status in ('queued','reserved','retryable','needs_user')`,
        [userId, campaignId],
      );
      await query(
        `update application_packages p set status='stale',updated_at=now()
         where p.user_id=$1 and p.status in ('preparing','review_required','ready')
           and exists(select 1 from job_matches m where m.campaign_id=$2 and m.user_id=$1
             and m.canonical_job_key=p.canonical_job_key and m.job_snapshot_id=p.job_snapshot_id)
           and not exists(select 1 from application_mail_attempts a where a.package_id=p.id
             and a.status in ('sending','provider_accepted','unknown','terminal_failed'))`,
        [userId, campaignId],
      );
      await query(
        `update package_approvals a set status='invalidated',invalidated_at=now()
         from application_packages p where a.package_id=p.id and a.user_id=$1
           and a.status='active' and p.status='stale'`, [userId],
      );
    }
    return updated;
  });
}

export function previewCampaign(input: CampaignCreateInput) {
  assertFloors(input.mode, input.authorizationMode, input.fitScoreFloor, input.confidenceScoreFloor);
  if (input.mode === "role_apply" && input.authorizationMode !== "review_each") {
    throw new Error("daily_batch_approval_required");
  }
  const adminCap = jobsWorkflowConfig().applicationEmailAdminDailyLimit;
  return {
    normalizedCriteria: input.criteria,
    effectiveDailyLimit: Math.min(input.dailyLimit, adminCap),
    scoreFloors: { fit: input.fitScoreFloor, confidence: input.confidenceScoreFloor },
    authorizationDurationHours: 24,
    emailApplicationsOnly: input.mode === "role_apply",
  };
}
