export const ADMIN_LIST_PAGE_SIZE_MAX = 100;
export const ADMIN_EXPORT_PAGE_SIZE_MAX = 1_000;
export const ADMIN_SEARCH_LENGTH_MAX = 100;

export function boundedPage(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(10_000, Math.max(1, Math.trunc(parsed))) : 1;
}

export function boundedPageSize(
  raw: string | null,
  fallback = 20,
  maximum = ADMIN_LIST_PAGE_SIZE_MAX,
): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(maximum, Math.max(1, value));
}

export function boundedSearch(raw: string | null): string {
  return (raw ?? "").trim().slice(0, ADMIN_SEARCH_LENGTH_MAX);
}

export function containsLikePattern(value: string): string {
  return `%${value.replace(/[\\%_]/gu, "\\$&")}%`;
}
