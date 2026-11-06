import type { NextRequest } from "next/server";
import { connection, redisDeadline } from "./queue";
import { trustedClientIp } from "./request-ip";

// nginx's real_ip module validates the immediate peer against Cloudflare's
// network list, then overwrites X-Real-IP with the resulting client address.
// Never trust CF-Connecting-IP directly in application code: direct-origin
// clients can forge it.
// Redis-backed fixed-window limiter (atomic INCR + EXPIRE). Shared across every
// app instance via the same Redis that backs the queue, so the limit holds
// under horizontal scale and survives cold starts. If Redis is unavailable we
// fall back to a bounded per-process limiter instead of silently disabling the
// security boundary.
type LocalBucket = { count: number; resetAt: number };
const localBuckets = new Map<string, LocalBucket>();
const MAX_LOCAL_BUCKETS = 10_000;

export function localRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: boolean; retryAfter: number } {
  const current = localBuckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;
  bucket.count += 1;
  localBuckets.set(key, bucket);

  // Prevent attacker-controlled IP/action combinations from growing memory
  // without bound. Expired buckets are removed first; if the map is still at
  // capacity, evict the oldest insertion.
  if (localBuckets.size > MAX_LOCAL_BUCKETS) {
    for (const [bucketKey, value] of localBuckets) {
      if (value.resetAt <= now) localBuckets.delete(bucketKey);
    }
    while (localBuckets.size > MAX_LOCAL_BUCKETS) {
      const oldest = localBuckets.keys().next().value as string | undefined;
      if (!oldest) break;
      localBuckets.delete(oldest);
    }
  }

  return bucket.count > limit
    ? { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
    : { ok: true, retryAfter: 0 };
}
export async function rateLimit(
  req: NextRequest,
  action: string,
  limit = 10,
  windowMs = 60_000,
): Promise<{ ok: boolean; retryAfter: number }> {
  const key = `rl:${action}:${trustedClientIp(req.headers)}`;
  const windowSec = Math.ceil(windowMs / 1000);
  try {
    // Deadlines, not bare awaits: see redisDeadline. Without them this catch —
    // and with it the whole local-fallback boundary below — is dead code the
    // moment Redis stops answering.
    //
    // INCR and EXPIRE were two round trips: a crash, failover, or dropped
    // connection between them left a counter with no TTL, which never resets
    // and locks that IP out of that action permanently. Redis runs a script
    // atomically, so the key can never exist without its expiry, and the TTL
    // needed for Retry-After comes back in the same call.
    const [n, ttl] = await redisDeadline(() => connection.eval(
      `local n = redis.call('INCR', KEYS[1])
       if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
       return {n, redis.call('TTL', KEYS[1])}`,
      1, key, String(windowSec),
    )) as [number, number];
    if (n > limit) return { ok: false, retryAfter: ttl > 0 ? ttl : windowSec };
    return { ok: true, retryAfter: 0 };
  } catch (e) {
    console.warn("rateLimit redis unavailable; using local fallback", e instanceof Error ? e.message : e);
    return localRateLimit(key, limit, windowMs);
  }
}
