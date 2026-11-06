import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { boundedPage, boundedSearch, containsLikePattern } from "@/lib/sql-search";

export const runtime = "nodejs";

// GET /api/admin/audit
//   ?page=1       (default 1)
//   &pageSize=30  (default 30, max 100)
//   &action=      (filter by action type)
//   &email=       (search by target_email, case-insensitive partial match)
//   &from=        (ISO date string, inclusive)
//   &to=          (ISO date string, inclusive)
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("security.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const limited = await rateLimit(req, "admin-audit", 30);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const sp = req.nextUrl.searchParams;
  const page = boundedPage(sp.get("page"));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(sp.get("pageSize"))) || 30));
  const action = (sp.get("action") || "").trim() || null;
  const email = boundedSearch(sp.get("email")) || null;
  const from = (sp.get("from") || "").trim() || null;
  const to = (sp.get("to") || "").trim() || null;
  const distinct = sp.get("distinct");

  // Reject malformed date filters before PostgreSQL casts them. Invalid input
  // must produce a useful client response rather than a database exception.
  const validDate = (value: string | null) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value);
  if (!validDate(from) || !validDate(to) || (from && to && from > to)) {
    return NextResponse.json({ error: "invalid_date_range" }, { status: 400 });
  }

  // Distinct actions: return unique action types (used by the admin UI filter dropdown).
  if (distinct) {
    const actions = await q<{ action: string }>(
      `select distinct action from admin_actions order by action`,
    );
    return NextResponse.json({ distinctActions: actions.map((a) => a.action) });
  }

  // pageSize 0 means skip data, just return total (used by distinct query above) — but distinct is handled already.
  if (pageSize === 0) return NextResponse.json({ rows: [], total: 0, page, pageSize });

  const where: string[] = [];
  const params: any[] = [];

  if (action) {
    params.push(action);
    where.push(`a.action = $${params.length}`);
  }
  if (email) {
    params.push(containsLikePattern(email));
    where.push(`a.target_email ilike $${params.length} escape '\\'`);
  }
  if (from) {
    params.push(from);
    where.push(`a.created_at >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    // A <input type="date"> sends YYYY-MM-DD, which ::timestamptz casts to
    // midnight — `<=` then excluded every event ON the selected To date.
    where.push(`a.created_at < ($${params.length}::date + interval '1 day')`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const [{ n }] = await q<{ n: string }>(
    `select count(*)::int n from admin_actions a ${whereSql}`,
    params,
  );
  const total = Number(n ?? 0);

  params.push(pageSize, (page - 1) * pageSize);
  const rows = await q(
    `select a.id, a.action, a.target_email, a.details, a.created_at,
            a.staff_account_id, a.authentication_method,
            sa.email as actor_email, sa.display_name as actor_name,
            sa.email as staff_email,
            array(select ra.role_key from staff_role_assignments ra
              where ra.staff_account_id=a.staff_account_id and ra.revoked_at is null
              order by ra.role_key) as staff_roles
     from admin_actions a
     left join staff_accounts sa on sa.id = a.staff_account_id
     ${whereSql}
     order by a.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );

  return NextResponse.json({ rows, total, page, pageSize });
}
