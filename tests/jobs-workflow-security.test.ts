import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { createLocalJWKSet, exportJWK, SignJWT } from "jose";
import { loadJobsWorkflowConfig, requireMailboxProviderConfiguration } from "../lib/jobs-workflow/config";
import { isAllowedFeatureFlag } from "../lib/jobs-workflow/flags";
import { attachmentBytesMatch } from "../lib/mail/dispatch";
import { createOAuthTransactionMaterial, oauthNonceMatches } from "../lib/mail/oauth-transaction";
import { providerAuthorizationUrl, validateProviderScopes } from "../lib/mail/provider-policy";
import { exchangeGoogleAuthorization, exchangeMicrosoftAuthorization } from "../lib/mail/providers";
import { redactSecretText, safeErrorMessage } from "../lib/mail/redaction";
import { decryptRefreshToken, encryptRefreshToken, rotateRefreshToken, type MailTokenContext } from "../lib/mail/token-crypto";

const key1 = Buffer.alloc(32, 0x11).toString("base64");
const key2 = Buffer.alloc(32, 0x22).toString("base64");

function config(active = 1) {
  return loadJobsWorkflowConfig({
    NODE_ENV: "test",
    JOBS_WORKFLOWS_ENABLED: "true",
    MAIL_TOKEN_KEYS: `1:${key1},2:${key2}`,
    MAIL_TOKEN_ACTIVE_KEY_VERSION: String(active),
    MAIL_CALLBACK_ORIGINS: "https://rolesharp.test",
    GMAIL_CONNECTION_CLIENT_ID: "gmail-client",
    GMAIL_CONNECTION_CLIENT_SECRET: "gmail-secret",
    GMAIL_CONNECTION_REDIRECT_URI: "https://rolesharp.test/api/mail-connections/google/callback",
    MICROSOFT_CONNECTION_CLIENT_ID: "microsoft-client",
    MICROSOFT_CONNECTION_CLIENT_SECRET: "microsoft-secret",
    MICROSOFT_CONNECTION_REDIRECT_URI: "https://rolesharp.test/api/mail-connections/microsoft/callback",
  });
}

const context: MailTokenContext = {
  userId: "10000000-0000-4000-8000-000000000001",
  connectionId: "20000000-0000-4000-8000-000000000001",
  provider: "google",
  providerTenant: "google",
  providerSubject: "subject-one",
  connectionGeneration: 1,
};

test("mail refresh credentials authenticate their row context and rotate keys", () => {
  const encrypted = encryptRefreshToken("refresh-secret-value", context, config(1));
  assert.equal(encrypted.keyVersion, 1);
  assert.equal(decryptRefreshToken(encrypted, context, config(1)), "refresh-secret-value");

  assert.throws(() => decryptRefreshToken(encrypted, { ...context, connectionId: "swapped-row" }, config(1)));
  const tampered = { ...encrypted, tag: Buffer.from(encrypted.tag) };
  tampered.tag[0] ^= 0xff;
  assert.throws(() => decryptRefreshToken(tampered, context, config(1)));

  const rotated = rotateRefreshToken(encrypted, context, config(2));
  assert.equal(rotated.keyVersion, 2);
  assert.equal(decryptRefreshToken(rotated, context, config(2)), "refresh-secret-value");
});

test("mail dispatch authenticates immutable attachment bytes before provider access", () => {
  const original = Buffer.from("synthetic-pdf-bytes");
  const expected = createHash("sha256").update(original).digest("hex");
  assert.equal(attachmentBytesMatch(original, expected), true);
  assert.equal(attachmentBytesMatch(Buffer.from("changed-pdf-bytes"), expected), false);
  assert.equal(attachmentBytesMatch(original, "not-a-sha256"), false);
});

test("configuration is strict, callback-bound, and fails closed for enabled production providers", () => {
  const loaded = config();
  assert.equal(loaded.applicationEmailFitFloor, 85);
  assert.equal(loaded.applicationEmailConfidenceFloor, 80);
  assert.deepEqual(loaded.callbackOrigins, ["https://rolesharp.test"]);
  assert.throws(() => loadJobsWorkflowConfig({
    NODE_ENV: "production",
    JOBS_WORKFLOWS_ENABLED: "true",
    ROLE_APPLY_GMAIL_SEND_ENABLED: "true",
  }));
  assert.throws(() => loadJobsWorkflowConfig({
    NODE_ENV: "test",
    APPLICATION_EMAIL_FIT_FLOOR: "84",
    APPLICATION_EMAIL_CONFIDENCE_FLOOR: "80",
  }));
  assert.throws(() => loadJobsWorkflowConfig({
    NODE_ENV: "test",
    MAIL_CALLBACK_ORIGINS: "https://rolesharp.test",
    GMAIL_CONNECTION_REDIRECT_URI: "https://attacker.test/callback",
  }));
  const unconfigured = loadJobsWorkflowConfig({ NODE_ENV: "test" });
  assert.throws(() => requireMailboxProviderConfiguration("google", unconfigured), /mailbox_provider_not_configured/u);
  assert.throws(() => requireMailboxProviderConfiguration("microsoft", unconfigured), /mailbox_provider_not_configured/u);
  assert.equal(requireMailboxProviderConfiguration("google", loaded).configured, true);
});

