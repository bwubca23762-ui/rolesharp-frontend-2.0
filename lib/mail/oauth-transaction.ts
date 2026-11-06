import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { q, withTransaction, type TransactionQuery } from "../db";
import { jobsWorkflowConfig, type JobsWorkflowConfig } from "../jobs-workflow/config";
import { decryptSecret, encryptSecret, type MailProvider } from "./token-crypto";

const TEN_MINUTES_MS = 10 * 60 * 1000;

type OAuthTransactionRow = {
  id: string;
  user_id: string;
  provider: MailProvider;
  session_hash: string;
  state_hash: string;
  nonce_hash: string;
  pkce_ciphertext: Buffer;
  pkce_key_version: number;
  pkce_nonce: Buffer;
  pkce_tag: Buffer;
  redirect_uri: string;
  expires_at: string | Date;
};

export type OAuthTransactionMaterial = {
  transactionId: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
};

export class OAuthTransactionError extends Error {
  constructor(public readonly code:
    | "oauth_configuration"
    | "oauth_redirect"
    | "oauth_state"
    | "oauth_replay"
    | "oauth_session"
    | "oauth_expired") {
    super(code);
    this.name = "OAuthTransactionError";
  }
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function digest(kind: "session" | "state" | "nonce", value: string): string {
  return createHash("sha256").update(`rolesharp-oauth-${kind}-v1\0${value}`, "utf8").digest("hex");
}

function equalDigest(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function transactionAad(id: string, userId: string, provider: MailProvider, redirectUri: string): string {
  return `rolesharp-oauth-pkce-v1|transaction=${id}|user=${userId}|provider=${provider}|redirect=${redirectUri}`;
}

function providerConfig(provider: MailProvider, config: JobsWorkflowConfig) {
  return provider === "google" ? config.gmail : config.microsoft;
}

function assertRedirect(provider: MailProvider, redirectUri: string, config: JobsWorkflowConfig): void {
  const expected = providerConfig(provider, config).redirectUri;
  if (!expected || redirectUri !== expected) throw new OAuthTransactionError("oauth_redirect");
  let origin: string;
  try {
    origin = new URL(redirectUri).origin;
  } catch {
    throw new OAuthTransactionError("oauth_redirect");
  }
  if (!config.callbackOrigins.includes(origin)) throw new OAuthTransactionError("oauth_redirect");
}

export function createOAuthTransactionMaterial(): OAuthTransactionMaterial {
  const codeVerifier = base64url(randomBytes(48));
  return {
    transactionId: randomUUID(),
    state: base64url(randomBytes(32)),
    nonce: base64url(randomBytes(32)),
    codeVerifier,
    codeChallenge: createHash("sha256").update(codeVerifier, "ascii").digest("base64url"),
  };
}

export async function beginOAuthTransaction(input: {
  userId: string;
  provider: MailProvider;
  sessionBinding: string;
  redirectUri: string;
  now?: Date;
  config?: JobsWorkflowConfig;
}): Promise<OAuthTransactionMaterial> {
  const config = input.config ?? jobsWorkflowConfig();
  const provider = providerConfig(input.provider, config);
  if (!config.workflowsEnabled || !provider.configured || config.activeKeyVersion <= 0) {
    throw new OAuthTransactionError("oauth_configuration");
  }
  assertRedirect(input.provider, input.redirectUri, config);
  if (!input.userId || !input.sessionBinding) throw new OAuthTransactionError("oauth_session");
  const material = createOAuthTransactionMaterial();
  const aad = transactionAad(material.transactionId, input.userId, input.provider, input.redirectUri);
  const encrypted = encryptSecret(material.codeVerifier, aad, config);
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + TEN_MINUTES_MS);
  await q(
    `insert into oauth_transactions(
       id,user_id,provider,session_hash,state_hash,nonce_hash,
       pkce_ciphertext,pkce_key_version,pkce_nonce,pkce_tag,
       redirect_uri,created_at,expires_at
     ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [material.transactionId, input.userId, input.provider, digest("session", input.sessionBinding),
      digest("state", material.state), digest("nonce", material.nonce), encrypted.ciphertext,
      encrypted.keyVersion, encrypted.nonce, encrypted.tag, input.redirectUri, now, expiresAt],
  );
  return material;
}

type ConsumeResult =
  | { ok: true; codeVerifier: string; nonceHash: string; transactionId: string }
  | { ok: false; code: OAuthTransactionError["code"] };

async function consumeWithQuery(query: TransactionQuery, input: {
  userId: string;
  provider: MailProvider;
  sessionBinding: string;
  state: string;
  redirectUri: string;
  now: Date;
  config: JobsWorkflowConfig;
}): Promise<ConsumeResult> {
  const stateHash = digest("state", input.state);
  const rows = await query<OAuthTransactionRow>(
    "select * from oauth_transactions where state_hash=$1 for update",
    [stateHash],
  );
  const row = rows[0];
  if (!row) {
    const tombstone = await query<{ present: boolean }>(
      "select true present from oauth_state_tombstones where state_hash=$1 and retain_until>$2",
      [stateHash, input.now],
    );
    return { ok: false, code: tombstone[0] ? "oauth_replay" : "oauth_state" };
  }
  const expiresAt = new Date(row.expires_at);
  if (input.now.getTime() > expiresAt.getTime()) {
    await query("select retire_oauth_transaction($1,'expired')", [row.id]);
    return { ok: false, code: "oauth_expired" };
  }
  if (row.user_id !== input.userId || row.provider !== input.provider ||
      !equalDigest(row.session_hash, digest("session", input.sessionBinding))) {
    return { ok: false, code: "oauth_session" };
  }
  if (row.redirect_uri !== input.redirectUri) return { ok: false, code: "oauth_redirect" };
  const aad = transactionAad(row.id, row.user_id, row.provider, row.redirect_uri);
  const codeVerifier = decryptSecret({
    ciphertext: Buffer.from(row.pkce_ciphertext),
    nonce: Buffer.from(row.pkce_nonce),
    tag: Buffer.from(row.pkce_tag),
    keyVersion: row.pkce_key_version,
  }, aad, input.config);
  const retired = await query<{ retire_oauth_transaction: number }>(
    "select retire_oauth_transaction($1,'consumed')",
    [row.id],
  );
  if (Number(retired[0]?.retire_oauth_transaction) !== 1) return { ok: false, code: "oauth_replay" };
  return { ok: true, codeVerifier, nonceHash: row.nonce_hash, transactionId: row.id };
}

export async function consumeOAuthTransaction(input: {
  userId: string;
  provider: MailProvider;
  sessionBinding: string;
  state: string;
  redirectUri: string;
  now?: Date;
  config?: JobsWorkflowConfig;
}): Promise<{ codeVerifier: string; nonceHash: string; transactionId: string }> {
  const config = input.config ?? jobsWorkflowConfig();
  assertRedirect(input.provider, input.redirectUri, config);
  const result = await withTransaction((query) => consumeWithQuery(query, {
    ...input,
    now: input.now ?? new Date(),
    config,
  }));
  if (!result.ok) throw new OAuthTransactionError(result.code);
  return result;
}

export function oauthNonceMatches(nonceHash: string, nonce: string): boolean {
  return /^[0-9a-f]{64}$/u.test(nonceHash) && equalDigest(nonceHash, digest("nonce", nonce));
}

export async function cleanupOAuthTransactions(now = new Date()): Promise<{ expired: number; tombstones: number }> {
  const expiredRows = await q<{ id: string }>(
    "select id from oauth_transactions where status='pending' and expires_at<=$1 order by expires_at limit 500",
    [now],
  );
  let expired = 0;
  for (const row of expiredRows) {
    const result = await q<{ retire_oauth_transaction: number }>(
      "select retire_oauth_transaction($1,'expired')",
      [row.id],
    );
    expired += Number(result[0]?.retire_oauth_transaction ?? 0);
  }
  const purged = await q<{ purge_oauth_state_tombstones: number }>(
    "select purge_oauth_state_tombstones($1)",
    [now],
  );
  return { expired, tombstones: Number(purged[0]?.purge_oauth_state_tombstones ?? 0) };
}
