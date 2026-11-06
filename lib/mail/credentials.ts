import { createHash, timingSafeEqual } from "node:crypto";
import { withTransaction } from "../db";
import { jobsWorkflowConfig, type JobsWorkflowConfig } from "../jobs-workflow/config";
import { decryptRefreshToken, encryptRefreshToken, type MailProvider, type MailTokenContext } from "./token-crypto";

type CredentialRow = {
  id: string;
  user_id: string;
  provider: MailProvider;
  provider_tenant: string;
  provider_subject: string;
  connection_generation: number;
  refresh_ciphertext: Buffer;
  key_version: number;
  refresh_nonce: Buffer;
  refresh_tag: Buffer;
  status: "active" | "needs_user" | "disabled";
};

function context(row: CredentialRow): MailTokenContext {
  return {
    userId: row.user_id,
    connectionId: row.id,
    provider: row.provider,
    providerTenant: row.provider_tenant,
    providerSubject: row.provider_subject,
    connectionGeneration: row.connection_generation,
  };
}

export function credentialFingerprint(ciphertext: Uint8Array): string {
  return createHash("sha256").update(ciphertext).digest("hex");
}

export async function readRefreshCredential(input: {
  connectionId: string;
  userId: string;
  config?: JobsWorkflowConfig;
}): Promise<{ token: string; generation: number; fingerprint: string; provider: MailProvider } | null> {
  const config = input.config ?? jobsWorkflowConfig();
  return withTransaction(async (query) => {
    const row = (await query<CredentialRow>(
      "select * from email_connections where id=$1 and user_id=$2 and status='active' for update",
      [input.connectionId, input.userId],
    ))[0];
    if (!row) return null;
    return {
      token: decryptRefreshToken({
        ciphertext: Buffer.from(row.refresh_ciphertext), nonce: Buffer.from(row.refresh_nonce),
        tag: Buffer.from(row.refresh_tag), keyVersion: row.key_version,
      }, context(row), config),
      generation: row.connection_generation,
      fingerprint: credentialFingerprint(row.refresh_ciphertext),
      provider: row.provider,
    };
  });
}

export async function compareAndSwapRefreshCredential(input: {
  connectionId: string;
  userId: string;
  expectedGeneration: number;
  expectedFingerprint: string;
  refreshToken: string;
  config?: JobsWorkflowConfig;
}): Promise<{ replaced: boolean; fingerprint?: string }> {
  const config = input.config ?? jobsWorkflowConfig();
  return withTransaction(async (query) => {
    const row = (await query<CredentialRow>(
      "select * from email_connections where id=$1 and user_id=$2 and status='active' for update",
      [input.connectionId, input.userId],
    ))[0];
    if (!row || row.connection_generation !== input.expectedGeneration) return { replaced: false };
    const actual = Buffer.from(credentialFingerprint(row.refresh_ciphertext), "hex");
    const expected = Buffer.from(input.expectedFingerprint, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { replaced: false };
    const encrypted = encryptRefreshToken(input.refreshToken, context(row), config);
    const updated = await query<{ refresh_ciphertext: Buffer }>(
      `update email_connections set refresh_ciphertext=$1,key_version=$2,refresh_nonce=$3,
         refresh_tag=$4,updated_at=now()
       where id=$5 and user_id=$6 and connection_generation=$7 and refresh_ciphertext=$8
       returning refresh_ciphertext`,
      [encrypted.ciphertext, encrypted.keyVersion, encrypted.nonce, encrypted.tag,
        row.id, row.user_id, row.connection_generation, row.refresh_ciphertext],
    );
    if (!updated[0]) return { replaced: false };
    return { replaced: true, fingerprint: credentialFingerprint(updated[0].refresh_ciphertext) };
  });
}
