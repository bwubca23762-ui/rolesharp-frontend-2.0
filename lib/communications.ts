import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { q, withTransaction, type TransactionQuery } from "./db";
import { canonicalJson } from "./jobs-workflow/canonical-json";

export const COMMUNICATION_UNSUBSCRIBE_TTL_DAYS = 365;
export const COMMUNICATION_DEFAULT_BATCH = 25;

export type CommunicationCategory = "essential" | "product_updates" | "career_tips";
export type CommunicationAudience = "all_verified" | "free" | "premium" | "student";
export type CommunicationTransport = "disabled" | "local_sink" | "provider";

export type CommunicationCampaignContent = {
  communicationClass: "essential" | "marketing";
  preferenceCategory: CommunicationCategory;
  audience: CommunicationAudience;
  subject: string;
  preheader: string | null;
  textBody: string;
  htmlBody: string;
  replyTo: string | null;
};

export type CommunicationRuntimeControl = {
  transportMode: CommunicationTransport;
  globallyPaused: boolean;
  maxBatchSize: number;
  maxPerMinute: number;
  maxPerDay: number;
};

export type ClaimedCommunication = {
  recipientId: string;
  campaignVersionId: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string | null;
  preferenceCategory: CommunicationCategory;
  contentDigest: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function communicationEmailFingerprint(email: string) {
  return createHmac("sha256", unsubscribeFingerprintKey()).update(normalizeEmail(email)).digest("hex");
}

export function communicationContentDigest(content: CommunicationCampaignContent) {
  return createHash("sha256").update(canonicalJson({ schemaVersion: 1, ...content }), "utf8").digest("hex");
}

function tokenSignature(payload: string) {
  return createHmac("sha256", env.authSecret).update(`rolesharp-communications-unsubscribe-v1:${payload}`).digest("base64url");
}

function unsubscribeFingerprintKey() {
  return createHmac("sha256", env.authSecret).update("rolesharp-communications-fingerprint-v1").digest("hex");
}

export function createCommunicationUnsubscribeToken(input: {
  fingerprint: string;
  category: Exclude<CommunicationCategory, "essential">;
  expiresAt?: Date;
}) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    f: input.fingerprint,
    c: input.category,
    e: Math.floor((input.expiresAt ?? new Date(Date.now() + COMMUNICATION_UNSUBSCRIBE_TTL_DAYS * 86_400_000)).getTime() / 1000),
    n: randomBytes(12).toString("base64url"),
  })).toString("base64url");
  return `${payload}.${tokenSignature(payload)}`;
}

function verifyUnsubscribeToken(token: string) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = tokenSignature(payload);
  const providedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v?: number; f?: string; c?: string; e?: number };
    if (parsed.v !== 1 || !parsed.f?.match(/^[0-9a-f]{64}$/u) || !["product_updates", "career_tips"].includes(parsed.c ?? "")) return null;
    if (!Number.isSafeInteger(parsed.e) || Number(parsed.e) <= Math.floor(Date.now() / 1000)) return null;
    return { fingerprint: parsed.f, category: parsed.c as "product_updates" | "career_tips" };
  } catch {
    return null;
  }
}

export async function unsubscribeCommunication(token: string, query: TransactionQuery = q) {
  const verified = verifyUnsubscribeToken(token);
  if (!verified) return false;
  await query(
    `insert into communication_suppressions (email_fingerprint,scope,reason,source_reference)
     values ($1,$2,'unsubscribe','one_click') on conflict (email_fingerprint,scope) do nothing`,
    [verified.fingerprint, verified.category],
  );
  await query(
    `update communication_preferences p set
       product_updates_enabled=case when $2='product_updates' then false else product_updates_enabled end,
       career_tips_enabled=case when $2='career_tips' then false else career_tips_enabled end,
       source='unsubscribe',updated_at=now()
     from users u where p.user_id=u.id
       and encode(hmac(lower(u.email),$3,'sha256'),'hex')=$1`,
    [verified.fingerprint, verified.category, unsubscribeFingerprintKey()],
  );
  return true;
}

