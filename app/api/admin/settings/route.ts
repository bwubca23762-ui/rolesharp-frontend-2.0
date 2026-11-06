import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";
import { envUsageLimits, getUsageLimits, resetUsageLimits, sanitizeUsageLimits, setUsageLimits, usageLimitsMeta } from "@/lib/settings";

export const runtime = "nodejs";

// GET /api/admin/settings — effective limits, env fallback, and override metadata.
export async function GET() {
  try {
    await requireAdminPermission("system.read");
    const [limits, meta] = await Promise.all([getUsageLimits(), usageLimitsMeta()]);
    return NextResponse.json({ limits, envLimits: envUsageLimits(), ...meta });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
}

// PUT /api/admin/settings — owner edits usage limits. Prices stay env-managed:
// an invoice amount must never drift from what the checkout UI advertised.
export async function PUT(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-settings", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  try {
    const actor = await requireAdminPermission("system.manage");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    if (body?.reset === true) {
      await resetUsageLimits();
      await q(
        `insert into admin_actions (action, target_email, details, staff_account_id, authentication_method)
         values ('settings_limits_reset', $1, $2, $3, $4)`,
        [actor.email, JSON.stringify({}), actor.staffAccountId, actor.authenticationMethod],
      ).catch(() => {});
      return NextResponse.json({ ok: true, limits: envUsageLimits(), overridden: false, updatedAt: null, updatedBy: null });
    }

    if (!body.limits || typeof body.limits !== "object" || Array.isArray(body.limits) || !["freeMonthly", "premiumMonthly", "studentMonthly"].every((key) => Number.isInteger(body.limits[key]) && body.limits[key] >= (key === "freeMonthly" ? 0 : 1) && body.limits[key] <= 10000)) return NextResponse.json({ error: "invalid_limits" }, { status: 400 });
    const limits = sanitizeUsageLimits(body.limits);
    await setUsageLimits(limits, actor.email ?? null);
    const meta = await usageLimitsMeta();
    await q(
      `insert into admin_actions (action, target_email, details, staff_account_id, authentication_method)
       values ('settings_limits_update', $1, $2, $3, $4)`,
      [actor.email, JSON.stringify(limits), actor.staffAccountId, actor.authenticationMethod],
    ).catch(() => {});
    return NextResponse.json({ ok: true, limits, ...meta });
  } catch (error) {
    const code = error instanceof Error ? error.message : "settings_update_failed";
    if (code === "staff_permission_required") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error("settings_update_failed", { error: code });
    return NextResponse.json({ error: "settings_update_failed" }, { status: 500 });
  }
}
