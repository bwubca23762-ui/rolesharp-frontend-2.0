import { randomUUID } from "node:crypto";
import { q, withTransaction } from "../db";
import { jobsWorkflowConfig, type JobsWorkflowConfig } from "../jobs-workflow/config";
import type { AuthorizationExchange } from "./providers";
import { decryptRefreshToken, encryptRefreshToken, type MailTokenContext } from "./token-crypto";

type ConnectionRow = {
  id: string; user_id: string; provider: "google" | "microsoft"; provider_tenant: string;
  provider_subject: string; verified_sender: string; granted_scopes: string[];
  refresh_ciphertext: Buffer; key_version: number; refresh_nonce: Buffer; refresh_tag: Buffer;
  connection_generation: number; status: "active" | "needs_user" | "disabled";
};

function tokenContext(row: Pick<ConnectionRow, "id" | "user_id" | "provider" | "provider_tenant" | "provider_subject" | "connection_generation">): MailTokenContext {
  return {
    userId: row.user_id, connectionId: row.id, provider: row.provider,
    providerTenant: row.provider_tenant, providerSubject: row.provider_subject,
    connectionGeneration: row.connection_generation,
  };
}

export async function saveMailboxConnection(userId: string, exchange: AuthorizationExchange, config: JobsWorkflowConfig = jobsWorkflowConfig()) {
  return withTransaction(async (query) => {
    const owner = (await query<{ id: string }>("select id from users where id=$1 and deleting_at is null for update", [userId]))[0];
    if (!owner) throw new Error("account_unavailable");
    const existing = (await query<ConnectionRow>(
      `select * from email_connections where provider=$1 and provider_tenant=$2
       and provider_subject=$3 and status<>'disabled' for update`,
      [exchange.provider, exchange.tenant, exchange.subject],
    ))[0];
    if (existing?.user_id !== undefined && existing.user_id !== userId) throw new Error("mailbox_identity_in_use");
    if (!exchange.refreshToken) {
      if (!existing || existing.status !== "active" || existing.verified_sender !== exchange.verifiedSender
        || !exchange.scopes.every((scope) => existing.granted_scopes.includes(scope))) {
        throw new Error("refresh_consent_required");
      }
      return { id: existing.id, provider: existing.provider, verifiedSender: existing.verified_sender, reusedCredential: true };
    }
    if (existing) {
      if (existing.verified_sender !== exchange.verifiedSender) throw new Error("mailbox_identity_changed");
      const nextGeneration = existing.connection_generation + 1;
      const encrypted = encryptRefreshToken(exchange.refreshToken, tokenContext({
        ...existing, connection_generation: nextGeneration,
      }), config);
      await query(
        `update email_connections set refresh_ciphertext=$1,key_version=$2,refresh_nonce=$3,
           refresh_tag=$4,granted_scopes=$5,connection_generation=$6,
           status='active',disabled_at=null,updated_at=now()
         where id=$7 and user_id=$8`,
        [encrypted.ciphertext, encrypted.keyVersion, encrypted.nonce, encrypted.tag,
          exchange.scopes, nextGeneration, existing.id, userId],
      );
      await query(
        `update application_packages set status='stale',updated_at=now()
         where user_id=$1 and connection_id=$2 and connection_generation<$3
           and status in ('preparing','review_required','ready')`,
        [userId, existing.id, nextGeneration],
      );
      await query(
        `update package_approvals a set status='invalidated',invalidated_at=now()
         from application_packages p where a.package_id=p.id and a.user_id=$1
           and p.connection_id=$2 and p.connection_generation<$3 and a.status='active'`,
        [userId, existing.id, nextGeneration],
      );
      await query(
        `update application_mail_attempts set status='canceled',retry_not_before=null,
           terminal_at=now(),updated_at=now()
         where user_id=$1 and connection_id=$2
           and status in ('queued','reserved','retryable','needs_user')`,
        [userId, existing.id],
      );
      return { id: existing.id, provider: existing.provider, verifiedSender: existing.verified_sender, reusedCredential: false };
    }
    const id = randomUUID();
    const generation = 1;
    const bare = {
      id, user_id: userId, provider: exchange.provider, provider_tenant: exchange.tenant,
      provider_subject: exchange.subject, connection_generation: generation,
    };
    const encrypted = encryptRefreshToken(exchange.refreshToken, tokenContext(bare), config);
    await query(
      `insert into email_connections(id,user_id,provider,provider_tenant,provider_subject,
         verified_sender,granted_scopes,refresh_ciphertext,key_version,refresh_nonce,refresh_tag,
         connection_generation,status)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active')`,
      [id, userId, exchange.provider, exchange.tenant, exchange.subject, exchange.verifiedSender,
        exchange.scopes, encrypted.ciphertext, encrypted.keyVersion, encrypted.nonce, encrypted.tag, generation],
    );
    return { id, provider: exchange.provider, verifiedSender: exchange.verifiedSender, reusedCredential: false };
  });
}