export async function getCommunicationPreferences(userId: string, query: TransactionQuery = q) {
  const row = (await query<{ product_updates_enabled: boolean; career_tips_enabled: boolean }>(
    `insert into communication_preferences (user_id) values ($1)
     on conflict (user_id) do update set user_id=excluded.user_id
     returning product_updates_enabled,career_tips_enabled`,
    [userId],
  ))[0];
  return { productUpdates: !!row?.product_updates_enabled, careerTips: !!row?.career_tips_enabled };
}

export async function updateCommunicationPreferences(
  userId: string,
  input: { productUpdates: boolean; careerTips: boolean },
  query: TransactionQuery = q,
) {
  const row = (await query<{ product_updates_enabled: boolean; career_tips_enabled: boolean }>(
    `insert into communication_preferences
       (user_id,product_updates_enabled,product_updates_changed_at,career_tips_enabled,career_tips_changed_at,source)
     values ($1,$2,now(),$3,now(),'settings')
     on conflict (user_id) do update set
       product_updates_enabled=excluded.product_updates_enabled,
       product_updates_changed_at=now(),career_tips_enabled=excluded.career_tips_enabled,
       career_tips_changed_at=now(),source='settings',updated_at=now()
     returning product_updates_enabled,career_tips_enabled`,
    [userId, input.productUpdates, input.careerTips],
  ))[0];
  return { productUpdates: !!row?.product_updates_enabled, careerTips: !!row?.career_tips_enabled };
}

export async function communicationRuntimeControl(query: TransactionQuery = q): Promise<CommunicationRuntimeControl> {
  const row = (await query<{ transport_mode: CommunicationTransport; globally_paused: boolean; max_batch_size: number; max_per_minute: number; max_per_day: number }>(
    "select transport_mode,globally_paused,max_batch_size,max_per_minute,max_per_day from communication_runtime_control where singleton=true",
  ))[0];
  if (!row) return { transportMode: "disabled", globallyPaused: true, maxBatchSize: 25, maxPerMinute: 30, maxPerDay: 1000 };
  return { transportMode: row.transport_mode, globallyPaused: row.globally_paused, maxBatchSize: row.max_batch_size, maxPerMinute: row.max_per_minute, maxPerDay: row.max_per_day };
}

function audienceSql() {
  return `u.email_verified_at is not null and u.deleting_at is null
    and (v.audience='all_verified'
      or (v.audience='free' and (u.premium_until is null or u.premium_until<=now()))
      or (v.audience='premium' and u.premium_until>now())
      or (v.audience='student' and u.premium_until>now() and u.premium_source='student'))`;
}

export async function estimateCommunicationAudience(campaignVersionId: string, query: TransactionQuery = q) {
  const row = (await query<{ eligible: string; admitted: string }>(
    `select
       count(*) filter (where ${audienceSql()}
         and (v.communication_class='essential'
           or (v.preference_category='product_updates' and coalesce(p.product_updates_enabled,false))
           or (v.preference_category='career_tips' and coalesce(p.career_tips_enabled,false)))
         and not exists (select 1 from communication_suppressions s
           where s.email_fingerprint=encode(hmac(lower(u.email),$2,'sha256'),'hex')
             and s.scope in ('all','marketing',v.preference_category)))::text eligible,
       (select count(*)::text from communication_recipients r where r.campaign_version_id=v.id) admitted
     from communication_campaign_versions v cross join users u
     left join communication_preferences p on p.user_id=u.id
     where v.id=$1 group by v.id`,
    [campaignVersionId, unsubscribeFingerprintKey()],
  ))[0];
  return { eligible: Number(row?.eligible ?? 0), admitted: Number(row?.admitted ?? 0) };
}

