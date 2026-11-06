import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { recordAdminAction } from "@/lib/admin-audit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { opsRequest, type OpsAction } from "@/lib/ops-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Restarting or stopping a unit is a production action, so it needs
// system.manage. Reading state only needs system.read.
const MUTATING: ReadonlySet<string> = new Set(["start", "stop", "restart", "reload"]);

// GET /api/admin/services — every allowlisted unit and its current state.
export async function GET() {
  if (!(await hasAdminPermission("system.read"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await opsRequest({ action: "list" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 503 });
  return NextResponse.json({ services: result.services ?? [] });
}

// POST /api/admin/services — { unit, action: start | stop | restart }
export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("system.manage"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!mutationOriginAllowed(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { unit, action } = body;
  if (typeof unit !== "string" || typeof action !== "string" || !MUTATING.has(action)) {
    return NextResponse.json({ error: "unit and action (start|stop|restart|reload) are required" }, { status: 400 });
  }

  // The helper re-validates both the unit and the verb against its own
  // allowlist; this route never builds a shell string.
  const result = await opsRequest({ action: action as OpsAction, unit });

  // Audited either way: a refused or failed restart of a production service is
  // exactly as worth recording as a successful one.
  await recordAdminAction("service_control", {
    details: { unit, action, ok: result.ok, ...(result.ok ? {} : { error: result.error }) },
  });

  if (!result.ok) {
    const status = result.error === "helper_unavailable" || result.error === "helper_timeout" ? 503 : 400;
    return NextResponse.json({ error: result.error, detail: result.detail }, { status });
  }
  return NextResponse.json({ service: result.service });
}
