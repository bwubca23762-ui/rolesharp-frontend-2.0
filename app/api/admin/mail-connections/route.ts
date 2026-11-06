import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q, withTransaction } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { recordAdminAction } from "@/lib/admin-audit";
import {
  boundedPageSize,
  boundedPage,
  boundedSearch,
  containsLikePattern,
} from "@/lib/sql-search";

export const runtime = "nodejs";

// GET /api/admin/mail-connections — paginated list of user email connections.
//   ?q=          → email search (ilike)
//   &provider=   → all | google | microsoft
//   &status=     → all | active | needs_user | disabled
//   &page=1&pageSize=20
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("mail.read")) && !(await hasAdminPermission("communications.read")) && !(await hasAdminPermission("mail.manage")))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const search = boundedSearch(sp.get("q"));
  const provider = sp.get("provider") || "all";
  const status = sp.get("status") || "all";
  const page = boundedPage(sp.get("page"));
  const pageSize = boundedPageSize(sp.get("pageSize"), 20);

  const where: string[] = [];
  const params: any[] = [];

  if (search) {
    params.push(containsLikePattern(search));
    where.push(`u.email ilike $${params.length} escape '\\'`);
  }
  const VALID_PROVIDERS = new Set(["google", "microsoft"]);
  const VALID_STATUSES = new Set(["active", "needs_user", "disabled"]);
  if (provider !== "all") {
    if (!VALID_PROVIDERS.has(provider)) return NextResponse.json({ error: "invalid_provider" }, { status: 400 });
    params.push(provider);
    where.push(`ec.provider = $${params.length}`);
  }
  if (status !== "all") {
    if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    params.push(status);
    where.push(`ec.status = $${params.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const total = Number(
    (await q<{ n: string }>(
      `select count(*)::int n from email_connections ec left join users u on u.id = ec.user_id ${whereSql}`,
      params,
    ))[0]?.n ?? 0,
  );

  // Full-dataset status counts — the KPI cards previously counted only the
  // current page's 20 rows.
  const statusCounts = await q<{ status: string; n: string }>(
    `select ec.status, count(*)::text n from email_connections ec left join users u on u.id = ec.user_id ${whereSql} group by 1`,
    params,
  );
  const stats: Record<string, number> = {};
  for (const row of statusCounts) stats[row.status] = Number(row.n);

  params.push(pageSize, (page - 1) * pageSize);
  const rows = await q(
    `select ec.id, ec.user_id, u.email,
            ec.provider, ec.provider_tenant, ec.verified_sender,
            ec.connection_generation, ec.status,
            ec.disabled_at, ec.created_at, ec.updated_at,
            ec.refresh_ciphertext is not null as has_refresh_token
     from email_connections ec
     left join users u on u.id = ec.user_id
     ${whereSql}
     order by ec.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );

  return NextResponse.json({ rows, total, stats, page, pageSize });
}

// POST /api/admin/mail-connections — disable a user's email connection.
//   { connectionId, action: "disable" }
export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("mail.manage")))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req))
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-mail-connections", 20);
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { connectionId, action } = body;
  if (typeof connectionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectionId) || action !== "disable")
    return NextResponse.json({ error: "connectionId_and_action_required" }, { status: 400 });

  try {
    const result = await withTransaction(async (query) => {
      const updated = await query<{
        id: string;
        user_id: string;
        provider: string;
        verified_sender: string;
      }>(
        `update email_connections
         set status = 'disabled',
             disabled_at = now(),
             updated_at = now(),
             refresh_ciphertext = null,
             key_version = null,
             refresh_nonce = null,
             refresh_tag = null
         where id = $1 and status <> 'disabled'
         returning id, user_id, provider, verified_sender`,
        [connectionId],
      );
      if (!updated[0]) throw new Error("connection_not_found_or_already_disabled");

      const conn = updated[0];
      const userRow = await q<{ email: string }>(
        "select email from users where id = $1",
        [conn.user_id],
      );

      await query(
        `insert into admin_actions (action, target_user_id, target_email, details)
         values ($1, $2, $3, $4)`,
        [
          "mail_connection_disable",
          conn.user_id,
          userRow[0]?.email || null,
          JSON.stringify({
            connectionId: conn.id,
            provider: conn.provider,
            sender: conn.verified_sender,
          }),
        ],
      );
      return { connectionId: conn.id, status: "disabled" };
    });
    await recordAdminAction("mail_connection_action", { details: { result } });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "connection_action_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
