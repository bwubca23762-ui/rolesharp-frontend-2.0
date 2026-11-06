const LINKEDIN_PROFILE_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-z0-9-_%]+\/?/i;

function ensureProtocol(value: string) {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function normalizeLinkedinUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  const clean = raw.replace(/^@+/, "").replace(/\s+/g, "");
  if (/linkedin\.com\//i.test(clean)) {
    return ensureProtocol(clean).replace(/\/+$/, "");
  }
  return `https://www.linkedin.com/in/${clean.replace(/^in\//i, "").replace(/^linkedin\.com\/in\//i, "").replace(/\/+$/, "")}`;
}

export function extractLinkedinUrl(text: string): string {
  const match = text.match(LINKEDIN_PROFILE_RE);
  return match ? normalizeLinkedinUrl(match[0]) : "";
}

export function hasLinkedinLink(links?: string[]): boolean {
  return (links ?? []).some((link) => /linkedin\.com\/in\//i.test(link));
}

function normalizeGenericLink(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  return ensureProtocol(raw).replace(/\/+$/, "");
}

export function buildContactLinks(linkedin: string, links: string[]): string[] {
  const merged = [
    linkedin ? normalizeLinkedinUrl(linkedin) : "",
    ...links.map((link) => /linkedin\.com\//i.test(link) ? normalizeLinkedinUrl(link) : normalizeGenericLink(link)),
  ].filter(Boolean);
  return [...new Set(merged)];
}
