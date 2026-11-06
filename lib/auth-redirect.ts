// Where a login with no explicit `next` lands. The workspace, not a tool: a
// returning user wants their resumes and usage, and /build gave them a blank
// form with no way back to either.
export const DEFAULT_AUTH_DESTINATION = "/dashboard";

const INTERNAL_REDIRECT_BASE = "https://rolesharp.invalid";
const MAX_INTERNAL_PATH_LENGTH = 2_048;

export function safeInternalPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_DESTINATION,
) {
  if (!value || value.length > MAX_INTERNAL_PATH_LENGTH) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  if (/[\u0000-\u001F\u007F]/u.test(value)) return fallback;

  try {
    const parsed = new URL(value, INTERNAL_REDIRECT_BASE);
    if (parsed.origin !== INTERNAL_REDIRECT_BASE) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