export async function admitCommunicationRecipients(campaignVersionId: string, query: TransactionQuery = q) {
  return query<{ id: string }>(
    `with version as (
       select * from communication_campaign_versions where id=$1 and status in ('scheduled','active','paused')
     ), eligible as (
       select v.id campaign_version_id,v.campaign_id,v.communication_class,v.preference_category,v.audience,
         v.content_digest,u.id user_id,lower(u.email) recipient_email,
         encode(hmac(lower(u.email),$2,'sha256'),'hex') fingerprint,
         p.product_updates_enabled,p.product_updates_changed_at,p.career_tips_enabled,p.career_tips_changed_at
       from version v join users u on ${audienceSql()}
       left join communication_preferences p on p.user_id=u.id
     )
     insert into communication_recipients
       (campaign_version_id,campaign_id,user_id,recipient_email,email_fingerprint,admission_key,consent_snapshot,content_digest_snapshot,status,terminal_at,purge_after)
     select e.campaign_version_id,e.campaign_id,e.user_id,e.recipient_email,e.fingerprint,
       encode(digest(e.campaign_version_id::text||':'||e.fingerprint,'sha256'),'hex'),
       jsonb_build_object('schemaVersion',1,'communicationClass',e.communication_class,'preferenceCategory',e.preference_category,
         'admittedAt',now(),'productUpdatesEnabled',coalesce(e.product_updates_enabled,false),
         'productUpdatesChangedAt',e.product_updates_changed_at,'careerTipsEnabled',coalesce(e.career_tips_enabled,false),
         'careerTipsChangedAt',e.career_tips_changed_at),
       e.content_digest,
       case when exists (select 1 from communication_suppressions s where s.email_fingerprint=e.fingerprint and s.scope in ('all','marketing',e.preference_category))
          or (e.communication_class='marketing' and ((e.preference_category='product_updates' and not coalesce(e.product_updates_enabled,false))
            or (e.preference_category='career_tips' and not coalesce(e.career_tips_enabled,false)))) then 'suppressed' else 'pending' end,
       case when exists (select 1 from communication_suppressions s where s.email_fingerprint=e.fingerprint and s.scope in ('all','marketing',e.preference_category))
          or (e.communication_class='marketing' and ((e.preference_category='product_updates' and not coalesce(e.product_updates_enabled,false))
            or (e.preference_category='career_tips' and not coalesce(e.career_tips_enabled,false)))) then now() end,
       case when exists (select 1 from communication_suppressions s where s.email_fingerprint=e.fingerprint and s.scope in ('all','marketing',e.preference_category))
          or (e.communication_class='marketing' and ((e.preference_category='product_updates' and not coalesce(e.product_updates_enabled,false))
            or (e.preference_category='career_tips' and not coalesce(e.career_tips_enabled,false)))) then now()+interval '30 days' end
     from eligible e on conflict (campaign_version_id,email_fingerprint) do nothing returning id`,
    [campaignVersionId, unsubscribeFingerprintKey()],
  );
}

export async function activateScheduledCommunicationVersions(query: TransactionQuery = q) {
  return query<{ id: string }>(
    `update communication_campaign_versions set status='active',activated_at=now(),enrollment_closed_at=now(),updated_at=now()
     where status='scheduled' and scheduled_at<=now() returning id`,
  );
}

