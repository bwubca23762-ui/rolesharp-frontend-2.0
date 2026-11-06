import { NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/admin/trends — 30-day daily series for the overview charts:
// resumes generated, signups, and confirmed revenue per day.
export async function GET() {
  if (!(await hasAdminPermission("analytics.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [resumes, signups, revenue, premiumCohorts, verifiedCohorts, openTicketCohorts] = await Promise.all([
    q<{ d: string; n: number }>(
      `select to_char(date_trunc('day', created_at at time zone 'UTC'),'YYYY-MM-DD') d, count(*)::int n
       from resumes where created_at >= now() - interval '30 days'
       group by 1 order by 1`,
    ),
    q<{ d: string; n: number }>(
      `select to_char(date_trunc('day', created_at at time zone 'UTC'),'YYYY-MM-DD') d, count(*)::int n
       from users where created_at >= now() - interval '30 days'
       group by 1 order by 1`,
    ),
    q<{ d: string; n: string }>(
      `select to_char(date_trunc('day', created_at at time zone 'UTC'),'YYYY-MM-DD') d, coalesce(sum(price_amount),0)::text n
       from crypto_payments
       where status in ('finished','confirmed') and created_at >= now() - interval '30 days'
       group by 1 order by 1`,
    ),
    q<{ d: string; n: number }>(`select to_char(created_at at time zone 'UTC','YYYY-MM-DD') d,count(*)::int n
      from users where premium_until>now() and created_at>=now()-interval '30 days' group by 1 order by 1`),
    q<{ d: string; n: number }>(`select to_char(created_at at time zone 'UTC','YYYY-MM-DD') d,count(*)::int n
      from users where email_verified_at is not null and created_at>=now()-interval '30 days' group by 1 order by 1`),
    q<{ d: string; n: number }>(`select to_char(created_at at time zone 'UTC','YYYY-MM-DD') d,count(*)::int n
      from support_tickets where status='open' and created_at>=now()-interval '30 days' group by 1 order by 1`),
  ]);

  // Dense 30-day axis so charts don't skip empty days.
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400e3);
    days.push(d.toISOString().slice(0, 10));
  }
  const dense = (rows: { d: string; n: number | string }[]) => {
    const m = new Map(rows.map((r) => [r.d, Number(r.n)]));
    return days.map((d) => ({ d, n: m.get(d) ?? 0 }));
  };

  return NextResponse.json({
    days,
    resumes: dense(resumes),
    signups: dense(signups),
    revenue: dense(revenue),
    premiumCohorts: dense(premiumCohorts),
    verifiedCohorts: dense(verifiedCohorts),
    openTicketCohorts: dense(openTicketCohorts),
  });
}
