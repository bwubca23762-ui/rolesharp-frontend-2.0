import type { NotificationItem } from "./notifications";

export type NotificationSummary = { unreadCount: number; banner: NotificationItem | null };

/**
 * Single-flight wrapper around /api/notifications/count.
 *
 * NotificationBell and NotificationCenter are both mounted app-wide in
 * app-shell.tsx and both need this endpoint — the bell reads unreadCount, the
 * banner reads banner — so every page load by a logged-in user fired the same
 * request twice, and each one costs an auth check plus two database queries.
 * They mount in the same tick, so sharing the in-flight promise collapses them
 * into one request without any caching policy to get wrong.
 *
 * Deliberately not a cache: the promise is released as soon as it settles, so a
 * later call after a read/archive still refetches and the count stays truthful.
 */
let inFlight: Promise<NotificationSummary | null> | null = null;

export function fetchNotificationSummary(): Promise<NotificationSummary | null> {
  if (inFlight) return inFlight;
  inFlight = fetch("/api/notifications/count", { cache: "no-store" })
    .then((response) => (response.ok ? response.json().catch(() => null) : null))
    .catch(() => null)
    .finally(() => { inFlight = null; });
  return inFlight;
}
