const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
export const MAX_CUSTOM_ANALYTICS_RANGE_DAYS = 366;

export type AnalyticsRange = {
  from: string;
  to: string;
  days: number;
};

/**
 * A UTC day string offset from `now`. Every analytics bucket is a UTC day, so
 * the admin UI must build ranges in UTC too — local dates drift by one day for
 * any operator west of Greenwich.
 */
export function utcDayString(offsetDays = 0, now: Date = new Date()): string {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(midnight + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The last `days` UTC days, ending today. Both ends are inclusive to match
 * parseAnalyticsRange, so N days is an offset of N-1 — not N.
 */
export function lastDaysRange(days: number, now: Date = new Date()): { from: string; to: string } {
  if (!Number.isInteger(days) || days < 1) throw new Error("invalid_day_count");
  return { from: utcDayString(-(days - 1), now), to: utcDayString(0, now) };
}

export function parseAnalyticsRange(
  from: string | null,
  to: string | null,
): AnalyticsRange | null {
  if (!from && !to) return null;
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    throw new Error("invalid_date_range");
  }
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
    throw new Error("invalid_date_range");
  }
  const days = Math.floor((toMs - fromMs) / 86_400_000) + 1;
  if (days > MAX_CUSTOM_ANALYTICS_RANGE_DAYS) {
    throw new Error("date_range_too_large");
  }
  return { from, to, days };
}