export async function claimCommunicationBatch(owner: string, requestedLimit = COMMUNICATION_DEFAULT_BATCH): Promise<ClaimedCommunication[]> {
  if (!owner || owner.length > 120) throw new Error("invalid_communication_lease_owner");
  return withTransaction(async (query) => {
    const control = await communicationRuntimeControl(query);
    if (control.globallyPaused || control.transportMode === "disabled") return [];
    const limit = Math.max(1, Math.min(control.maxBatchSize, Math.trunc(requestedLimit)));
    const rows = await query<{
      recipient_id: string; campaign_version_id: string; recipient_email: string; subject: string; text_body: string;
      html_body: string; reply_to: string | null; preference_category: CommunicationCategory; content_digest: string;
    }>(
      `with candidates as (
         select r.id from communication_recipients r
         join communication_campaign_versions v on v.id=r.campaign_version_id
         join users u on u.id=r.user_id and u.deleting_at is null
         left join communication_preferences p on p.user_id=r.user_id
         where v.status='active' and r.recipient_email is not null
           and (r.status='pending' or (r.status='claimed' and r.lease_expires_at<=now()))
           and not exists (select 1 from communication_suppressions s
             where s.email_fingerprint=r.email_fingerprint and s.scope in ('all','marketing',v.preference_category))
           and (v.communication_class='essential'
             or (v.preference_category='product_updates' and coalesce(p.product_updates_enabled,false))
             or (v.preference_category='career_tips' and coalesce(p.career_tips_enabled,false)))
         order by r.created_at,r.id for update of r skip locked limit $2
       ), claimed as (
         update communication_recipients r set status='claimed',lease_owner=$1,
           lease_expires_at=now()+interval '90 seconds',updated_at=now()
         from candidates c where r.id=c.id returning r.*
       )
       select r.id recipient_id,r.campaign_version_id,r.recipient_email,v.subject,v.text_body,v.html_body,v.reply_to,
         v.preference_category,v.content_digest
       from claimed r join communication_campaign_versions v on v.id=r.campaign_version_id`,
      [owner, limit],
    );
    return rows.map((row) => ({
      recipientId: row.recipient_id, campaignVersionId: row.campaign_version_id, to: row.recipient_email,
      subject: row.subject, text: row.text_body, html: row.html_body, replyTo: row.reply_to,
      preferenceCategory: row.preference_category, contentDigest: row.content_digest,
    }));
  });
}

export async function releaseCommunicationClaim(recipientId: string, owner: string) {
  const rows = await q<{ id: string }>(
    `update communication_recipients set status='pending',lease_owner=null,lease_expires_at=null,updated_at=now()
     where id=$1 and status='claimed' and lease_owner=$2 returning id`,
    [recipientId, owner],
  );
  return Boolean(rows[0]);
}

export async function recoverExpiredCommunicationClaims(query: TransactionQuery) {
  const rows = await query<{ id: string }>(`with expired as (
      select r.id from communication_recipients r
      where r.status='claimed' and r.lease_expires_at<now() and r.provider_call_started_at is null
        and not exists(select 1 from communication_attempts a where a.recipient_id=r.id)
      order by r.lease_expires_at,r.id limit 100 for update skip locked
    ) update communication_recipients r set status='pending',lease_owner=null,lease_expires_at=null,updated_at=now()
      from expired e where r.id=e.id returning r.id`);
  return rows.length;
}

export async function reserveCommunicationThrottle(query?: TransactionQuery) {
  const reserve = async (transactionQuery: TransactionQuery) => {
    const control = await communicationRuntimeControl(transactionQuery);
    const minuteWindow = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const dayWindow = new Date();
    dayWindow.setUTCHours(0, 0, 0, 0);
    const rows = await transactionQuery<{ bucket_key: string; accepted_count: number }>(
      `insert into communication_throttle_buckets(bucket_key,window_started_at,accepted_count)
       values
         ('global:minute',$1::timestamptz,1),
         ('global:day',$2::timestamptz,1)
       on conflict(bucket_key) do update set
         window_started_at=excluded.window_started_at,
         accepted_count=case
           when communication_throttle_buckets.window_started_at<excluded.window_started_at then 1
           else communication_throttle_buckets.accepted_count+1
         end,
         updated_at=now()
       where communication_throttle_buckets.window_started_at<excluded.window_started_at
          or communication_throttle_buckets.accepted_count<case excluded.bucket_key
            when 'global:minute' then $3::integer
            else $4::integer
          end
       returning bucket_key,accepted_count`,
      [minuteWindow, dayWindow, control.maxPerMinute, control.maxPerDay],
    );
    if (rows.length !== 2) throw new Error("communication_throttle_exhausted");
    return true;
  };
  if (query) {
    try {
      return await reserve(query);
    } catch (error) {
      if (error instanceof Error && error.message === "communication_throttle_exhausted") return false;
      throw error;
    }
  }
  try {
    return await withTransaction(reserve);
  } catch (error) {
    if (error instanceof Error && error.message === "communication_throttle_exhausted") return false;
    throw error;
  }
}

