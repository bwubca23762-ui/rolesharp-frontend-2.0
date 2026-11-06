import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { parseAnalyticsRange } from "@/lib/analytics-range";
import { ADMIN_ANALYTICS_METRICS, analyticsRangeMetadata, utcDateFilter } from "@/lib/admin-analytics";
import { csvCell } from "@/lib/csv";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type ExportRow = {
  date: string;
  signups: string;
  resumes: string;
  settled_usd: string;
  settled_payments: string;
};

export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("analytics.export"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const limited = await rateLimit(req, "admin-analytics-export", 10);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  let range;
  try {
    range = parseAnalyticsRange(req.nextUrl.searchParams.get("from"), req.nextUrl.searchParams.get("to"));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "invalid_date_range" }, { status: 400 });
  }
  const generatedAt = new Date().toISOString();
  const from = range?.from ?? new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const to = range?.to ?? generatedAt.slice(0, 10);
  const rows = await q<ExportRow>(
    `with days as (
       select generate_series($1::date,$2::date,interval '1 day')::date as day
     ), signups as (
       select (created_at at time zone 'UTC')::date as day,count(*)::text as value
       from users where ${utcDateFilter("created_at")} group by 1
     ), resumes as (
       select (created_at at time zone 'UTC')::date as day,count(*)::text as value
       from resumes where ${utcDateFilter("created_at")} group by 1
     ), payments as (
       select (created_at at time zone 'UTC')::date as day,
              coalesce(sum(price_amount),0)::text settled_usd,count(*)::text settled_payments
       from crypto_payments where status in ('finished','confirmed') and ${utcDateFilter("created_at")}
       group by 1
     )
     select to_char(day,'YYYY-MM-DD') date,
            coalesce(signups.value,'0') signups,
            coalesce(resumes.value,'0') resumes,
            coalesce(payments.settled_usd,'0') settled_usd,
            coalesce(payments.settled_payments,'0') settled_payments
     from days left join signups using(day) left join resumes using(day) left join payments using(day)
     order by day`,
    [from, to],
  );

  const metadata = analyticsRangeMetadata({ from, to, days: rows.length }, generatedAt);
  const csvRows = [
    ["RoleSharp aggregate analytics export"],
    ["Generated at", metadata.generatedAt],
    ["Timezone", metadata.timezone],
    ["From inclusive", `${from}T00:00:00.000Z`],
    ["To inclusive UTC date", to],
    [],
    ["date_utc", "signups", "resumes_generated", "settled_invoice_value_usd", "settled_payments"],
    ...rows.map((row) => [row.date, row.signups, row.resumes, row.settled_usd, row.settled_payments]),
    [],
    ["metric_key", "definition", "source", "availability"],
    ...ADMIN_ANALYTICS_METRICS.map((metric) => [metric.key, metric.definition, metric.source, metric.availability]),
  ];
  const csv = csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rolesharp-analytics-${from}-to-${to}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
