const TOKEN_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~-]+/giu,
  /\bya29\.[A-Za-z0-9._~-]+/gu,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu,
  /((?:access|refresh|id)[_-]?token\s*[=:]\s*)[^\s,;]+/giu,
] as const;

export function redactSecretText(value: string): string {
  return TOKEN_PATTERNS.reduce((current, pattern) => current.replace(pattern, (match, prefix?: string) =>
    prefix ? `${prefix}[REDACTED]` : "[REDACTED]"), value);
}

export function safeErrorMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return redactSecretText(value).slice(0, 500);
}
