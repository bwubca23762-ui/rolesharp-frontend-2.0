import { q } from "./db";
import { env } from "./env";
import { sendMail } from "./email";
import { BulkBudgetExhaustedError, bulkCapacity, bulkConfigured, sendBulkMail } from "./bulk-mail";
import { containsLikePattern } from "./sql-search";

// ── Job Alert Emails (T5, TOOLS-TRACKER) ──
// Free: 1 weekly alert · Premium: up to 3 daily alerts.
// Sends through the bulk SMTP pool when one is configured (per-account daily
// budgets in lib/bulk-mail.ts), falling back to the transactional transport
// (Cloudflare Email API or SMTP) with its budget sub-cap.

export type JobAlert = {
  id: string;
  user_id: string;
  role_keyword: string;
  country_code: string;
  frequency: "weekly" | "daily";
  paused: boolean;
  last_sent_at: string | null;
  created_at: string;
};

export type AlertJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  is_remote: boolean;
  apply_url: string;
  date_posted: string | null;
};

export function isPremiumUser(premiumUntil: string | Date | null): boolean {
  if (!premiumUntil) return false;
  return new Date(premiumUntil) > new Date();
}

export async function getAlerts(userId: string): Promise<JobAlert[]> {
  const rows = await q<JobAlert>(
    "select * from job_alerts where user_id=$1 order by created_at",
    [userId],
  );
  return rows;
}

export async function getAlertById(id: string, userId: string): Promise<JobAlert | null> {
  const rows = await q<JobAlert>(
    "select * from job_alerts where id=$1 and user_id=$2",
    [id, userId],
  );
  return rows[0] ?? null;
}

export type CreateAlertInput = {
  userId: string;
  roleKeyword: string;
  countryCode: string;
  frequency: "weekly" | "daily";
  isPremium: boolean;
};

export async function createAlert(input: CreateAlertInput): Promise<{ alert?: JobAlert; error?: string }> {
  // Tier enforcement (mirrors the DB trigger for clean API errors).
  const existing = await getAlerts(input.userId);
  const limit = input.isPremium ? 3 : 1;
  if (existing.length >= limit) {
    return { error: input.isPremium ? "limit_premium" : "limit_free" };
  }
  const frequency = input.isPremium ? input.frequency : "weekly";

  const rows = await q<JobAlert>(
    `insert into job_alerts (user_id, role_keyword, country_code, frequency)
     values ($1,$2,$3,$4)
     returning *`,
    [input.userId, input.roleKeyword.trim().replace(/\s+/g, " ").slice(0, 60), input.countryCode.toUpperCase(), frequency],
  ).catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("alert_limit_premium")) return [{ error: "limit_premium" }];
    if (msg.includes("alert_limit_free")) return [{ error: "limit_free" }];
    throw error;
  });

  const row = rows[0] as JobAlert & { error?: string };
  if (row.error) return { error: row.error };
  return { alert: row };
}

