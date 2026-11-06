import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { updateCampaign } from "@/lib/jobs-workflow/campaigns";
import { recordAdminAction } from "@/lib/admin-audit";
import {
  boundedPageSize,
  boundedPage,
  boundedSearch,
  containsLikePattern,
} from "@/lib/sql-search";

export const runtime = "nodejs";

// GET /api/admin/campaigns — paginated list of user job campaigns.
//   ?q=          → email search (ilike)
//   &mode=       → all | daily_matches | role_apply
//   &status=     → all | draft | active | paused | needs_user | expired | canceled
//   &page=1&pageSize=20
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("jobs.read")))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const search = boundedSearch(sp.get("q"));
  const mode = sp.get("mode") || "all";
  const status = sp.get("status") || "all";
  const page = boundedPage(sp.get("page"));
  const pageSize = boundedPageSize(sp.get("pageSize"), 20);

  const where: string[] = [];
  const params: any[] = [];

  if (search) {
    params.push(containsLikePattern(search));
    where.push(`u.email ilike $${params.length} escape '\\'`);
  }
  const VALID_MODES = new Set(["daily_matches", "role_apply"]);
  const VALID_STATUSES = new Set(["draft", "active", "paused", "needs_user", "expired", "canceled"]);
  if (mode !== "all") {
    if (!VALID_MODES.has(mode)) return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
    params.push(mode);
    where.push(`c.mode = $${params.length}`);
  }
  if (status !== "all") {
    if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    params.push(status);
    where.push(`c.status = $${params.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const total = Number(
    (await q<{ n: string }>(
      `select count(*)::int n from job_campaigns c left join users u on u.id = c.user_id ${whereSql}`,
      params,
    ))[0]?.n ?? 0,
  );

  // Full-dataset status counts — the KPI cards previously counted only the
  // current page's 20 rows.
  const statusCounts = await q<{ status: string; n: string }>(
    `select c.status, count(*)::text n from job_campaigns c left join users u on u.id = c.user_id ${whereSql} group by 1`,
    params,
  );
  const stats: Record<string, number> = { active: 0, paused: 0, needs_user: 0 };
  for (const row of statusCounts) stats[row.status] = Number(row.n);

  params.push(pageSize, (page - 1) * pageSize);
  const rows = await q(
    `select c.id, c.user_id, u.email, c.mode, c.authorization_mode,
            c.status, c.profile_version, c.criteria_version,
            c.timezone, c.daily_time, c.daily_limit,
            c.fit_score_floor, c.confidence_score_floor,
            c.consent_version, c.consent_expires_at,
            c.created_at, c.updated_at, c.canceled_at
     from job_campaigns c
     left join users u on u.id = c.user_id
     ${whereSql}
     order by c.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );

  return NextResponse.json({ rows, total, stats, page, pageSize });
}

// POST /api/admin/campaigns — update campaign status.
//   { campaignId, action: "pause" | "activate" | "cancel" }
export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("jobs.manage")))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req))
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-campaigns", 20);
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { campaignId, action } = body;
  if (!campaignId || !action)
    return NextResponse.json({ error: "campaignId_and_action_required" }, { status: 400 });
  if (typeof campaignId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(campaignId) || typeof action !== "string") return NextResponse.json({ error: "invalid_campaign_change" }, { status: 400 });

  // Admin actions go through the same updateCampaign() the owner's own API
  // uses. Writing status directly here skipped every activation invariant:
  // current legal acceptance, an active feature entitlement, the daily cap, and
  // -- for role_apply -- a live owned mail connection. An admin must not be able
  // to create a campaign state the user-facing path forbids, because that state
  // starts contacting employers on someone's behalf.
  const actions: Record<string, "pause" | "resume" | "cancel"> = {
    pause: "pause",
    activate: "resume",
    cancel: "cancel",
  };
  const mapped = Object.hasOwn(actions, action) ? actions[action] : undefined;
  if (!mapped)
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });

  const owner = (await q<{ user_id: string; status: string }>(
    "select user_id, status from job_campaigns where id = $1",
    [campaignId],
  ))[0];
  if (!owner)
    return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });

  try {
    const updated = await updateCampaign(owner.user_id, campaignId, { action: mapped });
    if (!updated) return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });

    const userRow = await q<{ email: string }>("select email from users where id = $1", [owner.user_id]);
    // recordAdminAction also stamps the acting staff account and authentication
    // method, which the previous raw insert here did not.
    await recordAdminAction(`campaign_${action}`, {
      targetUserId: owner.user_id,
      targetEmail: userRow[0]?.email || null,
      details: { campaignId, from: owner.status, to: updated.status },
    });
    return NextResponse.json({ ok: true, campaignId, status: updated.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "campaign_action_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
