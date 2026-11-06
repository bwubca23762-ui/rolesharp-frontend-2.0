export const PROVIDER_REQUEST_TIMEOUT_MS = 15_000;
export const LLM_REQUEST_TIMEOUT_MS = 90_000;

export function deadlineSignal(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
