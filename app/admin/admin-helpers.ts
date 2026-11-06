// Shared admin formatting helpers.
// Provenance: extracted from app/admin/admin-panel.tsx during Phase 6 monolith refactor.

export function formatBytes(n: number) {
  if (!Number.isFinite(n)) return "-";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = n, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} ${u[i]}`;
}

export function formatMs(n: number) {
  if (!n) return "-";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`;
}

export function formatPct(n: number) {
  if (!Number.isFinite(n)) return "-";
  return `${Math.round(n)}%`;
}

export function formatDuration(sec: number) {
  if (!sec) return "-";
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

export function timeAgo(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString();
}

// Universal admin fetch: reads the body as TEXT first so an empty body, an
// HTML error page, or a 403/500 can never crash `res.json()` inside a click
// handler. Returns a structured result — callers check `ok` and read
// `data`/`error` without try/catch gymnastics.
export type AdminFetchResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string;
};

export async function adminFetchJson<T = Record<string, unknown>>(
  input: string,
  init?: RequestInit,
): Promise<AdminFetchResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, { credentials: "same-origin", ...init });
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error." };
  }
  const text = await response.text().catch(() => "");
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  const message =
    data && typeof data === "object" && "error" in (data as Record<string, unknown>)
      ? String((data as Record<string, unknown>).error)
      : "";
  return {
    ok: response.ok,
    status: response.status,
    data: (data as T) ?? null,
    error: response.ok ? "" : message || `Request failed (status ${response.status}).`,
  };
}
