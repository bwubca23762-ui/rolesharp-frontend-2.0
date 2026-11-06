import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

// GET /api/admin/cache — is Cloudflare purge configured?
export async function GET() {
  if (!(await hasAdminPermission("system.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const zone = process.env.CF_ZONE_ID || "";
  const token = process.env.CF_PURGE_TOKEN || "";
  const configured = !!zone && !!token && !zone.startsWith("paste_") && !token.startsWith("paste_");
  return NextResponse.json({ configured });
}

// POST /api/admin/cache — purge the entire Cloudflare cache for the zone.
export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("system.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-cache-purge", 5);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const zone = process.env.CF_ZONE_ID || "";
  const token = process.env.CF_PURGE_TOKEN || "";
  if (!zone || !token || zone.startsWith("paste_") || token.startsWith("paste_")) {
    return NextResponse.json({ error: "not_configured", detail: "Set CF_ZONE_ID and CF_PURGE_TOKEN in the server .env." }, { status: 400 });
  }

  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ purge_everything: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json().catch(() => ({}));
    const ok = !!(j as any)?.success;
    await q("insert into admin_actions (action, details) values ($1,$2)", [
      "cf_cache_purge",
      JSON.stringify({ ok }),
    ]).catch(() => {});
    if (!ok) return NextResponse.json({ error: "purge_failed", detail: JSON.stringify((j as any)?.errors || []) }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    await recordAdminAction("cf_cache_purge", { details: { ok: false, reason: "network_error" } });
    return NextResponse.json({ error: "network_error" }, { status: 502 });
  }
}
