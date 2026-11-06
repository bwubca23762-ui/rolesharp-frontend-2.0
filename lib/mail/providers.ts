import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import type { JobsWorkflowConfig } from "../jobs-workflow/config";
import { safeErrorMessage } from "./redaction";
import { oauthNonceMatches } from "./oauth-transaction";
import { MAIL_PROVIDER_POLICY, validateProviderScopes } from "./provider-policy";
import type { MailProvider } from "./token-crypto";
import { deadlineSignal, PROVIDER_REQUEST_TIMEOUT_MS } from "../request-deadline";

const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1),
  scope: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
}).passthrough();

const MicrosoftMe = z.object({
  id: z.string().min(1).max(256),
  mail: z.string().email().nullable().optional(),
}).passthrough();

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const microsoftJwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export type AuthorizationExchange = {
  provider: MailProvider;
  tenant: string;
  subject: string;
  verifiedSender: string;
  scopes: readonly string[];
  refreshToken?: string;
};

async function responseJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`provider_http_${response.status}`);
  return response.json().catch(() => { throw new Error("provider_invalid_json"); });
}

export async function exchangeGoogleAuthorization(input: {
  code: string; codeVerifier: string; nonceHash: string; config: JobsWorkflowConfig;
  fetchImpl?: typeof fetch;
  jwkSet?: JWTVerifyGetKey;
}): Promise<AuthorizationExchange> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(MAIL_PROVIDER_POLICY.google.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      code_verifier: input.codeVerifier,
      client_id: input.config.gmail.clientId,
      client_secret: input.config.gmail.clientSecret,
      redirect_uri: input.config.gmail.redirectUri,
      grant_type: "authorization_code",
    }),
    signal: deadlineSignal(PROVIDER_REQUEST_TIMEOUT_MS),
  });
  const token = TokenResponse.parse(await responseJson(response));
  const verified = await jwtVerify(token.id_token, input.jwkSet ?? googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: input.config.gmail.clientId,
    clockTolerance: 5,
  });
  const { nonce, sub, email, email_verified: emailVerified } = verified.payload;
  if (typeof nonce !== "string" || !oauthNonceMatches(input.nonceHash, nonce)) throw new Error("oauth_nonce_mismatch");
  if (typeof sub !== "string" || !sub || typeof email !== "string" || emailVerified !== true) {
    throw new Error("google_identity_unverified");
  }
  return {
    provider: "google", tenant: "google", subject: sub,
    verifiedSender: z.string().email().parse(email).toLocaleLowerCase("en"),
    scopes: validateProviderScopes("google", token.scope), refreshToken: token.refresh_token,
  };
}

export async function exchangeMicrosoftAuthorization(input: {
  code: string; codeVerifier: string; nonceHash: string; config: JobsWorkflowConfig;
  fetchImpl?: typeof fetch;
  jwkSet?: JWTVerifyGetKey;
}): Promise<AuthorizationExchange> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(MAIL_PROVIDER_POLICY.microsoft.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      code_verifier: input.codeVerifier,
      client_id: input.config.microsoft.clientId,
      client_secret: input.config.microsoft.clientSecret,
      redirect_uri: input.config.microsoft.redirectUri,
      grant_type: "authorization_code",
      scope: MAIL_PROVIDER_POLICY.microsoft.requiredScopes.join(" "),
    }),
    signal: deadlineSignal(PROVIDER_REQUEST_TIMEOUT_MS),
  });
  const token = TokenResponse.parse(await responseJson(response));
  let unverified: ReturnType<typeof decodeJwt>;
  try { unverified = decodeJwt(token.id_token); } catch { throw new Error("microsoft_invalid_id_token"); }
  const tenant = typeof unverified.tid === "string" ? unverified.tid.toLocaleLowerCase("en") : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(tenant)) {
    throw new Error("microsoft_invalid_tenant");
  }
  let jwks = microsoftJwks.get(tenant);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`));
    microsoftJwks.set(tenant, jwks);
  }
  const verified = await jwtVerify(token.id_token, input.jwkSet ?? jwks, {
    issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
    audience: input.config.microsoft.clientId,
    clockTolerance: 5,
  });
  if (typeof verified.payload.nonce !== "string" || !oauthNonceMatches(input.nonceHash, verified.payload.nonce)) {
    throw new Error("oauth_nonce_mismatch");
  }
  if (verified.payload.tid !== tenant) throw new Error("microsoft_invalid_tenant");
  const meResponse = await fetchImpl(MAIL_PROVIDER_POLICY.microsoft.graphMeEndpoint, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: deadlineSignal(PROVIDER_REQUEST_TIMEOUT_MS),
  });
  const me = MicrosoftMe.parse(await responseJson(meResponse));
  const sender = me.mail?.toLocaleLowerCase("en");
  if (!sender) throw new Error("microsoft_sender_unavailable");
  return {
    provider: "microsoft", tenant, subject: me.id, verifiedSender: sender,
    scopes: validateProviderScopes("microsoft", token.scope), refreshToken: token.refresh_token,
  };
}

export function safeProviderFailure(error: unknown): string {
  const message = safeErrorMessage(error);
  return /^[a-z0-9_.:-]{1,120}$/iu.test(message) ? message : "provider_request_failed";
}
