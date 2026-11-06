import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { q, withTransaction } from "../db";
import { sendMail } from "../email";
import { env } from "../env";
import { escapeHtml } from "../escape-html";
import { workflowFlagEnabled } from "./flags";
import { enqueueNotificationOutbox } from "./queues";

// Third copy of this literal in the tree until now; lib/env.ts owns the
// fallback and is what refuses to boot in production without AUTH_SECRET.
const UNSUBSCRIBE_SECRET = env.authSecret;


export function createDigestUnsubscribeToken(campaignId: string, expiresAt = new Date(Date.now() + 90 * 86400_000)): string {
  const payload = Buffer.from(JSON.stringify({ campaignId, exp: Math.floor(expiresAt.getTime() / 1000) }), "utf8").toString("base64url");
  const signature = createHmac("sha256", UNSUBSCRIBE_SECRET).update(`rolesharp-digest-unsubscribe-v1.${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyDigestUnsubscribeToken(token: string): { campaignId: string } | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", UNSUBSCRIBE_SECRET).update(`rolesharp-digest-unsubscribe-v1.${payload}`).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { campaignId?: unknown; exp?: unknown };
    if (typeof value.campaignId !== "string" || !/^[0-9a-f-]{36}$/iu.test(value.campaignId)
      || typeof value.exp !== "number" || value.exp < Math.floor(Date.now() / 1000)) return null;
    return { campaignId: value.campaignId };
  } catch { return null; }
}

export async function prepareDailyDigest(
  campaignId: string,
  enqueue: (payload: { outboxId: string; version: 1 }) => Promise<unknown> = enqueueNotificationOutbox,
): Promise<{ digestId: string | null; outboxId: string | null }> {
  if (!(await workflowFlagEnabled("jobs_daily_matches"))) return { digestId: null, outboxId: null };
  const prepared = await withTransaction(async (query) => {
    const campaign = (await query<any>(
      `select c.*,u.deleting_at from job_campaigns c join users u on u.id=c.user_id
       where c.id=$1 and c.mode='daily_matches' and c.status='active'
         and workflow_rollout_allows('jobs_daily_matches',c.user_id) for update of c,u`, [campaignId],
    ))[0];
    if (!campaign || campaign.deleting_at) return null;
    const localDate = (await query<{ local_date: string }>(
      "select (now() at time zone $1)::date::text local_date", [campaign.timezone],
    ))[0]?.local_date;
    if (!localDate) return null;
    const currentEmail = (await query<{ id: string; version: number }>(
      `select id,version from account_email_versions
       where user_id=$1 and superseded_at is null for update`, [campaign.user_id],
    ))[0];
    if (!currentEmail) return null;
    const matches = await query<any>(
      `select m.id,m.canonical_job_key,m.job_snapshot_id,m.fit_score,m.confidence_score,
         s.facts,s.source_url
       from job_matches m join job_snapshots s on s.id=m.job_snapshot_id
       where m.user_id=$1 and m.campaign_id=$2 and m.status='eligible'
         and not exists(select 1 from digest_inclusions i where i.user_id=m.user_id and i.canonical_job_key=m.canonical_job_key)
       order by m.fit_score desc,m.confidence_score desc,s.published_at desc nulls last,m.canonical_job_key
       limit 10`, [campaign.user_id, campaign.id],
    );
    if (!matches.length) return null;
    const snapshot = matches.map((match) => ({
      matchId: match.id, canonicalJobKey: match.canonical_job_key,
      fitScore: match.fit_score, confidenceScore: match.confidence_score,
    }));
    const digest = (await query<{ id: string }>(
      `insert into digest_runs(user_id,campaign_id,local_date,account_email_version_id,
         account_email_version,ordered_snapshot,status)
       values($1,$2,$3,$4,$5,$6,'prepared')
       on conflict(user_id,local_date) do nothing returning id`,
      [campaign.user_id, campaign.id, localDate, currentEmail.id, currentEmail.version, JSON.stringify(snapshot)],
    ))[0];
    if (!digest) return null;
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      await query(
        `insert into digest_inclusions(digest_run_id,user_id,canonical_job_key,ordinal,job_snapshot_id)
         values($1,$2,$3,$4,$5)`, [digest.id, campaign.user_id, match.canonical_job_key, index + 1, match.job_snapshot_id],
      );
    }
    const outbox = (await query<{ id: string }>(
      `insert into notification_outbox(user_id,aggregate_type,aggregate_id,account_email_version_id,payload_reference_ids)
       values($1,'digest_run',$2,$3,$4) returning id`,
      [campaign.user_id, digest.id, currentEmail.id, [digest.id]],
    ))[0];
    await query("update digest_runs set status='queued',updated_at=now() where id=$1", [digest.id]);
    return { digestId: digest.id, outboxId: outbox.id };
  });
  if (prepared) {
    await enqueue({ outboxId: prepared.outboxId, version: 1 }).catch((error) => {
      console.error("[daily-digest] immediate enqueue failed; scheduler will reconcile", {
        outboxId: prepared.outboxId,
        error: error instanceof Error ? error.name : "unknown_error",
      });
    });
  }
  return prepared ?? { digestId: null, outboxId: null };
}

export async function claimNotificationOutbox(outboxId: string, owner: string, leaseSeconds = 60): Promise<boolean> {
  if (!(await workflowFlagEnabled("jobs_daily_matches"))) return false;
  const rows = await q<{ id: string }>(
    `update notification_outbox o set status='claimed',lease_owner=$2,
       lease_expires_at=now()+make_interval(secs=>$3),updated_at=now()
     from users u where o.id=$1 and u.id=o.user_id and u.deleting_at is null
       and workflow_rollout_allows('jobs_daily_matches',o.user_id)
       and (o.status='pending' or (o.status='claimed' and o.lease_expires_at<=now()))
     returning o.id`, [outboxId, owner, Math.max(15, Math.min(leaseSeconds, 300))],
  );
  return Boolean(rows[0]);
}

export async function startNotificationBoundary(outboxId: string): Promise<boolean> {
  if (!(await workflowFlagEnabled("jobs_daily_matches"))) return false;
  return withTransaction(async (query) => {
    const valid = (await query<{ id: string }>(
      `select o.id from notification_outbox o
       join digest_runs d on d.id=o.aggregate_id and o.aggregate_type='digest_run'
       join job_campaigns c on c.id=d.campaign_id and c.user_id=o.user_id
       join account_email_versions e on e.id=o.account_email_version_id and e.user_id=o.user_id
       join users u on u.id=o.user_id
       join feature_flags f on f.name='jobs_daily_matches' and f.enabled=true
       where o.id=$1 and o.status='claimed' and o.lease_expires_at>now()
         and workflow_rollout_allows('jobs_daily_matches',o.user_id)
         and c.status='active' and e.superseded_at is null and u.deleting_at is null
       for update of o,c,e,u`, [outboxId],
    ))[0];
    if (!valid) return false;
    const started = await query<{ start_notification_outbox_invocation: number }>(
      "select start_notification_outbox_invocation($1)", [outboxId],
    );
    return Number(started[0]?.start_notification_outbox_invocation) === 1;
  });
}

async function digestMessage(outboxId: string) {
  const rows = await q<any>(
    `select e.normalized_email,d.id digest_id,d.campaign_id,m.fit_score,m.confidence_score,
       s.facts,s.source_url,i.ordinal
     from notification_outbox o
     join account_email_versions e on e.id=o.account_email_version_id
     join digest_runs d on d.id=o.aggregate_id
     join digest_inclusions i on i.digest_run_id=d.id
     join job_matches m on m.user_id=d.user_id and m.campaign_id=d.campaign_id
       and m.canonical_job_key=i.canonical_job_key and m.job_snapshot_id=i.job_snapshot_id
     join job_snapshots s on s.id=i.job_snapshot_id
     where o.id=$1 and o.status='sending' order by i.ordinal`, [outboxId],
  );
  if (!rows.length) throw new Error("digest_snapshot_missing");
  const items = rows.map((row) => {
    const title = String(row.facts?.title?.text ?? "Job match");
    return { title, fit: row.fit_score, confidence: row.confidence_score, url: String(row.source_url) };
  });
  const textItems = items.map((item, index) => `${index + 1}. ${item.title} — fit ${item.fit}/100, evidence confidence ${item.confidence}/100\n${item.url}`).join("\n\n");
  const htmlItems = items.map((item) => `<li style="margin-bottom:14px"><strong>${escapeHtml(item.title)}</strong><br>Fit ${item.fit}/100 · evidence confidence ${item.confidence}/100<br><a href="${escapeHtml(item.url)}">View official job link</a></li>`).join("");
  const token = createDigestUnsubscribeToken(rows[0].campaign_id);
  const unsubscribe = `${env.siteUrl}/daily-matches/unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    to: String(rows[0].normalized_email), subject: `Your ${items.length} Daily Matches from RoleSharp`,
    text: `Here are today's strongest new matches. Fit is not a hiring probability.\n\n${textItems}\n\nPause Daily Matches: ${unsubscribe}`,
    html: `<div style="font-family:Arial,sans-serif;color:#172033"><h2>Your Daily Matches</h2><p>These are conservative fit scores, not hiring probabilities.</p><ol>${htmlItems}</ol><p><a href="${escapeHtml(unsubscribe)}">Pause Daily Matches</a></p></div>`,
    type: "daily_matches",
  };
}

