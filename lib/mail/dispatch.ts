import { createHash } from "node:crypto";
import { q, withTransaction } from "../db";
import { jobsWorkflowConfig, type JobsWorkflowConfig } from "../jobs-workflow/config";
import { providerSendEnabled, providerSendFlag } from "../jobs-workflow/flags";
import { compareAndSwapRefreshCredential, readRefreshCredential } from "./credentials";
import { MAIL_PROVIDER_POLICY } from "./provider-policy";
import type { MailProvider } from "./token-crypto";
import { deadlineSignal, PROVIDER_REQUEST_TIMEOUT_MS } from "../request-deadline";
import { LegalAcceptanceRequiredError, requireCurrentLegalAcceptance } from "../legal";

type DispatchRow = {
  id: string; user_id: string; current_invocation_ordinal: number;
  connection_id: string; provider: MailProvider; verified_sender: string;
  granted_scopes: string[]; package_id: string; recipient_record: { email?: string };
  selected_recipient: string;
  subject: string; body: string; package_hash: string; bytes: Buffer; bytes_hash: string;
  filename: string; attachment_bytes_hash: string;
};

class ProviderResponseError extends Error {
  constructor(
    public readonly status: number,
    public readonly stage: "refresh" | "send",
    public readonly retryAfter: string | null,
  ) {
    super(`provider_${stage}_http_${status}`);
  }
}

