import { q } from "./db";
import { env } from "./env";

// Owner-editable usage limits, stored in admin_settings and read on the hot
// entitlement path. Env vars stay authoritative as fallback and as the
// validation bound source; a 60s in-process cache keeps the DB hit off
// effectively every request.
export type UsageLimits = {
  freeMonthly: number;
  premiumMonthly: number;
  studentMonthly: number;
};

const SETTINGS_KEY = "usage_limits";
const CACHE_TTL_MS = 60_000;
let cache: { expiresAt: number; limits: UsageLimits } | null = null;

export function envUsageLimits(): UsageLimits {
  return {
    freeMonthly: env.freeMonthlyLimit,
    premiumMonthly: env.premiumMonthlyLimit,
    studentMonthly: env.studentMonthlyLimit,
  };
}

function clampLimit(value: unknown, fallback: number, min: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(10_000, Math.max(min, n));
}

export function sanitizeUsageLimits(input: unknown, fallback: UsageLimits = envUsageLimits()): UsageLimits {
  const value = (input ?? {}) as Record<string, unknown>;
  return {
    freeMonthly: clampLimit(value.freeMonthly, fallback.freeMonthly, 0),
    premiumMonthly: clampLimit(value.premiumMonthly, fallback.premiumMonthly, 1),
    studentMonthly: clampLimit(value.studentMonthly, fallback.studentMonthly, 1),
  };
}

export async function getUsageLimits(): Promise<UsageLimits> {
  if (cache && cache.expiresAt > Date.now()) return cache.limits;
  const fallback = envUsageLimits();
  try {
    const row = (await q<{ value: unknown }>(
      "select value from admin_settings where key=$1",
      [SETTINGS_KEY],
    ))[0];
    const limits = sanitizeUsageLimits(row?.value, fallback);
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, limits };
    return limits;
  } catch {
    // Table missing (migration not applied yet) or DB hiccup — env wins.
    return fallback;
  }
}

export async function setUsageLimits(limits: UsageLimits, updatedBy: string | null): Promise<void> {
  await q(
    `insert into admin_settings (key, value, updated_at, updated_by)
     values ($1, $2::jsonb, now(), $3)
     on conflict (key) do update
       set value=excluded.value, updated_at=now(), updated_by=excluded.updated_by`,
    [SETTINGS_KEY, JSON.stringify(limits), updatedBy],
  );
  cache = { expiresAt: Date.now() + CACHE_TTL_MS, limits };
}

export async function usageLimitsMeta(): Promise<{ updatedAt: string | null; updatedBy: string | null; overridden: boolean }> {
  try {
    const row = (await q<{ value: unknown; updated_at: string; updated_by: string | null }>(
      "select value, updated_at, updated_by from admin_settings where key=$1",
      [SETTINGS_KEY],
    ))[0];
    if (!row) return { updatedAt: null, updatedBy: null, overridden: false };
    const stored = sanitizeUsageLimits(row.value);
    const envLimits = envUsageLimits();
    const overridden = stored.freeMonthly !== envLimits.freeMonthly
      || stored.premiumMonthly !== envLimits.premiumMonthly
      || stored.studentMonthly !== envLimits.studentMonthly;
    return { updatedAt: row.updated_at, updatedBy: row.updated_by, overridden };
  } catch {
    return { updatedAt: null, updatedBy: null, overridden: false };
  }
}

/** Owner can clear the DB override, returning the platform to env-driven limits. */
export async function resetUsageLimits(): Promise<void> {
  await q("delete from admin_settings where key=$1", [SETTINGS_KEY]);
  cache = null;
}