export async function updateAlert(
  id: string,
  userId: string,
  updates: { roleKeyword?: string; countryCode?: string; frequency?: "weekly" | "daily"; paused?: boolean },
  isPremium: boolean,
): Promise<JobAlert | null> {
  const sets: string[] = ["updated_at=now()"];
  const params: unknown[] = [id, userId];
  let idx = 3;
  if (updates.roleKeyword !== undefined) { params.push(updates.roleKeyword.trim().replace(/\s+/g, " ").slice(0, 60)); sets.push(`role_keyword=$${idx++}`); }
  if (updates.countryCode !== undefined) { params.push(updates.countryCode.toUpperCase()); sets.push(`country_code=$${idx++}`); }
  if (updates.frequency !== undefined && isPremium) { params.push(updates.frequency); sets.push(`frequency=$${idx++}`); }
  if (updates.paused !== undefined) { params.push(updates.paused); sets.push(`paused=$${idx++}`); }

  const rows = await q<JobAlert>(
    `update job_alerts set ${sets.join(", ")} where id=$1 and user_id=$2 returning *`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteAlert(id: string, userId: string): Promise<boolean> {
  const rows = await q("delete from job_alerts where id=$1 and user_id=$2 returning id", [id, userId]);
  return rows.length > 0;
}

/** Find alerts due to be sent right now. A stored 'daily' frequency only
 * fires while the user is currently premium (trial or paid) — lapsed daily
 * alerts fall back to the weekly window instead of sending mail forever. */
export async function findDueAlerts(): Promise<Array<JobAlert & { user_email: string; unsubscribe_token: string }>> {
  return q<JobAlert & { user_email: string; unsubscribe_token: string }>(
    `select a.*, u.email as user_email
     from job_alerts a
     join users u on u.id = a.user_id and u.email_verified_at is not null
     where not a.paused
       and (
         (a.frequency = 'daily' and u.premium_until > now() and (a.last_sent_at is null or a.last_sent_at < now() - interval '20 hours'))
         or
         (a.frequency = 'weekly' and (a.last_sent_at is null or a.last_sent_at < now() - interval '6 days'))
         or
         (a.frequency = 'daily' and (u.premium_until is null or u.premium_until < now()) and (a.last_sent_at is null or a.last_sent_at < now() - interval '6 days'))
       )
     order by a.last_sent_at nulls first
     limit 100`,
  );
}

/** Match jobs for an alert — the same escaped-ILIKE idiom as searchJobs, title-scoped. */
export async function findMatchingJobs(roleKeyword: string, countryCode: string, limit = 10): Promise<AlertJob[]> {
  const words = roleKeyword.toLowerCase().split(/\s+/).filter((w) => w.length > 1).slice(0, 4);
  if (!words.length) return [];
  // Every word must appear in the title, wrapped and escaped by the shared
  // helper (lib/sql-search.ts). Bare words would only match titles exactly
  // equal to the keyword, and numbering the placeholders against
  // [country, ...words, limit] pointed past the words entirely — the bind
  // failed on every call, so no alert ever sent.
  const values: unknown[] = [countryCode, limit];
  const conditions = words.map((word) => {
    values.push(containsLikePattern(word));
    return `title ilike $${values.length}`;
  });

  const rows = await q<AlertJob>(
    `select id, title, company, location, salary_min, salary_max, salary_currency,
            is_remote, apply_url, date_posted::text as date_posted
     from jobs
     where expires_at > now()
       and country_code = $1
       and apply_url ~* '^https?://[^[:space:]]+$'
       and ${conditions.join(" and ")}
     order by date_posted desc nulls last, last_seen_at desc
     limit $2`,
    values,
  );
  return rows;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildAlertEmailHtml(
  roleKeyword: string,
  countryName: string,
  jobs: AlertJob[],
  unsubscribeUrl: string,
): string {
  const rows = jobs.map((j) => {
    const salary = j.salary_min != null && j.salary_max != null
      ? `<span style="color:#047857;font-weight:bold;">${j.salary_currency ?? "$"}${j.salary_min.toLocaleString()}–${j.salary_max.toLocaleString()}</span><br/>`
      : "";
    return `<tr style="border-top:1px solid #e5e7eb;">
      <td style="padding:12px 0;">
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(j.company)}</div>
        <div style="margin:4px 0 2px;"><a href="${escapeHtml(j.apply_url)}" style="color:#123B7A;font-weight:bold;font-size:15px;text-decoration:none;">${escapeHtml(j.title)}</a></div>
        <div style="font-size:13px;color:#6b7280;">${escapeHtml(j.location || countryName)}${j.is_remote ? " · Remote" : ""}</div>
        ${salary}
        <div style="margin-top:8px;"><a href="${env.siteUrl}/build?jobId=${encodeURIComponent(j.id)}" style="background:#123B7A;color:white;padding:6px 14px;border-radius:999px;text-decoration:none;font-size:12px;font-weight:bold;">Tailor resume →</a></div>
      </td>
    </tr>`;
  }).join("");

  return `
<div style="font-family:Arial,sans-serif;line-height:1.5;color:#10243E;max-width:600px;margin:0 auto;">
  <h2 style="margin:0 0 16px;">New ${roleKeyword} jobs in ${countryName}</h2>
  <p style="color:#6b7280;margin:0 0 20px;">The newest postings matching your alert. Apply early — fresh listings get more responses.</p>
  <table style="width:100%;border-collapse:collapse;">${rows}</table>
  <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
    <a href="${unsubscribeUrl}" style="color:#9ca3af;">Pause or unsubscribe from this alert</a> ·
    You received this because you set up a job alert on RoleSharp.
  </p>
</div>`;
}

export function buildAlertText(roleKeyword: string, countryName: string, jobs: AlertJob[], unsubscribeUrl: string): string {
  const list = jobs.map((j) =>
    `${j.title} at ${j.company}${j.location ? ` (${j.location})` : ""}\n${j.apply_url}`,
  ).join("\n\n");
  return `New ${roleKeyword} jobs in ${countryName}:\n\n${list}\n\nPause: ${unsubscribeUrl}`;
}

export { sendMail };

// ── Worker entry point ──

/**
 * Processes all due alerts. Called by the worker on its normal tick schedule.
 * Sub-cap: when the bulk pool is configured, alerts draw from the pool's own
 * per-account budgets (accounts × BULK_DAILY_LIMIT) and never touch the
 * transactional budget. Without the pool they fall back to the transactional
 * transport capped at 75% of EMAIL_DAILY_LIMIT so verification mail is
 * never starved.
 */
export function alertsSubCap(): number {
  return bulkConfigured() ? bulkCapacity() : Math.floor(Number(process.env.EMAIL_DAILY_LIMIT ?? "200") * 0.75);
}

let sentToday = 0;
let sentDate = "";

export function alertsSentToday(): number {
  const today = new Date().toISOString().slice(0, 10);
  if (sentDate !== today) { sentDate = today; sentToday = 0; }
  return sentToday;
}

export async function processDueAlerts(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  if (sentDate !== today) { sentDate = today; sentToday = 0; }

  if (sentToday >= alertsSubCap()) return 0;

  const due = await findDueAlerts();
  let processed = 0;

  for (const alert of due) {
    if (sentToday >= alertsSubCap()) break;

    try {
      const jobs = await findMatchingJobs(alert.role_keyword, alert.country_code);
      if (!jobs.length) {
        await q("update job_alerts set last_sent_at=now() where id=$1", [alert.id]);
        continue;
      }

      // Country name lookup — best-effort, falls back to code.
      let countryName = alert.country_code;
      try {
        const nameRows = await q<{ name: string }>(
          "select name from countries where code=$1", [alert.country_code],
        );
        if (nameRows[0]?.name) countryName = nameRows[0].name;
      } catch {}

      const unsubToken = encodeURIComponent(`${alert.unsubscribe_token}`);
      const unsubUrl = `${env.siteUrl}/api/job-alerts/unsubscribe?token=${unsubToken}`;
      const html = buildAlertEmailHtml(alert.role_keyword, countryName, jobs, unsubUrl);
      const text = buildAlertText(alert.role_keyword, countryName, jobs, unsubUrl);
      // RFC 2369 + RFC 8058: mail clients surface the one-click chip from
      // these headers; the POST URL must answer the List-Unsubscribe-Post
      // flow (the route implements both verbs).
      const unsubHeaders = {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      // Bulk pool first (per-account budgets, least-used rotation); the
      // transactional transport is only the fallback when no pool exists.
      // Budget exhausted on every account ends the tick — the next tick
      // resumes with a fresh window or the next UTC day.
      const useBulk = bulkConfigured();
      await (useBulk ? sendBulkMail({
        to: alert.user_email,
        subject: `${jobs.length} new ${alert.role_keyword} jobs in ${countryName}`,
        text,
        html,
        type: "job_alert",
        headers: unsubHeaders,
      }) : sendMail({
        to: alert.user_email,
        subject: `${jobs.length} new ${alert.role_keyword} jobs in ${countryName}`,
        text,
        html,
        type: "job_alert",
      }));

      await q("update job_alerts set last_sent_at=now() where id=$1", [alert.id]);
      processed++;
      sentToday++;
    } catch (error) {
      if (error instanceof BulkBudgetExhaustedError) break;
      console.error("[job-alerts]", alert.id, error instanceof Error ? error.message : error);
    }
  }

  return processed;
}
