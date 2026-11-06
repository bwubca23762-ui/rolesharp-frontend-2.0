import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/admin/user-detail?userId=<uuid>
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("users.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ error: "userId_required" }, { status: 400 });

  const [userRows] = await Promise.all([
    q<any>(
      `select u.email, u.created_at, u.premium_until, u.email_verified_at,
              coalesce(u.credits, 0)::int as credits, u.premium_source
       from users u
       where u.id = $1`,
      [userId],
    ),
  ]);

  if (!userRows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [resumes, payments, creditEvents, applications, tickets, campaigns, mailConnections] = await Promise.all([
    q<any>(
      `select r.id, r.candidate_name, r.content->>'headline' as headline,
              c.name as company_name, ro.title as role_title,
              r.ats_score, r.created_at
       from resumes r
       left join companies c on c.id = r.company_id
       left join roles ro on ro.id = r.role_id
       where r.user_id_text = $1
       order by r.created_at desc
       limit 200`,
      [userId],
    ),
    q<any>(
      `select id, order_id, plan, status, price_amount, pay_currency, created_at, provider
       from (
         select id::text as id, order_id, plan, status, price_amount::text as price_amount, pay_currency, created_at,
                'crypto'::text as provider
         from crypto_payments where user_id_text = $1
         union all
         select id::text, razorpay_order_id as order_id, plan, status, (amount_paise / 100.0)::text as price_amount,
                currency as pay_currency, created_at, 'razorpay'::text as provider
         from razorpay_payments where user_id_text = $1
       ) payments
       order by created_at desc
       limit 200`,
      [userId],
    ),
    q<any>(
      `select kind, delta, details, created_at
       from credit_events
       where user_id = $1
       order by created_at desc
       limit 200`,
      [userId],
    ),
    q<any>(
      `select id, company, role, status, created_at
       from applications
       where user_id_text = $1
       order by created_at desc
       limit 200`,
      [userId],
    ),
    q<any>(
      `select id, subject, status, created_at
       from support_tickets
       where user_id_text = $1
       order by created_at desc
       limit 200`,
      [userId],
    ),
    q<any>(
      `select id, mode, authorization_mode, status, daily_limit,
              fit_score_floor, confidence_score_floor, timezone, daily_time,
              created_at, updated_at
       from job_campaigns
       where user_id = $1
       order by created_at desc
       limit 50`,
      [userId],
    ).catch(() => []),
    q<any>(
      `select id, provider, provider_tenant, verified_sender,
              connection_generation, status, created_at, updated_at
       from email_connections
       where user_id = $1
       order by created_at desc
       limit 50`,
      [userId],
    ).catch(() => []),
  ]);

  return NextResponse.json({
    user: userRows[0],
    resumes,
    payments,
    creditEvents,
    applications,
    tickets,
    campaigns,
    mailConnections,
  });
}