function encodeHeader(value: string): string {
  return /^[\x20-\x7E]+$/u.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function lines(value: string, width = 76): string {
  return value.match(new RegExp(`.{1,${width}}`, "gu"))?.join("\r\n") ?? "";
}

export function attachmentBytesMatch(bytes: Uint8Array, expectedHash: string): boolean {
  return /^[0-9a-f]{64}$/u.test(expectedHash)
    && createHash("sha256").update(bytes).digest("hex") === expectedHash;
}

export function buildGmailMime(input: {
  sender: string; recipient: string; subject: string; body: string; filename: string; pdf: Uint8Array;
  boundarySeed: string;
}): string {
  const boundary = `rolesharp_${createHash("sha256").update(input.boundarySeed).digest("hex").slice(0, 32)}`;
  const body64 = lines(Buffer.from(input.body, "utf8").toString("base64"));
  const pdf64 = lines(Buffer.from(input.pdf).toString("base64"));
  return [
    `From: ${input.sender}`, `To: ${input.recipient}`, `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
    `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", body64,
    `--${boundary}`, `Content-Type: application/pdf; name="${input.filename}"`,
    "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${input.filename}"`, "", pdf64,
    `--${boundary}--`, "",
  ].join("\r\n");
}

async function refreshAccessToken(input: {
  provider: MailProvider; refreshToken: string; config: JobsWorkflowConfig; fetchImpl: typeof fetch;
}) {
  const provider = input.provider === "google" ? input.config.gmail : input.config.microsoft;
  const endpoint = MAIL_PROVIDER_POLICY[input.provider].tokenEndpoint;
  let response: Response;
  try {
    response = await input.fetchImpl(endpoint, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: provider.clientId, client_secret: provider.clientSecret,
        refresh_token: input.refreshToken, grant_type: "refresh_token",
        ...(input.provider === "microsoft" ? { scope: MAIL_PROVIDER_POLICY.microsoft.requiredScopes.join(" ") } : {}),
      }),
      signal: deadlineSignal(PROVIDER_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error("provider_refresh_network", { cause: error });
  }
  if (!response.ok) throw new ProviderResponseError(response.status, "refresh", response.headers.get("Retry-After"));
  const payload = await response.json().catch(() => null) as { access_token?: unknown; refresh_token?: unknown } | null;
  if (typeof payload?.access_token !== "string" || !payload.access_token) throw new Error("provider_refresh_invalid");
  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === "string" && payload.refresh_token ? payload.refresh_token : undefined,
  };
}

async function sendProviderMessage(row: DispatchRow, accessToken: string, fetchImpl: typeof fetch) {
  const recipient = row.selected_recipient;
  if (!recipient) throw new Error("recipient_missing");
  let response: Response;
  try {
    if (row.provider === "google") {
      const mime = buildGmailMime({
        sender: row.verified_sender, recipient, subject: row.subject, body: row.body,
        filename: row.filename, pdf: row.bytes, boundarySeed: row.package_hash,
      });
      response = await fetchImpl("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: Buffer.from(mime, "utf8").toString("base64url") }),
        signal: deadlineSignal(PROVIDER_REQUEST_TIMEOUT_MS),
      });
    } else {
      response = await fetchImpl("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: {
          subject: row.subject,
          body: { contentType: "Text", content: row.body },
          toRecipients: [{ emailAddress: { address: recipient } }],
          attachments: [{ "@odata.type": "#microsoft.graph.fileAttachment", name: row.filename,
            contentType: "application/pdf", contentBytes: Buffer.from(row.bytes).toString("base64") }],
        }, saveToSentItems: true }),
        signal: deadlineSignal(PROVIDER_REQUEST_TIMEOUT_MS),
      });
    }
  } catch (error) {
    throw new Error("provider_send_network_unknown", { cause: error });
  }
  if (!response.ok) throw new ProviderResponseError(response.status, "send", response.headers.get("Retry-After"));
  let receiptReference = `${row.provider}:${response.status}`;
  if (row.provider === "google") {
    const payload = await response.json().catch(() => null) as { id?: unknown; threadId?: unknown } | null;
    if (typeof payload?.id !== "string") throw new Error("provider_send_response_unknown");
    receiptReference = `google:${payload.id}:${typeof payload.threadId === "string" ? payload.threadId : ""}`;
  }
  return createHash("sha256").update(`rolesharp-provider-receipt-v1:${receiptReference}`).digest("hex");
}

async function reserveAttempt(attemptId: string, provider: MailProvider): Promise<"reserved" | "missing" | "exhausted" | "needs_user"> {
  if (!(await providerSendEnabled(provider))) return "missing";
  return withTransaction(async (query) => {
    const flag = providerSendFlag(provider);
    const expired = (await query<{ approval_id: string }>(
      `select a.approval_id from application_mail_attempts a
       join package_approvals pa on pa.id=a.approval_id and pa.user_id=a.user_id
       where a.id=$1 and a.status='queued' and a.current_invocation_ordinal=0
         and pa.status='active' and pa.expires_at<=now()
       for update of a,pa`, [attemptId],
    ))[0];
    if (expired) {
      await query("update package_approvals set status='expired' where id=$1 and status='active'", [expired.approval_id]);
      await query("update application_mail_attempts set status='needs_user',updated_at=now() where id=$1 and status='queued'", [attemptId]);
      return "needs_user";
    }
    const row = (await query<{ status: string; current_invocation_ordinal: number }>(
      `select a.status,a.current_invocation_ordinal from application_mail_attempts a
       join email_connections e on e.id=a.connection_id and e.user_id=a.user_id
       join users u on u.id=a.user_id and u.deleting_at is null
       join feature_flags f on f.name=$2 and f.enabled=true and workflow_rollout_allows(f.name,a.user_id)
       join feature_access_grants g on g.user_id=a.user_id
         and g.feature_key=case when e.provider='google' then 'role_apply_gmail' else 'role_apply_microsoft' end
         and g.state='approved' and (g.expires_at is null or g.expires_at>now())
       where a.id=$1 and e.provider=$3
         and (a.status='queued' or (a.status='retryable' and a.retry_not_before<=now()))
       for update of a,e,u`, [attemptId, flag, provider],
    ))[0];
    if (!row) return "missing";
    if (row.current_invocation_ordinal >= 3) {
      await query(
        `update application_mail_attempts set status='terminal_failed',terminal_at=now(),updated_at=now()
         where id=$1 and status='retryable'`, [attemptId],
      );
      return "exhausted";
    }
    await query("update application_mail_attempts set status='reserved',updated_at=now() where id=$1", [attemptId]);
    return "reserved";
  });
}

async function startApplicationBoundary(attemptId: string, provider: MailProvider): Promise<number> {
  if (!(await providerSendEnabled(provider))) return 0;
  return withTransaction(async (query) => {
    const flag = providerSendFlag(provider);
    const config = jobsWorkflowConfig();
    const valid = (await query<{ id: string; retry_not_before: string | null }>(
      `select a.id,a.retry_not_before from application_mail_attempts a
       join email_connections e on e.id=a.connection_id and e.user_id=a.user_id
       join application_packages p on p.id=a.package_id and p.user_id=a.user_id
       join application_package_attachments x on x.package_id=p.id and x.user_id=p.user_id
       join package_approvals pa on pa.id=a.approval_id and pa.user_id=a.user_id
         and pa.package_id=p.id and pa.package_hash=p.package_hash
       join job_campaigns c on c.id=a.campaign_id and c.user_id=a.user_id
       join job_matches m on m.user_id=a.user_id and m.campaign_id=c.id
         and m.job_snapshot_id=p.job_snapshot_id and m.profile_version_id=p.profile_version_id
         and m.canonical_job_key=p.canonical_job_key and m.score_version=p.score_version
       join feature_flags f on f.name=$2 and f.enabled=true and workflow_rollout_allows(f.name,a.user_id)
       join feature_access_grants g on g.user_id=a.user_id
         and g.feature_key=case when e.provider='google' then 'role_apply_gmail' else 'role_apply_microsoft' end
         and g.state='approved' and (g.expires_at is null or g.expires_at>now())
       where a.id=$1 and a.status='reserved' and e.provider=$3 and e.status='active'
         and c.status='active' and c.mode='role_apply' and c.authorization_mode='review_each'
         and c.pinned_connection_id=e.id
         and p.status='ready' and p.connection_id=e.id
         and p.connection_generation=e.connection_generation
         and x.bytes_hash=p.attachment_bytes_hash
         and e.granted_scopes @> $6::text[]
         and not (e.granted_scopes && $7::text[])
         and pa.expires_at>now()
         and ((a.current_invocation_ordinal=0 and pa.status='active')
           or (a.current_invocation_ordinal>0 and pa.status='consumed'))
         and m.status='eligible' and m.fit_score>=$4 and m.confidence_score>=$5
         and jsonb_array_length(m.blockers)=0
         and p.recipient_record->>'disposition'='auto_eligible'
         and nullif(p.recipient_record->>'employerDomainRelationship','') is not null
         and p.recipient_record->>'employerDomainRelationship'<>'unavailable'
         and exists (
           select 1 from jsonb_array_elements(p.recipient_record->'candidates') candidate
           where lower(candidate->>'email')=pa.selected_recipient
             and jsonb_typeof(candidate->'warnings')='array'
             and jsonb_array_length(candidate->'warnings')=0
         )
       for update of a,e,p,pa,c,m`,
      [attemptId, flag, provider, config.applicationEmailFitFloor, config.applicationEmailConfidenceFloor,
        MAIL_PROVIDER_POLICY[provider].requiredScopes, MAIL_PROVIDER_POLICY[provider].forbiddenScopes],
    ))[0];
    if (!valid) return 0;
    const result = await query<{ start_application_mail_invocation: number }>(
      "select start_application_mail_invocation($1,coalesce($2::timestamptz,now()))",
      [attemptId, valid.retry_not_before],
    );
    const ordinal = Number(result[0]?.start_application_mail_invocation ?? 0);
    if (ordinal > 0) await query("update application_mail_attempts set retry_not_before=null where id=$1 and status='sending'", [attemptId]);
    return ordinal;
  });
}

async function complete(
  attemptId: string,
  ordinal: number,
  classification: string,
  category: string,
  receiptHash?: string,
  retryNotBefore?: Date,
) {
  await withTransaction(async (query) => {
    const completed = await query<{ complete_application_mail_invocation: number }>(
      "select complete_application_mail_invocation($1,$2,$3,$4,$5)",
      [attemptId, ordinal, classification, category, receiptHash ?? null],
    );
    if (Number(completed[0]?.complete_application_mail_invocation) === 1) {
      await query(
        "update application_mail_attempts set retry_not_before=$2 where id=$1 and current_invocation_ordinal=$3",
        [attemptId, classification === "retryable" ? retryNotBefore ?? null : null, ordinal],
      );
    }
  });
}

function retryBoundary(ordinal: number, retryAfter: string | null, now = new Date()): Date {
  const exponential = now.getTime() + 15 * 60_000 * (2 ** Math.max(0, ordinal - 1));
  let providerTime = 0;
  if (retryAfter && /^\d+$/u.test(retryAfter.trim())) providerTime = now.getTime() + Number(retryAfter.trim()) * 1000;
  else if (retryAfter) {
    const parsed = Date.parse(retryAfter);
    if (Number.isFinite(parsed)) providerTime = parsed;
  }
  return new Date(Math.min(now.getTime() + 24 * 3600_000, Math.max(exponential, providerTime)));
}

async function markConnectionNeedsUser(row: Pick<DispatchRow, "connection_id" | "user_id">) {
  await withTransaction(async (query) => {
    await query(
      "update email_connections set status='needs_user',updated_at=now() where id=$1 and user_id=$2 and status='active'",
      [row.connection_id, row.user_id],
    );
    await query(
      `update job_campaigns set status='needs_user',updated_at=now()
       where user_id=$1 and pinned_connection_id=$2 and status='active'`,
      [row.user_id, row.connection_id],
    );
  });
}

export async function dispatchApplicationAttempt(attemptId: string, fetchImpl: typeof fetch = fetch) {
  const connection = (await q<{ provider: MailProvider }>(
    `select e.provider from application_mail_attempts a join email_connections e on e.id=a.connection_id
     where a.id=$1`, [attemptId],
  ))[0];
  if (!connection) return "missing" as const;
  const attemptOwner = (await q<{ user_id: string }>(
    "select user_id from application_mail_attempts where id=$1",
    [attemptId],
  ))[0];
  if (!attemptOwner) return "missing" as const;
  try {
    await requireCurrentLegalAcceptance(attemptOwner.user_id);
  } catch (error) {
    if (!(error instanceof LegalAcceptanceRequiredError)) throw error;
    await q(
      `update application_mail_attempts set status='needs_user',updated_at=now()
       where id=$1 and status in ('queued','retryable','reserved') and current_invocation_ordinal=0`,
      [attemptId],
    );
    return "needs_user" as const;
  }
  const reservation = await reserveAttempt(attemptId, connection.provider);
  if (reservation !== "reserved") return reservation;
  let ordinal = 0;
  try {
    ordinal = await startApplicationBoundary(attemptId, connection.provider);
  } catch (error) {
    // enforce_auto_apply_dispatch_readiness raises five distinct, specific
    // reasons (attempt not reserved, readiness pins missing, recipient not
    // posting-backed, legal pin stale, acceptance missing). Swallowing them
    // collapses all five into an opaque "blocked" with nothing to act on.
    console.error("application_boundary_blocked", attemptId, error instanceof Error ? error.message : error);
    ordinal = 0;
  }
  if (!ordinal) {
    await q(
      `update application_mail_attempts set status='blocked',terminal_at=now(),updated_at=now()
       where id=$1 and status='reserved'`, [attemptId],
    );
    return "blocked" as const;
  }
  const row = (await q<DispatchRow>(
    `select a.id,a.user_id,a.current_invocation_ordinal,a.connection_id,e.provider,e.verified_sender,
       e.granted_scopes,a.package_id,p.recipient_record,pa.selected_recipient,p.subject,p.body,p.package_hash,
       x.bytes,x.bytes_hash,x.filename,p.attachment_bytes_hash
     from application_mail_attempts a join email_connections e on e.id=a.connection_id
     join application_packages p on p.id=a.package_id
     join package_approvals pa on pa.id=a.approval_id and pa.package_id=p.id
     join application_package_attachments x on x.package_id=p.id
     where a.id=$1 and a.status='sending'`, [attemptId],
  ))[0];
  if (!row || row.current_invocation_ordinal !== ordinal
    || row.bytes_hash !== row.attachment_bytes_hash
    || !attachmentBytesMatch(row.bytes, row.bytes_hash)) {
    await complete(attemptId, ordinal, "unknown", "package_reload_failed");
    return "unknown" as const;
  }
  try {
    const credential = await readRefreshCredential({ connectionId: row.connection_id, userId: row.user_id });
    if (!credential) {
      await complete(attemptId, ordinal, "needs_user", "credential_missing");
      await markConnectionNeedsUser(row);
      return "needs_user" as const;
    }
    const token = await refreshAccessToken({
      provider: row.provider, refreshToken: credential.token, config: jobsWorkflowConfig(), fetchImpl,
    });
    if (token.refreshToken) {
      await compareAndSwapRefreshCredential({
        connectionId: row.connection_id, userId: row.user_id,
        expectedGeneration: credential.generation, expectedFingerprint: credential.fingerprint,
        refreshToken: token.refreshToken,
      });
    }
    const receiptHash = await sendProviderMessage(row, token.accessToken, fetchImpl);
    await complete(attemptId, ordinal, "provider_accepted", "provider_accepted_delivery_unverified", receiptHash);
    return "provider_accepted" as const;
  } catch (error) {
    if (error instanceof ProviderResponseError) {
      if ([400, 401, 403].includes(error.status) && error.stage === "refresh") {
        await complete(attemptId, ordinal, "needs_user", `refresh_http_${error.status}`);
        await markConnectionNeedsUser(row);
        return "needs_user" as const;
      }
      if ([401, 403].includes(error.status) && error.stage === "send") {
        await complete(attemptId, ordinal, "needs_user", `send_http_${error.status}`);
        await markConnectionNeedsUser(row);
        return "needs_user" as const;
      }
      if (error.status === 408 || error.status === 429) {
        if (ordinal >= 3) {
          await complete(attemptId, ordinal, "terminal_failed", `${error.stage}_retry_ceiling_http_${error.status}`);
          return "terminal_failed" as const;
        }
        await complete(attemptId, ordinal, "retryable", `${error.stage}_proven_http_${error.status}`,
          undefined, retryBoundary(ordinal, error.retryAfter));
        return "retryable" as const;
      }
      if (error.status >= 500) {
        await complete(attemptId, ordinal, "unknown", `${error.stage}_http_${error.status}_outcome_unknown`);
        return "unknown" as const;
      }
      await complete(attemptId, ordinal, "terminal_failed", `${error.stage}_http_${error.status}`);
      return "terminal_failed" as const;
    }
    const message = error instanceof Error ? error.message : "provider_unknown";
    await complete(attemptId, ordinal, "unknown", message.includes("refresh_network") || message.includes("refresh_invalid")
      ? "refresh_outcome_unknown" : "provider_outcome_unknown");
    return "unknown" as const;
  }
}

export async function listApplicationAttempts(userId: string, limit = 100) {
  return q(
    `select a.id,a.canonical_job_key,a.package_id,a.status,a.current_invocation_ordinal,
       a.provider_call_started_at,a.created_at,a.updated_at,a.terminal_at,e.provider,e.verified_sender,
       p.subject,p.recipient_record,pa.selected_recipient,s.source_url
     from application_mail_attempts a join email_connections e on e.id=a.connection_id
     join application_packages p on p.id=a.package_id
     join package_approvals pa on pa.id=a.approval_id
     join job_snapshots s on s.id=p.job_snapshot_id
     where a.user_id=$1 order by a.created_at desc limit $2`, [userId, Math.max(1, Math.min(limit, 100))],
  );
}