export async function deliverNotificationOutbox(
  outboxId: string,
  transport: typeof sendMail = sendMail,
): Promise<"provider_accepted" | "unknown"> {
  if (!(await startNotificationBoundary(outboxId))) return "unknown";
  try {
    const status = await transport(await digestMessage(outboxId));
    const receiptHash = createHash("sha256").update(`rolesharp-notification-v1:${outboxId}:${status}`).digest("hex");
    await q("select complete_notification_outbox_invocation($1,'provider_accepted',$2)", [outboxId, receiptHash]);
    return "provider_accepted";
  } catch {
    await q("select complete_notification_outbox_invocation($1,'unknown',null)", [outboxId]);
    return "unknown";
  }
}

export async function pauseDailyMatchesByToken(token: string): Promise<boolean> {
  const verified = verifyDigestUnsubscribeToken(token);
  if (!verified) return false;
  const rows = await q<{ id: string }>(
    `update job_campaigns set status='paused',updated_at=now()
     where id=$1 and mode='daily_matches' and status='active' returning id`, [verified.campaignId],
  );
  return Boolean(rows[0]);
}

export async function listDailyDigestHistory(userId: string, limit = 30) {
  return q(
    `select d.id,d.local_date,d.ordered_snapshot,d.status,d.created_at,d.updated_at,
       o.status transport_status,o.classification,o.terminal_at
     from digest_runs d left join notification_outbox o
       on o.aggregate_type='digest_run' and o.aggregate_id=d.id
     where d.user_id=$1 order by d.local_date desc limit $2`,
    [userId, Math.max(1, Math.min(limit, 100))],
  );
}
