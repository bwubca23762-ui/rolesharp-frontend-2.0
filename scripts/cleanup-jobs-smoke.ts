import assert from "node:assert/strict";
import IORedis from "ioredis";
import { assertFakeTransportIsIsolated } from "../lib/jobs-workflow/local-sink";

async function main(): Promise<void> {
  assertFakeTransportIsIsolated();
  const runId = process.env.JOBS_SMOKE_RUN_ID ?? "";
  const prefix = process.env.QUEUE_PREFIX ?? "";
  assert.equal(prefix, `rolesharp:smoke:${runId}:`);
  const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    commandTimeout: 2_000,
  });
  let removed = 0;
  try {
    await redis.connect();
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 200);
      cursor = next;
      if (keys.length) removed += await redis.unlink(...keys);
    } while (cursor !== "0");
    const remaining: string[] = [];
    cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 20);
      cursor = next;
      remaining.push(...keys);
    } while (cursor !== "0");
    assert.equal(remaining.length, 0, "smoke Redis namespace was not fully removed");
    console.log(JSON.stringify({ runId, redisKeysRemoved: removed, redisKeysRemaining: 0 }));
  } finally {
    await redis.quit().catch(() => redis.disconnect());
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "jobs_smoke_cleanup_failed");
  process.exitCode = 1;
});