export async function startCommunicationAttempt(recipientId: string, owner: string, transport: "local_sink" | "provider") {
  return withTransaction(async (query) => {
    const recipient = (await query<{ id: string; campaign_version_id: string }>(
      `select r.id,r.campaign_version_id from communication_recipients r
       join communication_campaign_versions v on v.id=r.campaign_version_id
       join users u on u.id=r.user_id and u.deleting_at is null
       left join communication_preferences p on p.user_id=r.user_id
       where r.id=$1 and r.status='claimed' and r.lease_owner=$2 and r.lease_expires_at>now()
         and v.status='active' and r.recipient_email is not null
         and not exists (select 1 from communication_suppressions s
           where s.email_fingerprint=r.email_fingerprint and s.scope in ('all','marketing',v.preference_category))
         and (v.communication_class='essential'
           or (v.preference_category='product_updates' and coalesce(p.product_updates_enabled,false))
           or (v.preference_category='career_tips' and coalesce(p.career_tips_enabled,false)))
       for update of r`,
      [recipientId, owner],
    ))[0];
    if (!recipient) return null;
    const attempt = (await query<{ id: string }>(
      `insert into communication_attempts (recipient_id,campaign_version_id,status,transport)
       values ($1,$2,'sending',$3) on conflict (recipient_id) do nothing returning id`,
      [recipient.id, recipient.campaign_version_id, transport],
    ))[0];
    if (!attempt) return null;
    await query(
      `update communication_recipients set status='sending',provider_call_started_at=now(),lease_owner=null,lease_expires_at=null,updated_at=now()
       where id=$1`,
      [recipient.id],
    );
    return attempt.id;
  });
}

export async function completeCommunicationAttempt(input: {
  recipientId: string;
  outcome: "provider_accepted" | "failed" | "unknown";
  receiptHash?: string | null;
  providerMessageIdHash?: string | null;
  providerCategory?: string | null;
}) {
  return withTransaction(async (query) => {
    const completedAt = new Date();
    const attempt = (await query<{ id: string }>(
      `update communication_attempts set status=$2,receipt_hash=$3,provider_message_id_hash=$4,provider_category=$5,finished_at=$6
       where recipient_id=$1 and status='sending' returning id`,
      [input.recipientId, input.outcome, input.receiptHash ?? null, input.providerMessageIdHash ?? null,
        input.providerCategory?.slice(0, 120) ?? null, completedAt],
    ))[0];
    if (!attempt) return false;
    await query(
      `update communication_recipients set status=$2,terminal_at=$3,purge_after=$3+interval '30 days',updated_at=$3
       where id=$1 and status='sending'`,
      [input.recipientId, input.outcome, completedAt],
    );
    return true;
  });
}

export async function cancelUserCommunications(userId: string, query: TransactionQuery = q) {
  const email = (await query<{ email: string }>("select email from users where id=$1", [userId]))[0]?.email;
  if (email) {
    await query(
      `insert into communication_suppressions (email_fingerprint,scope,reason,source_reference)
       values ($1,'all','account_deleted','account_deletion') on conflict (email_fingerprint,scope) do nothing`,
      [communicationEmailFingerprint(email)],
    );
  }
  await query(
    `update communication_recipients set status='canceled',terminal_at=now(),purge_after=now()+interval '30 days',
       lease_owner=null,lease_expires_at=null,updated_at=now()
     where user_id=$1 and status in ('pending','claimed')`,
    [userId],
  );
  await query(
    `update communication_attempts a set status='unknown',provider_category='account_deletion',finished_at=now()
     from communication_recipients r where r.id=a.recipient_id and r.user_id=$1 and a.status='sending'`,
    [userId],
  );
  await query(
    `update communication_recipients set status='unknown',terminal_at=now(),purge_after=now()+interval '30 days',updated_at=now()
     where user_id=$1 and status='sending'`,
    [userId],
  );
  await query("update communication_recipients set user_id=null,recipient_email=null where user_id=$1", [userId]);
  await query("delete from communication_preferences where user_id=$1", [userId]);
}
