import { withTransaction } from "../db";
import { jobsWorkflowConfig } from "./config";
import { decryptRefreshToken, type MailProvider } from "../mail/token-crypto";
import { MAIL_PROVIDER_POLICY } from "../mail/provider-policy";

type DeletionConnection = {
  id: string; user_id: string; provider: MailProvider; provider_tenant: string;
  provider_subject: string; connection_generation: number; refresh_ciphertext: Buffer;
  key_version: number; refresh_nonce: Buffer; refresh_tag: Buffer;
};

export async function beginAccountWorkflowDeletion(userId: string) {
  // Configuration or historical ciphertext corruption must never prevent the
  // durable local deletion barrier and credential erasure from committing.
  let config: ReturnType<typeof jobsWorkflowConfig> | undefined;
  try { config = jobsWorkflowConfig(); } catch { config = undefined; }
  return withTransaction(async (query) => {
    const rows = await query<DeletionConnection>(
      `select * from email_connections where user_id=$1 and status<>'disabled' for update`, [userId],
    );
    const revocations = config ? rows.flatMap((row) => {
      try {
        const refreshToken = decryptRefreshToken({
          ciphertext: Buffer.from(row.refresh_ciphertext), keyVersion: row.key_version,
          nonce: Buffer.from(row.refresh_nonce), tag: Buffer.from(row.refresh_tag),
        }, {
          userId: row.user_id, connectionId: row.id, provider: row.provider,
          providerTenant: row.provider_tenant, providerSubject: row.provider_subject,
          connectionGeneration: row.connection_generation,
        }, config);
        return [{ provider: row.provider, refreshToken }];
      } catch {
        return [];
      }
    }) : [];
    const barrier = await query<{ begin_user_workflow_deletion: number }>(
      "select begin_user_workflow_deletion($1)", [userId],
    );
    if (Number(barrier[0]?.begin_user_workflow_deletion) !== 1) throw new Error("account_unavailable");
    return revocations;
  });
}

export async function bestEffortAccountRevocations(
  revocations: readonly { provider: MailProvider; refreshToken: string }[],
  fetchImpl: typeof fetch = fetch,
) {
  await Promise.allSettled(revocations.map(async (item) => {
    if (item.provider !== "google") return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      await fetchImpl(MAIL_PROVIDER_POLICY.google.revocationEndpoint, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: item.refreshToken }), signal: controller.signal,
      });
    } finally { clearTimeout(timeout); }
  }));
}
