import type { MailProvider } from "./token-crypto";

export const MAIL_PROVIDER_POLICY = {
  google: {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
    requiredScopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.send"],
    forbiddenScopes: [
      "https://mail.google.com/",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  },
  microsoft: {
    authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    graphMeEndpoint: "https://graph.microsoft.com/v1.0/me?$select=id,mail",
    requiredScopes: ["openid", "offline_access", "User.Read", "Mail.Send"],
    forbiddenScopes: ["Mail.Read", "Mail.ReadWrite"],
  },
} as const satisfies Record<MailProvider, {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  requiredScopes: readonly string[];
  forbiddenScopes: readonly string[];
  revocationEndpoint?: string;
  graphMeEndpoint?: string;
}>;

export function normalizeGrantedScopes(value: string | readonly string[]): readonly string[] {
  const scopes: readonly string[] = typeof value === "string" ? value.trim().split(/\s+/u) : value;
  return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))].sort();
}

export function validateProviderScopes(
  provider: MailProvider,
  granted: string | readonly string[],
): readonly string[] {
  const scopes = normalizeGrantedScopes(granted);
  const policy = MAIL_PROVIDER_POLICY[provider];
  const missing = policy.requiredScopes.filter((scope) => !scopes.includes(scope));
  const forbidden = policy.forbiddenScopes.filter((scope) => scopes.includes(scope));
  if (missing.length || forbidden.length) {
    throw new Error("mailbox_scope_policy_failed");
  }
  return scopes;
}

export function providerAuthorizationUrl(
  provider: MailProvider,
  input: {
    clientId: string;
    redirectUri: string;
    state: string;
    nonce: string;
    codeChallenge: string;
    promptConsent?: boolean;
  },
): string {
  const policy = MAIL_PROVIDER_POLICY[provider];
  const url = new URL(policy.authorizationEndpoint);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", policy.requiredScopes.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "false");
  }
  if (input.promptConsent) url.searchParams.set("prompt", "consent");
  return url.toString();
}
