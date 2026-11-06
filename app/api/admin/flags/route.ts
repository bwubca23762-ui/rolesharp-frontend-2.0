import { NextRequest, NextResponse } from "next/server";
import { currentAdminPrincipal, hasAdminPermission } from "@/lib/admin-authorization";
import { q, withTransaction } from "@/lib/db";
import { isAllowedFeatureFlag, JOB_WORKFLOW_FLAGS } from "@/lib/jobs-workflow/flags";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";

export const runtime = "nodejs";

// GET /api/admin/flags — returns all feature flags
export async function GET() {
  if (!(await hasAdminPermission("flags.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rows = await q<{ name: string; enabled: boolean; description: string | null; updated_at: string }>(
    "select name, enabled, rollout_percent, description, updated_at from feature_flags order by name",
  );
  return NextResponse.json({ flags: rows });
}

// POST /api/admin/flags — update a specific flag { name, enabled }
export async function POST(req: NextRequest) {
  const actor = await currentAdminPrincipal();
  if (!actor?.permissions.has("flags.manage")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { name, enabled, rolloutPercent } = body;
  if (!isAllowedFeatureFlag(name) || (enabled === undefined && rolloutPercent === undefined)
    || (enabled !== undefined && typeof enabled !== "boolean")
    || (rolloutPercent !== undefined && (!(JOB_WORKFLOW_FLAGS as readonly string[]).includes(name) || !Number.isInteger(rolloutPercent) || rolloutPercent < 0 || rolloutPercent > 100))) {
    return NextResponse.json({ error: "invalid_feature_flag_change" }, { status: 400 });
  }
  const updated = await withTransaction(async (query) => {
    const rows = await query<{ name: string; previous_enabled: boolean; previous_rollout: number; enabled: boolean; rollout_percent: number }>(
      `with previous as (
         select name,enabled,rollout_percent from feature_flags where name=$1 for update
       ), changed as (
         update feature_flags f set enabled=coalesce($2,f.enabled),rollout_percent=coalesce($3,f.rollout_percent),updated_at=now()
         from previous p where f.name=p.name
         returning f.name,p.enabled previous_enabled,p.rollout_percent previous_rollout,f.enabled,f.rollout_percent
       ) select * from changed`,
      [name, enabled ?? null, rolloutPercent ?? null],
    );
    if (rows[0]) {
      await query("insert into admin_actions (action,details,staff_account_id,authentication_method) values ($1,$2,$3,$4)", [
        "flags_update",
        JSON.stringify({ name, previousEnabled: rows[0].previous_enabled, enabled: rows[0].enabled, previousRolloutPercent: rows[0].previous_rollout, rolloutPercent: rows[0].rollout_percent }),
        actor.staffAccountId,
        actor.authenticationMethod,
      ]);
    }
    return rows;
  });
  if (!updated[0]) return NextResponse.json({ error: "feature flag is unavailable" }, { status: 404 });
  return NextResponse.json({ ok: true, name, enabled: updated[0].enabled, rolloutPercent: updated[0].rollout_percent });
}
