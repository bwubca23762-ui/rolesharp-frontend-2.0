import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { recordAdminAction } from "@/lib/admin-audit";
import { opsRequest } from "@/lib/ops-control";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("system.read"))) return NextResponse.json({ error: "admin_required" }, { status: 403 });
  const limited = await rateLimit(req, "admin-backup-list", 20);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const result = await opsRequest({ action: "backups" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 503 });
  return NextResponse.json({ snapshots: result.snapshots || [] }, { headers: { "Cache-Control": "private, no-store" } });
}

// The dump itself runs in the root ops-helper daemon and streams straight to
// disk (custom -Fc format, 0640). The web process — unprivileged, RAM-capped,
// sharing its service with every user request — never holds the dump bytes;
// the old in-process dump buffer was an OOM lever waiting for a database big
// enough to pull it.
export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("system.manage"))) return NextResponse.json({ error: "admin_required" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-backup", 2);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const result = await opsRequest({ action: "backup" });
  if (result.ok) {
    await recordAdminAction("database_backup", { details: { ok: true, file: result.file, bytes: result.bytes } });
    return NextResponse.json({ ok: true, message: `Backup saved to ${result.file} (${Math.round((result.bytes ?? 0) / 1024)} KB)` });
  }
  await recordAdminAction("database_backup", { details: { ok: false, error: result.error } });
  return NextResponse.json({ error: `Backup failed: ${result.error}${result.detail ? ` — ${result.detail}` : ""}` }, { status: 500 });
}
