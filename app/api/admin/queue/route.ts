import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { resumeQueue } from "@/lib/queue";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { recordAdminAction } from "@/lib/admin-audit";
import { recoverStuckSends } from "@/lib/jobs-workflow/stuck-send-recovery";

export const runtime = "nodejs";

// POST /api/admin/queue — pipeline maintenance from the System page.
//   { action: "retryFailed" }    → re-queue up to 200 failed jobs
//   { action: "cleanFailed" }    → drop failed jobs older than 1h
//   { action: "cleanCompleted" } → drop completed jobs older than 24h
export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("system.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-queue", 15);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { action } = body;

  try {
    let result: any = {};
    if (action === "recoverStuckSends") {
      result = await recoverStuckSends();
    } else if (action === "retryFailed") {
      const failed = await resumeQueue.getFailed(0, 199);
      let retried = 0;
      for (const job of failed) {
        try { await job.retry(); retried++; } catch {}
      }
      result = { retried, of: failed.length };
    } else if (action === "cleanFailed") {
      const removed = await resumeQueue.clean(3600e3, 1000, "failed");
      result = { removed: removed.length };
    } else if (action === "cleanCompleted") {
      const removed = await resumeQueue.clean(24 * 3600e3, 1000, "completed");
      result = { removed: removed.length };
    } else {
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    }

    // Single audit write with staff attribution (the raw duplicate showed
    // Actor = "system" in /admin/actions).
    await recordAdminAction(`queue_${action}`, { details: { result } }).catch(() => {});
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "queue_unavailable" }, { status: 503 });
  }
}
