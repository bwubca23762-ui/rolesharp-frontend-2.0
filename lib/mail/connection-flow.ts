import {
  jobsWorkflowConfig,
  requireMailboxProviderConfiguration,
  type JobsWorkflowConfig,
} from "../jobs-workflow/config";
import { requireActiveFeatureAccess, type FeatureAccessKey } from "../feature-access";
import { disconnectMailboxConnection, recordRevocationResult, saveMailboxConnection } from "./connections";
import { beginOAuthTransaction, consumeOAuthTransaction } from "./oauth-transaction";
import { MAIL_PROVIDER_POLICY, providerAuthorizationUrl } from "./provider-policy";
import { exchangeGoogleAuthorization, exchangeMicrosoftAuthorization, safeProviderFailure } from "./providers";
import type { MailProvider } from "./token-crypto";
import { deadlineSignal, PROVIDER_REQUEST_TIMEOUT_MS } from "../request-deadline";
import { requireCurrentLegalAcceptance } from "../legal";

function providerFeature(provider: MailProvider): FeatureAccessKey {
  return provider === "google" ? "role_apply_gmail" : "role_apply_microsoft";
}

export async function beginMailboxAuthorization(input: {
  userId: string; provider: MailProvider; sessionBinding: string; promptConsent?: boolean;
  config?: JobsWorkflowConfig;
}) {
  await requireCurrentLegalAcceptance(input.userId);
  await requireActiveFeatureAccess(input.userId, providerFeature(input.provider));
  const config = input.config ?? jobsWorkflowConfig();
  const provider = requireMailboxProviderConfiguration(input.provider, config);
  const material = await beginOAuthTransaction({
    userId: input.userId, provider: input.provider, sessionBinding: input.sessionBinding,
    redirectUri: provider.redirectUri, config,
  });
  return {
    authorizationUrl: providerAuthorizationUrl(input.provider, {
      clientId: provider.clientId, redirectUri: provider.redirectUri,
      state: material.state, nonce: material.nonce, codeChallenge: material.codeChallenge,
      promptConsent: input.promptConsent,
    }),
    expiresInSeconds: 600,
  };
}

export async function completeMailboxAuthorization(input: {
  userId: string; provider: MailProvider; sessionBinding: string; state: string; code: string;
  config?: JobsWorkflowConfig; fetchImpl?: typeof fetch;
}) {
  await requireCurrentLegalAcceptance(input.userId);
  await requireActiveFeatureAccess(input.userId, providerFeature(input.provider));
  const config = input.config ?? jobsWorkflowConfig();
  const provider = requireMailboxProviderConfiguration(input.provider, config);
  const transaction = await consumeOAuthTransaction({
    userId: input.userId, provider: input.provider, sessionBinding: input.sessionBinding,
    state: input.state, redirectUri: provider.redirectUri, config,
  });
  const exchange = input.provider === "google"
    ? await exchangeGoogleAuthorization({
      code: input.code, codeVerifier: transaction.codeVerifier,
      nonceHash: transaction.nonceHash, config, fetchImpl: input.fetchImpl,
    })
    : await exchangeMicrosoftAuthorization({
      code: input.code, codeVerifier: transaction.codeVerifier,
      nonceHash: transaction.nonceHash, config, fetchImpl: input.fetchImpl,
    });
  return saveMailboxConnection(input.userId, exchange, config);
}

export async function disconnectAndRevokeMailbox(input: {
  userId: string; connectionId: string; config?: JobsWorkflowConfig; fetchImpl?: typeof fetch;
}) {
  const disconnected = await disconnectMailboxConnection(input);
  if (!disconnected) return false;
  let result = "local_credentials_erased";
  if (disconnected.provider === "google" && disconnected.refreshToken) {
    try {
      const response = await (input.fetchImpl ?? fetch)(MAIL_PROVIDER_POLICY.google.revocationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: disconnected.refreshToken }),
        signal: deadlineSignal(PROVIDER_REQUEST_TIMEOUT_MS),
      });
      result = response.ok ? "provider_revoked" : `provider_revoke_http_${response.status}`;
    } catch (error) {
      result = safeProviderFailure(error);
    }
  } else if (disconnected.provider === "microsoft") {
    result = "local_erasure_only_no_token_revocation_endpoint";
  } else {
    result = "local_credentials_erased_revocation_unavailable";
  }
  await recordRevocationResult(input.connectionId, input.userId, result);
  return true;
}