export async function listMailboxConnections(userId: string) {
  return q(
    `select id,provider,verified_sender,granted_scopes,connection_generation,status,
       disabled_at,revocation_result,created_at,updated_at
     from email_connections where user_id=$1 order by created_at desc`, [userId],
  );
}

export async function disconnectMailboxConnection(input: {
  userId: string; connectionId: string; config?: JobsWorkflowConfig;
}): Promise<{ provider: "google" | "microsoft"; refreshToken?: string } | null> {
  let config = input.config;
  if (!config) {
    try { config = jobsWorkflowConfig(); } catch { config = undefined; }
  }
  return withTransaction(async (query) => {
    const row = (await query<ConnectionRow>(
      "select * from email_connections where id=$1 and user_id=$2 and status<>'disabled' for update",
      [input.connectionId, input.userId],
    ))[0];
    if (!row) return null;
    let refreshToken: string | undefined;
    if (config) {
      try {
        refreshToken = decryptRefreshToken({
          ciphertext: Buffer.from(row.refresh_ciphertext), keyVersion: row.key_version,
          nonce: Buffer.from(row.refresh_nonce), tag: Buffer.from(row.refresh_tag),
        }, tokenContext(row), config);
      } catch { refreshToken = undefined; }
    }
    await query(
      `update job_campaigns set status='paused',updated_at=now()
       where user_id=$1 and pinned_connection_id=$2 and status='active'`, [input.userId, row.id],
    );
    await query(
      `update application_mail_attempts set status='canceled',provider_call_started_at=null,retry_not_before=null,
         terminal_at=now(),updated_at=now()
       where user_id=$1 and connection_id=$2 and status in ('queued','reserved','retryable','needs_user')`,
      [input.userId, row.id],
    );
    await query(
      `update application_packages set status='stale',updated_at=now()
       where user_id=$1 and connection_id=$2 and status in ('preparing','review_required','ready')`,
      [input.userId, row.id],
    );
    await query(
      `update package_approvals a set status='invalidated',invalidated_at=now()
       from application_packages p where a.package_id=p.id and a.user_id=$1
         and p.connection_id=$2 and a.status='active'`,
      [input.userId, row.id],
    );
    await query(
      `update email_connections set status='disabled',refresh_ciphertext=null,key_version=null,
         refresh_nonce=null,refresh_tag=null,disabled_at=now(),updated_at=now()
       where id=$1 and user_id=$2`, [row.id, input.userId],
    );
    return { provider: row.provider, refreshToken };
  });
}

export async function recordRevocationResult(connectionId: string, userId: string, result: string) {
  await q(
    "update email_connections set revocation_result=$3,updated_at=now() where id=$1 and user_id=$2 and status='disabled'",
    [connectionId, userId, result.slice(0, 256)],
  );
}
