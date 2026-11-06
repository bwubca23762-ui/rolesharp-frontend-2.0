import { createSign, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { env } from "../env";

// Service-account → access token for Vertex AI, with zero new dependencies:
// a JWT assertion signed RS256 via node:crypto, exchanged at the standard
// oauth2 endpoint. The token is cached in memory until shortly before expiry.
// This module only ever runs server-side and only when GCP_VOICE_ENABLED is
// set with a key present (VOICE-INTERVIEW-PLAN §1.4).

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

let cachedAccount: ServiceAccount | null | undefined;
let cachedToken: { token: string; expiresAt: number } | null = null;
const TOKEN_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

function loadServiceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;
  cachedAccount = null;
  if (!env.gcpVoiceEnabled) return null;
  try {
    const raw = env.gcpServiceAccountFile
      ? readFileSync(env.gcpServiceAccountFile, "utf8")
      : env.gcpServiceAccountJson;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (parsed.client_email && parsed.private_key && parsed.project_id) {
      cachedAccount = { client_email: parsed.client_email, private_key: parsed.private_key, project_id: parsed.project_id };
    }
  } catch {
    cachedAccount = null;
  }
  return cachedAccount;
}

export function voiceConfigured(): boolean {
  return loadServiceAccount() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function buildAssertion(account: ServiceAccount, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: keyId(account.private_key) }));
  const payload = base64url(JSON.stringify({
    iss: account.client_email,
    scope: TOKEN_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3_600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign(account.private_key).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

// The kid header is optional for Google's token endpoint (it infers from the
// key), but pinning it makes key rotation observable in logs.
function keyId(privateKeyPem: string): string {
  // Derive a stable short id from the public key modulus — not the GCP key id,
  // just a deterministic tag so rotated keys are distinguishable in logs.
  return createHash("sha256").update(privateKeyPem).digest("base64url").slice(0, 12);
}

export async function getAccessToken(): Promise<string | null> {
  const account = loadServiceAccount();
  if (!account) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    signal: AbortSignal.timeout(15_000),
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: buildAssertion(account),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`gcp_token_exchange_failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

export function voiceProject(): string {
  return loadServiceAccount()?.project_id ?? env.gcpVoiceProject;
}