test("OAuth material uses PKCE-S256 and nonce binding without serializing secrets", () => {
  const first = createOAuthTransactionMaterial();
  const second = createOAuthTransactionMaterial();
  assert.notEqual(first.state, second.state);
  assert.notEqual(first.nonce, second.nonce);
  assert.match(first.codeVerifier, /^[A-Za-z0-9_-]{43,128}$/u);
  assert.match(first.codeChallenge, /^[A-Za-z0-9_-]{43}$/u);

  const nonceHash = createHash("sha256")
    .update(`rolesharp-oauth-nonce-v1\0${first.nonce}`, "utf8").digest("hex");
  assert.equal(oauthNonceMatches(nonceHash, first.nonce), true);
  assert.equal(oauthNonceMatches(nonceHash, second.nonce), false);
});

test("provider policy permits send-only scopes and constructs bound authorization URLs", () => {
  assert.deepEqual(validateProviderScopes("google", [
    "email", "openid", "https://www.googleapis.com/auth/gmail.send",
  ]), ["email", "https://www.googleapis.com/auth/gmail.send", "openid"]);
  assert.throws(() => validateProviderScopes("google", [
    "email", "openid", "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
  ]));
  assert.throws(() => validateProviderScopes("microsoft", ["openid", "offline_access", "User.Read"]));

  const url = new URL(providerAuthorizationUrl("google", {
    clientId: "client", redirectUri: "https://rolesharp.test/callback",
    state: "state", nonce: "nonce", codeChallenge: "challenge",
  }));
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("scope"), "openid email https://www.googleapis.com/auth/gmail.send");
});

test("redaction and feature flag allowlists fail closed", () => {
  const value = "Bearer abc.def refresh_token=ya29.refresh access-token: eyJhbGciOiJIUzI1NiJ9.e30.signature";
  const redacted = redactSecretText(value);
  assert.doesNotMatch(redacted, /abc\.def|ya29\.refresh|eyJhbGci/u);
  assert.doesNotMatch(safeErrorMessage(new Error(value)), /abc\.def|ya29\.refresh|eyJhbGci/u);
  assert.equal(isAllowedFeatureFlag("role_apply_gmail_send"), true);
  assert.equal(isAllowedFeatureFlag("attacker_created_flag"), false);
});

test("in-process provider fakes validate signed Gmail and Microsoft identities without network", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "fixture-key";
  publicJwk.alg = "RS256";
  const jwkSet = createLocalJWKSet({ keys: [publicJwk] });
  const nonce = "fixture-nonce-value";
  const nonceHash = createHash("sha256")
    .update(`rolesharp-oauth-nonce-v1\0${nonce}`, "utf8").digest("hex");
  const googleToken = await new SignJWT({
    nonce, sub: "google-subject", email: "sender@example.test", email_verified: true,
  }).setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
    .setIssuer("https://accounts.google.com").setAudience("gmail-client")
    .setIssuedAt().setExpirationTime("5m").sign(privateKey);
  const googleCalls: string[] = [];
  const google = await exchangeGoogleAuthorization({
    code: "synthetic-code", codeVerifier: "synthetic-verifier", nonceHash,
    config: config(), jwkSet,
    fetchImpl: async (request) => {
      googleCalls.push(String(request));
      return new Response(JSON.stringify({
        access_token: "synthetic-access", refresh_token: "synthetic-refresh",
        id_token: googleToken,
        scope: "openid email https://www.googleapis.com/auth/gmail.send",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.deepEqual({ tenant: google.tenant, subject: google.subject, sender: google.verifiedSender }, {
    tenant: "google", subject: "google-subject", sender: "sender@example.test",
  });
  assert.deepEqual(googleCalls, ["https://oauth2.googleapis.com/token"]);

  const tenant = "11111111-2222-4333-8444-555555555555";
  const microsoftToken = await new SignJWT({ nonce, tid: tenant, sub: "microsoft-token-subject" })
    .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
    .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`).setAudience("microsoft-client")
    .setIssuedAt().setExpirationTime("5m").sign(privateKey);
  const microsoftFetch = (mail: string | null, calls: string[]) => async (request: URL | RequestInfo) => {
    const url = String(request);
    calls.push(url);
    if (url.includes("oauth2/v2.0/token")) return new Response(JSON.stringify({
      access_token: "synthetic-access", refresh_token: "synthetic-refresh",
      id_token: microsoftToken, scope: "openid offline_access User.Read Mail.Send",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("graph.microsoft.com")) return new Response(JSON.stringify({
      id: "graph-me-id", mail, userPrincipalName: "must-not-be-used@example.test",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    throw new Error(`unexpected_fake_request:${url}`);
  };
  const microsoftCalls: string[] = [];
  const microsoft = await exchangeMicrosoftAuthorization({
    code: "synthetic-code", codeVerifier: "synthetic-verifier", nonceHash,
    config: config(), jwkSet, fetchImpl: microsoftFetch("outlook@example.test", microsoftCalls) as typeof fetch,
  });
  assert.deepEqual({ tenant: microsoft.tenant, subject: microsoft.subject, sender: microsoft.verifiedSender }, {
    tenant, subject: "graph-me-id", sender: "outlook@example.test",
  });
  assert.match(microsoftCalls[1] ?? "", /\?\$select=id,mail$/u);
  await assert.rejects(exchangeMicrosoftAuthorization({
    code: "synthetic-code", codeVerifier: "synthetic-verifier", nonceHash,
    config: config(), jwkSet, fetchImpl: microsoftFetch(null, []) as typeof fetch,
  }), /microsoft_sender_unavailable/u);
});
