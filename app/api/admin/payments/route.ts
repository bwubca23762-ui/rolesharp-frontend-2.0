import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { boundedPageSize, boundedSearch, containsLikePattern } from "@/lib/sql-search";

export const runtime = "nodejs";

// GET /api/admin/payments?status=&plan=&page=&pageSize= — paginated payment
// table joined to user emails, filterable by status and plan.
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("payments.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const status = (sp.get("status") || "").trim();
  const plan = (sp.get("plan") || "").trim();
  const search = boundedSearch(sp.get("q"));
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = boundedPageSize(sp.get("pageSize"));

  const where: string[] = [];
  const params: any[] = [];
  if (status) { params.push(status); where.push(`p.status = $${params.length}`); }
  if (plan) { params.push(plan); where.push(`p.plan = $${params.length}`); }
  if (search) {
    params.push(containsLikePattern(search));
    where.push(`(u.email ilike $${params.length} escape '\\' or p.order_id ilike $${params.length} escape '\\')`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const paymentSource = `
    from (
      select id::text as id, order_id, user_id_text, status, plan, price_amount::text as price_amount,
             pay_currency, created_at, 'crypto'::text as provider
      from crypto_payments
      union all
      select id::text, razorpay_order_id as order_id, user_id_text, status, plan,
             (amount_paise / 100.0)::text as price_amount, currency as pay_currency, created_at,
             'razorpay'::text as provider
      from razorpay_payments
    ) p
    left join users u on p.user_id_text=u.id::text`;

  const total = Number(
    (await q<{ n: string }>(
      `select count(*)::int n ${paymentSource} ${whereSql}`,
      params,
    ))[0]?.n ?? 0,
  );

  params.push(pageSize, (page - 1) * pageSize);
  const rows = await q(
    `select p.id, p.order_id, p.status, p.plan, p.price_amount, p.pay_currency, p.created_at, p.provider, u.email
     ${paymentSource} ${whereSql}
     order by p.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );

  const statuses = await q<{ status: string }>(
    `select distinct status from (
       select status from crypto_payments
       union
       select status from razorpay_payments
     ) payments order by status`,
  ).catch(() => [] as { status: string }[]);

  return NextResponse.json({ rows, total, page, pageSize, statuses: statuses.map((s) => s.status) });
}
