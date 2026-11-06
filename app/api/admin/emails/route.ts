import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { boundedPage, boundedPageSize, boundedSearch, containsLikePattern } from "@/lib/sql-search";

export const runtime = "nodejs";

// GET /api/admin/emails
//   ?page=1&pageSize=20       → paginated email log
//   &type=verification        → filter by type
//   &recipient=hello@test.com → search by recipient
//   &types=1                  → return distinct types for filter dropdown
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("communications.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;

  if (sp.get("types")) {
    const rows = await q<{ type: string }>(
      "select distinct type from email_log order by type",
    );
    return NextResponse.json({ types: rows.map((r) => r.type) });
  }

  const type = (sp.get("type") || "").trim();
  const recipient = boundedSearch(sp.get("recipient"));
  const status = boundedSearch(sp.get("status"));
  const transport = boundedSearch(sp.get("transport"));
  const page = boundedPage(sp.get("page"));
  const pageSize = boundedPageSize(sp.get("pageSize"));

  const where: string[] = [];
  const params: any[] = [];

  if (status) {
    params.push(status);
    where.push(`e.status = $${params.length}`);
  }
  if (transport) {
    params.push(transport);
    where.push(`e.transport = $${params.length}`);
  }

  if (type) {
    params.push(type);
    where.push(`e.type = $${params.length}`);
  }
  if (recipient) {
    params.push(containsLikePattern(recipient));
    where.push(`e.recipient ilike $${params.length} escape '\\'`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const total = Number(
    (await q<{ n: string }>(
      `select count(*)::int n from email_log e ${whereSql}`,
      params,
    ))[0]?.n ?? 0,
  );

  params.push(pageSize, (page - 1) * pageSize);
  const rows = await q(
    `select e.id, e.recipient, e.subject, e.type, e.status, e.transport, e.error_msg, e.created_at
     from email_log e
     ${whereSql}
     order by e.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );

  return NextResponse.json({ rows, total, page, pageSize });
}
