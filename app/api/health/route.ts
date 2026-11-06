import { NextResponse } from "next/server";
import { resumeQueue, redisDeadline } from "@/lib/queue";
import { keyStats } from "@/lib/llm";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";

export const runtime = "nodejs";

// Public: bare liveness (deploy.sh + uptime monitors only need { ok }).
// Scoped admin permission: full internals (queue depth/counts, LLM key pool) —
// these leak capacity/scaling details, so they're no longer world-readable.
// system.read, not the blanket admin cookie: staff with system diagnostics
// duty get internals without holding every other permission.
export async function GET(request: Request) {
  const admin = await hasAdminPermission("system.read");
  if (!admin) {
    return NextResponse.json({ ok: true, ts: Date.now() });
  }

  const readiness = new URL(request.url).searchParams.get("readiness") === "1";
  let databaseReady = false;
  let redisReady = false;
  let depth = -1;
  let queueCounts: any = {};
  try {
    databaseReady = (await q("select 1")).length === 1;
  } catch {}
  // Bounded, so a readiness probe reports "redis: false" instead of hanging —
  // an unreachable dependency has to be reportable to be actionable.
  try {
    depth = await redisDeadline(() => resumeQueue.count());
    redisReady = true;
  } catch {}
  try {
    queueCounts = await redisDeadline(() => resumeQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"));
  } catch {}

  const dependencies = { database: databaseReady, redis: redisReady };
  const ready = databaseReady && redisReady;
  return NextResponse.json({
    ok: readiness ? ready : true,
    ready,
    dependencies,
    queueDepth: depth,
    queueCounts,
    keys: keyStats(),
    ts: Date.now(),
  }, {
    status: readiness && !ready ? 503 : 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
