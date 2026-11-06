import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { TtlCache } from "@/lib/ttl-cache";
import { rateLimit } from "@/lib/rate-limit";
import { parseAnalyticsRange, type AnalyticsRange } from "@/lib/analytics-range";
import { ADMIN_ANALYTICS_METRICS, analyticsRangeMetadata, utcDateFilter } from "@/lib/admin-analytics";
import { resumeQueue } from "@/lib/queue";

export const runtime = "nodejs";
const analyticsCache = new TtlCache<Record<string, unknown>>(20, 30_000);

type AnalyticsSectionName = "traffic" | "users" | "revenue" | "funnel" | "content" | "generation" | "jobs" | "realtime";
type AnalyticsAvailability = Record<AnalyticsSectionName, { available: boolean }>;
type AnalyticsWarning = { section: AnalyticsSectionName; code: "temporarily_unavailable" };

async function safeSection<T>(section: AnalyticsSectionName, load: () => Promise<T>) {
  try {
    return { section, data: await load(), warning: null };
  } catch (error) {
    console.error(`Admin analytics section failed: ${section}`, error);
    return {
      section,
      data: null,
      warning: { section, code: "temporarily_unavailable" } as AnalyticsWarning,
    };
  }
}

const FLAG = (code: string) => {
  if (code.length !== 2) return "🌐";
  return String.fromCodePoint(...code.split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

// Every selected calendar day is interpreted in UTC, independent of the
// database session timezone.
function dateFilter(from: string, to: string, column = "created_at"): { where: string; params: string[] } {
  return { where: utcDateFilter(column), params: [from, to] };
}

// Same range filter for tables whose event column is NOT created_at
// (student_claims.claimed_at, jobs.first_seen_at). Falls back to the same
// rolling window the created_at queries use when no custom range is given.
function customDateFilter(column: string, from?: string, to?: string): string {
  return from && to ? utcDateFilter(column) : `${column} >= now() - interval '30 days'`;
}

export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("analytics.read"))) return NextResponse.json({ error: "admin_required" }, { status: 403 });
  const limited = await rateLimit(req, "admin-analytics", 30);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  let range: AnalyticsRange | null;
  try {
    range = parseAnalyticsRange(
      req.nextUrl.searchParams.get("from"),
      req.nextUrl.searchParams.get("to"),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_date_range";
    return NextResponse.json({ error: code }, { status: 400 });
  }
  const from = range?.from;
  const to = range?.to;
  const cacheKey = `${from ?? "default"}:${to ?? "default"}`;
  // ?fresh=1 bypasses the 30s TTL for the manual Refresh path — a stale
  // cache HIT behind a Refresh button defeats the button's whole purpose.
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const cached = fresh ? null : analyticsCache.get(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { "X-RoleSharp-Cache": "HIT" } });

  const sections = await Promise.all([
    safeSection("traffic", () => fetchTraffic(from, to)),
    safeSection("users", () => fetchUsers(from, to)),
    safeSection("revenue", () => fetchRevenue(from, to)),
    safeSection("funnel", () => fetchCheckoutFunnel(from, to)),
    safeSection("content", () => fetchContent(from, to)),
    safeSection("generation", () => fetchGeneration(from, to)),
    safeSection("jobs", () => fetchJobs(from, to)),
    safeSection("realtime", fetchRealtime),
  ]);
  const generatedAt = new Date().toISOString();
  const metadata = analyticsRangeMetadata(range, generatedAt);
  const payload = {
    ...Object.fromEntries(sections.map(({ section, data }) => [section, data])),
    availability: Object.fromEntries(sections.map(({ section, data }) => [section, { available: data !== null }])) as AnalyticsAvailability,
    warnings: sections.flatMap(({ warning }) => warning ? [warning] : []),
    range: metadata.range,
    timezone: metadata.timezone,
    generatedAt: metadata.generatedAt,
    definitions: ADMIN_ANALYTICS_METRICS,
  };
  analyticsCache.set(cacheKey, payload);
  return NextResponse.json(payload, { headers: { "X-RoleSharp-Cache": "MISS" } });
}

/* ═══════════════════════════════════════════════════════════
   TRAFFIC & PAGE VIEWS
   ═══════════════════════════════════════════════════════════ */
async function fetchTraffic(from?: string, to?: string) {
  const have = await q<{ exists: boolean }>(
    "select exists (select 1 from information_schema.tables where table_name='page_views') as exists",
  );
  if (!have[0]?.exists) return null;

  if (from && to) {
    const filter = dateFilter(from, to);
    const [custom, trend, pages, countries, devices, referrers] = await Promise.all([
      q<{ v: string; u: string }>(
        `select count(*)::text v, count(distinct session_id)::text u from page_views where ${filter.where}`,
        filter.params,
      ),
      q<{ d: string; v: string; u: string }>(
        `select to_char(dt, 'YYYY-MM-DD') d, count(*)::text v, count(distinct session_id)::text u
       from (select date_trunc('day', created_at at time zone 'UTC') dt, session_id from page_views where ${filter.where}) sub
       group by dt order by d`,
        filter.params,
      ),
      q<{ p: string; v: string }>(
        `select path p, count(*)::text v from page_views where ${filter.where} group by path order by count(*) desc limit 30`,
        filter.params,
      ),
      q<{ c: string; v: string }>(
        `select coalesce(country_code,'??') c, count(*)::text v from page_views where ${filter.where} group by c order by count(*) desc limit 25`,
        filter.params,
      ),
      q<{ d: string; v: string }>(
        `select device_type d, count(*)::text v from page_views where ${filter.where} group by d order by count(*) desc`,
        filter.params,
      ),
      q<{ s: string; v: string }>(
        `select coalesce(referrer,'Direct / None') s, count(*)::text v from page_views where ${filter.where} group by s order by count(*) desc limit 20`,
        filter.params,
      ),
    ]);
    const total = custom[0];
    return {
      customRange: { views: num(total?.v), visitors: num(total?.u) },
      dailyTrend: trend.map((r) => ({ d: r.d, views: num(r.v), visitors: num(r.u) })),
      topPages: pages.map((r) => ({ path: r.p, views: num(r.v) })),
      countries: countries.map((r) => ({ code: r.c, flag: FLAG(r.c), views: num(r.v) })),
      devices: devices.map((r) => ({ type: r.d, views: num(r.v) })),
      referrers: referrers.map((r) => ({ source: r.s, views: num(r.v) })),
      hourly: [],
    };
  }

  const [today, last7, last30, trend, pages, countries, devices, referrers, hourly, weekly] = await Promise.all([
    q<{ v: string; u: string }>(
      `select count(*)::text v, count(distinct session_id)::text u from page_views where created_at >= date_trunc('day', now())`,
    ),
    q<{ v: string; u: string }>(
      `select count(*)::text v, count(distinct session_id)::text u from page_views where created_at >= now() - interval '7 days'`,
    ),
    q<{ v: string; u: string }>(
      `select count(*)::text v, count(distinct session_id)::text u from page_views where created_at >= now() - interval '30 days'`,
    ),
    q<{ d: string; v: string; u: string }>(
      `select to_char(dt, 'YYYY-MM-DD') d, count(*)::text v, count(distinct session_id)::text u
       from (select date_trunc('day', created_at at time zone 'UTC') dt, session_id from page_views where created_at >= now() - interval '30 days') sub
       group by dt order by d`,
    ),
    q<{ p: string; v: string }>(
      `select path p, count(*)::text v from page_views where created_at >= now() - interval '30 days' group by path order by count(*) desc limit 30`,
    ),
    q<{ c: string; v: string }>(
      `select coalesce(country_code,'??') c, count(*)::text v from page_views where created_at >= now() - interval '30 days' group by c order by count(*) desc limit 25`,
    ),
    q<{ d: string; v: string }>(
      `select device_type d, count(*)::text v from page_views where created_at >= now() - interval '30 days' group by d order by count(*) desc`,
    ),
    q<{ s: string; v: string }>(
      `select coalesce(referrer,'Direct / None') s, count(*)::text v from page_views where created_at >= now() - interval '30 days' group by s order by count(*) desc limit 20`,
    ),
    q<{ h: string; v: string }>(
      `select to_char(date_trunc('hour', created_at), 'HH24:00') h, count(*)::text v from page_views where created_at >= date_trunc('day', now()) group by date_trunc('hour', created_at) order by h`,
    ),
    q<{ v: string; u: string }>(
      `select count(*)::text v, count(distinct session_id)::text u from page_views where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'`,
    ),
  ]);

  const prevWeek = weekly[0];
  const thisWeek = last7[0];

  return {
    today: { views: num(today[0]?.v), visitors: num(today[0]?.u) },
    last7Days: { views: num(last7[0]?.v), visitors: num(last7[0]?.u) },
    last30Days: { views: num(last30[0]?.v), visitors: num(last30[0]?.u) },
    weekChange: prevWeek ? Math.round(((num(thisWeek?.v) - num(prevWeek.v)) / Math.max(1, num(prevWeek.v))) * 100) : 0,
    dailyTrend: trend.map((r) => ({ d: r.d, views: num(r.v), visitors: num(r.u) })),
    topPages: pages.map((r) => ({ path: r.p, views: num(r.v) })),
    countries: countries.map((r) => ({ code: r.c, flag: FLAG(r.c), views: num(r.v) })),
    devices: devices.map((r) => ({ type: r.d, views: num(r.v) })),
    referrers: referrers.map((r) => ({ source: r.s, views: num(r.v) })),
    hourly: hourly.map((r) => ({ hour: r.h, views: num(r.v) })),
  };
}

/* ═══════════════════════════════════════════════════════════
   USERS & GROWTH
   ═══════════════════════════════════════════════════════════ */
async function fetchUsers(from?: string, to?: string) {
  if (from && to) {
    const filter = dateFilter(from, to);
    const [total, premium, verified, student, newInRange, signupTrend, creditStats, invites] = await Promise.all([
      q<{ n: string }>("select count(*)::text n from users"),
      q<{ n: string }>("select count(*)::text n from users where premium_until > now()"),
      q<{ n: string }>("select count(*)::text n from users where email_verified_at is not null"),
      q<{ n: string }>("select count(*)::text n from student_claims"),
      q<{ n: string }>(`select count(*)::text n from users where ${filter.where}`, filter.params),
      q<{ d: string; n: string }>(
        `select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') d, count(*)::text n
         from users where ${filter.where}
         group by date_trunc('day', created_at at time zone 'UTC') order by d`,
        filter.params,
      ),
      q<{ earned: string; spent: string }>(
        `select coalesce(sum(case when delta>0 then delta else 0 end),0)::text earned,
                coalesce(sum(case when delta<0 then abs(delta) else 0 end),0)::text spent
         from credit_events where ${filter.where}`, filter.params,
      ),
      q<{ n: string }>(
        `select count(*)::text n from credit_events where kind='referral_verified' and ${filter.where}`, filter.params,
      ),
    ]);

    const convRate = num(total[0]?.n) > 0 ? ((num(premium[0]?.n) / num(total[0]?.n)) * 100).toFixed(1) : "0";
    const verifyRate = num(total[0]?.n) > 0 ? ((num(verified[0]?.n) / num(total[0]?.n)) * 100).toFixed(1) : "0";

    return {
      total: num(total[0]?.n),
      premium: num(premium[0]?.n),
      verified: num(verified[0]?.n),
      students: num(student[0]?.n),
      conversionRate: `${convRate}%`,
      verificationRate: `${verifyRate}%`,
      newInRange: num(newInRange[0]?.n),
      signupTrend: signupTrend.map((row) => ({ d: row.d, signups: num(row.n) })),
      creditsEarned: num(creditStats[0]?.earned),
      creditsSpent: num(creditStats[0]?.spent),
      referralsRecent: num(invites[0]?.n),
    };
  }

  const [
    total, premium, verified, student, today, week, month,
    trend, creditStats, invites,
  ] = await Promise.all([
    q<{ n: string }>("select count(*)::text n from users"),
    q<{ n: string }>("select count(*)::text n from users where premium_until > now()"),
    q<{ n: string }>("select count(*)::text n from users where email_verified_at is not null"),
    q<{ n: string }>("select count(*)::text n from student_claims"),
    q<{ n: string }>("select count(*)::text n from users where created_at >= date_trunc('day', now())"),
    q<{ n: string }>("select count(*)::text n from users where created_at >= now() - interval '7 days'"),
    q<{ n: string }>("select count(*)::text n from users where created_at >= now() - interval '30 days'"),
    q<{ d: string; n: string }>(
      `select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') d, count(*)::text n
       from users where created_at >= now() - interval '30 days' group by date_trunc('day', created_at at time zone 'UTC') order by d`,
    ),
    q<{ earned: string; spent: string }>(
      `select coalesce(sum(case when delta>0 then delta else 0 end),0)::text earned,
              coalesce(sum(case when delta<0 then abs(delta) else 0 end),0)::text spent
       from credit_events where created_at >= now() - interval '30 days'`,
    ),
    q<{ n: string }>(
      `select count(*)::text n from credit_events where kind='referral_verified' and created_at >= now() - interval '30 days'`,
    ),
  ]);

  const convRate = num(total[0]?.n) > 0 ? ((num(premium[0]?.n) / num(total[0]?.n)) * 100).toFixed(1) : "0";
  const verifyRate = num(total[0]?.n) > 0 ? ((num(verified[0]?.n) / num(total[0]?.n)) * 100).toFixed(1) : "0";

  return {
    total: num(total[0]?.n),
    premium: num(premium[0]?.n),
    verified: num(verified[0]?.n),
    students: num(student[0]?.n),
    conversionRate: `${convRate}%`,
    verificationRate: `${verifyRate}%`,
    newToday: num(today[0]?.n),
    newThisWeek: num(week[0]?.n),
    newThisMonth: num(month[0]?.n),
    signupTrend: trend.map((r) => ({ d: r.d, signups: num(r.n) })),
    creditsEarned: num(creditStats[0]?.earned),
    creditsSpent: num(creditStats[0]?.spent),
    referralsRecent: num(invites[0]?.n),
  };
}

/* ═══════════════════════════════════════════════════════════
   REVENUE & MONETIZATION
   ═══════════════════════════════════════════════════════════ */
async function fetchRevenue(from?: string, to?: string) {
  const custom = !!from && !!to;
  const where = custom ? dateFilter(from, to).where : "created_at >= now() - interval '30 days'";
  const params = custom ? [from, to] : [];
  const [total, selected, trend, methods, plans, students, completed, razorpayTable] = await Promise.all([
    q<{ n: string }>(
      `select coalesce(sum(price_amount),0)::text n from crypto_payments where status in ('finished','confirmed')`,
    ),
    q<{ n: string }>(
      `select coalesce(sum(price_amount),0)::text n from crypto_payments where status in ('finished','confirmed') and ${where}`,
      params,
    ),
    q<{ d: string; n: string }>(
      `select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') d,
              coalesce(sum(price_amount),0)::text n
       from crypto_payments where status in ('finished','confirmed') and ${where}
       group by date_trunc('day', created_at at time zone 'UTC') order by d`,
      params,
    ),
    q<{ m: string; n: string }>(
      `select coalesce(pay_currency,'unknown') m, count(*)::text n
       from crypto_payments where status in ('finished','confirmed') and ${where}
       group by pay_currency order by count(*) desc limit 20`,
      params,
    ),
    q<{ p: string; n: string }>(
      `select coalesce(plan,'unknown') p, count(*)::text n
       from crypto_payments where status in ('finished','confirmed') and ${where}
       group by plan order by count(*) desc limit 20`,
      params,
    ),
    q<{ n: string }>(
      `select count(*)::text n from student_claims where ${customDateFilter("claimed_at", from, to)}`, params,
    ),
    q<{ n: string }>(
      `select count(*)::text n from crypto_payments where status in ('finished','confirmed') and ${where}`, params,
    ),
    q<{ exists: boolean }>("select exists (select 1 from information_schema.tables where table_name='razorpay_payments') as exists"),
  ]);

  // INR card payments are counted separately. Adding them to the USD crypto
  // amount would make the headline revenue figure mathematically false.
  const razorpayCompleted = razorpayTable[0]?.exists
    ? await q<{ n: string }>(`select count(*)::text n from razorpay_payments where status='paid' and ${where}`, params)
    : [];

  return {
    currency: "USD",
    totalSettledInvoiceValue: num(total[0]?.n).toFixed(2),
    selectedRangeSettledInvoiceValue: num(selected[0]?.n).toFixed(2),
    recurringRevenue: { available: false, reason: "No recurring subscription ledger exists; fixed-duration invoices cannot truthfully produce MRR or ARR." },
    completedPayments: num(completed[0]?.n),
    razorpayCompletedPayments: num(razorpayCompleted[0]?.n),
    revenueTrend: trend.map((row) => ({ d: row.d, revenue: Math.round(num(row.n) * 100) / 100 })),
    paymentCurrencies: methods.map((row) => ({ currency: row.m.toUpperCase(), count: num(row.n) })),
    planBreakdown: plans.map((row) => ({ plan: row.p, count: num(row.n) })),
    studentClaims: num(students[0]?.n),
  };
}

/* ═══════════════════════════════════════════════════════════
   CHECKOUT FUNNEL
   ═══════════════════════════════════════════════════════════ */
const CHECKOUT_EVENTS = [
  "checkout_intent",
  "checkout_provider_selected",
  "checkout_started",
  "checkout_cancelled",
  "checkout_failed",
  "checkout_verified",
] as const;

async function fetchCheckoutFunnel(from?: string, to?: string) {
  const have = await q<{ exists: boolean }>(
    "select exists (select 1 from information_schema.tables where table_name='product_events') as exists",
  );
  if (!have[0]?.exists) return null;

  const filter = from && to ? dateFilter(from, to) : null;
  const rows = await q<{ event_name: string; events: string; sessions: string }>(
    `select event_name, count(*)::text events, count(distinct session_id)::text sessions
     from product_events
     where event_name = any(array[${CHECKOUT_EVENTS.map((event) => `'${event}'`).join(",")}])
       and ${filter?.where ?? "created_at >= now() - interval '30 days'"}
     group by event_name`,
    filter?.params ?? [],
  );
  const values = new Map(rows.map((row) => [row.event_name, row]));
  return {
    steps: CHECKOUT_EVENTS.map((event) => ({
      event,
      events: num(values.get(event)?.events),
      sessions: num(values.get(event)?.sessions),
    })),
  };
}

/* ═══════════════════════════════════════════════════════════
   CONTENT & SEO
   ═══════════════════════════════════════════════════════════ */
async function fetchContent(from?: string, to?: string) {
  // jobs has first_seen_at, not created_at; blog_posts keeps created_at.
  const jobsWhere = customDateFilter("first_seen_at", from, to);
  if (from && to) {
    const filter = dateFilter(from, to);
    const [blogTotal, blogMonth, companies, roles, jobsPages] = await Promise.all([
      q<{ n: string }>("select count(*)::text n from blog_posts"),
      q<{ n: string }>(`select count(*)::text n from blog_posts where ${filter.where}`, filter.params),
      q<{ n: string }>("select count(*)::text n from companies"),
      q<{ n: string }>("select count(*)::text n from roles"),
      q<{ n: string }>(`select count(*)::text n from jobs where ${jobsWhere}`, filter.params),
    ]);

    return {
      blogPostsTotal: num(blogTotal[0]?.n),
      blogPostsThisMonth: num(blogMonth[0]?.n),
      companiesIndexed: num(companies[0]?.n),
      rolesIndexed: num(roles[0]?.n),
      jobsListed: num(jobsPages[0]?.n),
    };
  }

  const [blogTotal, blogMonth, companies, roles, jobsPages] = await Promise.all([
    q<{ n: string }>("select count(*)::text n from blog_posts"),
    q<{ n: string }>("select count(*)::text n from blog_posts where created_at >= now() - interval '30 days'"),
    q<{ n: string }>("select count(*)::text n from companies"),
    q<{ n: string }>("select count(*)::text n from roles"),
    q<{ n: string }>("select count(*)::text n from jobs where first_seen_at >= now() - interval '30 days'"),
  ]);

  return {
    blogPostsTotal: num(blogTotal[0]?.n),
    blogPostsThisMonth: num(blogMonth[0]?.n),
    companiesIndexed: num(companies[0]?.n),
    rolesIndexed: num(roles[0]?.n),
    jobsListed: num(jobsPages[0]?.n),
  };
}

/* ═══════════════════════════════════════════════════════════
   RESUME GENERATION & AI
   ═══════════════════════════════════════════════════════════ */
async function fetchGeneration(from?: string, to?: string) {
  if (from && to) {
    const filter = dateFilter(from, to);
    const resumeDateWhere = filter.where.replace(/\bcreated_at\b/g, "rv.created_at");
    const [total, today, month, trend, speeds, topRoles, topCompanies, errors] = await Promise.all([
      q<{ n: string }>("select count(*)::text n from resumes"),
      q<{ n: string }>(`select count(*)::text n from resumes where ${filter.where}`, filter.params),
      q<{ n: string }>(`select count(*)::text n from resumes where ${filter.where}`, filter.params),
      q<{ d: string; n: string }>(
        `select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') d, count(*)::text n
         from resumes where ${filter.where} group by date_trunc('day', created_at at time zone 'UTC') order by d`,
        filter.params,
      ),
      q<{
        avg_ats: string;
        p95_ats: string;
        avg_ms: string;
        p95_ms: string;
        free_avg_ms: string;
        premium_avg_ms: string;
      }>(
        `select
                round(avg(r.ats_score) filter (where r.ats_score is not null))::text avg_ats,
                round(percentile_cont(0.95) within group (order by r.ats_score)
                  filter (where r.ats_score is not null))::text p95_ats,
                round(avg(r.gen_ms) filter (where r.gen_ms is not null))::text avg_ms,
                round(percentile_cont(0.95) within group (order by r.gen_ms)
                  filter (where r.gen_ms is not null))::text p95_ms,
                round(avg(r.gen_ms) filter (
                  where r.gen_ms is not null
                    and coalesce(u.premium_until, 'epoch'::timestamptz) <= r.created_at
                ))::text free_avg_ms,
                round(avg(r.gen_ms) filter (
                  where r.gen_ms is not null and u.premium_until > r.created_at
                ))::text premium_avg_ms
         from resumes r
         left join users u on r.user_id_text = u.id::text
         where ${utcDateFilter("r.created_at")}`,
        filter.params,
      ),
      q<{ t: string; n: string }>(
        `select coalesce(r.title, 'Unknown') t, count(*)::text n
         from resumes rv left join roles r on r.id = rv.role_id
         where ${resumeDateWhere} group by r.title order by count(*) desc limit 10`,
        filter.params,
      ),
      q<{ n: string; c: string }>(
        `select coalesce(c.name, 'Unknown') c, count(*)::text n
         from resumes rv left join companies c on c.id = rv.company_id
         where ${resumeDateWhere} group by c.name order by count(*) desc limit 10`,
        filter.params,
      ),
      q<{ n: string }>(
        `select count(*)::text n from resumes r join credit_events ce on ce.resume_id=r.id where ce.kind='refund_failed_generation' and ${utcDateFilter("r.created_at")}`,
        [from, to],
      ),
    ]);

    return {
      totalResumes: num(total[0]?.n),
      generatedToday: num(today[0]?.n),
      generatedThisMonth: num(month[0]?.n),
      avgAtsScore: Math.round(num(speeds[0]?.avg_ats)),
      p95AtsScore: Math.round(num(speeds[0]?.p95_ats)),
      avgSpeed: formatMilliseconds(speeds[0]?.avg_ms),
      p95Speed: formatMilliseconds(speeds[0]?.p95_ms),
      freeAvgSpeed: formatMilliseconds(speeds[0]?.free_avg_ms),
      premiumAvgSpeed: formatMilliseconds(speeds[0]?.premium_avg_ms),
      generationTrend: trend.map((r) => ({ d: r.d, count: num(r.n) })),
      topRoles: topRoles.map((r) => ({ title: r.t, count: num(r.n) })),
      topCompanies: topCompanies.map((r) => ({ name: r.c, count: num(r.n) })),
      errors24h: num(errors[0]?.n),
    };
  }

  const [
    total, today, month, trend, speeds, topRoles, topCompanies, errors,
  ] = await Promise.all([
    q<{ n: string }>("select count(*)::text n from resumes"),
    q<{ n: string }>("select count(*)::text n from resumes where created_at >= date_trunc('day', now())"),
    q<{ n: string }>("select count(*)::text n from resumes where created_at >= now() - interval '30 days'"),
    q<{ d: string; n: string }>(
      `select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') d, count(*)::text n
       from resumes where created_at >= now() - interval '30 days' group by date_trunc('day', created_at at time zone 'UTC') order by d`,
    ),
    q<{
      avg_ats: string;
      p95_ats: string;
      avg_ms: string;
      p95_ms: string;
      free_avg_ms: string;
      premium_avg_ms: string;
    }>(
      `select
              round(avg(r.ats_score) filter (where r.ats_score is not null))::text avg_ats,
              round(percentile_cont(0.95) within group (order by r.ats_score)
                filter (where r.ats_score is not null))::text p95_ats,
              round(avg(r.gen_ms) filter (where r.gen_ms is not null))::text avg_ms,
              round(percentile_cont(0.95) within group (order by r.gen_ms)
                filter (where r.gen_ms is not null))::text p95_ms,
              round(avg(r.gen_ms) filter (
                where r.gen_ms is not null
                  and coalesce(u.premium_until, 'epoch'::timestamptz) <= r.created_at
              ))::text free_avg_ms,
              round(avg(r.gen_ms) filter (
                where r.gen_ms is not null and u.premium_until > r.created_at
              ))::text premium_avg_ms
       from resumes r
       left join users u on r.user_id_text = u.id::text
       where r.created_at >= now() - interval '30 days'`,
    ),
    q<{ t: string; n: string }>(
      `select coalesce(r.title, 'Unknown') t, count(*)::text n
       from resumes rv left join roles r on r.id = rv.role_id
       where rv.created_at >= now() - interval '30 days' group by r.title order by count(*) desc limit 10`,
    ),
    q<{ n: string; c: string }>(
      `select coalesce(c.name, 'Unknown') c, count(*)::text n
       from resumes rv left join companies c on c.id = rv.company_id
       where rv.created_at >= now() - interval '30 days' group by c.name order by count(*) desc limit 10`,
    ),
    q<{ n: string }>(
      `select count(*)::text n from resumes r join credit_events ce on ce.resume_id=r.id where ce.kind='refund_failed_generation' and r.created_at >= now() - interval '24 hours'`,
    ),
  ]);

  return {
    totalResumes: num(total[0]?.n),
    generatedToday: num(today[0]?.n),
    generatedThisMonth: num(month[0]?.n),
    avgAtsScore: Math.round(num(speeds[0]?.avg_ats)),
    p95AtsScore: Math.round(num(speeds[0]?.p95_ats)),
    avgSpeed: formatMilliseconds(speeds[0]?.avg_ms),
    p95Speed: formatMilliseconds(speeds[0]?.p95_ms),
    freeAvgSpeed: formatMilliseconds(speeds[0]?.free_avg_ms),
    premiumAvgSpeed: formatMilliseconds(speeds[0]?.premium_avg_ms),
    generationTrend: trend.map((r) => ({ d: r.d, count: num(r.n) })),
    topRoles: topRoles.map((r) => ({ title: r.t, count: num(r.n) })),
    topCompanies: topCompanies.map((r) => ({ name: r.c, count: num(r.n) })),
    errors24h: num(errors[0]?.n),
  };
}

/* ═══════════════════════════════════════════════════════════
   JOBS & APPLICATIONS
   ═══════════════════════════════════════════════════════════ */
async function fetchJobs(from?: string, to?: string) {
  // jobs has first_seen_at, not created_at; applications keeps created_at.
  const jobsWhere = from && to ? utcDateFilter("first_seen_at") : "first_seen_at >= now() - interval '24 hours'";
  if (from && to) {
    const filter = dateFilter(from, to);
    const applicationFilter = dateFilter(from, to, "applications.created_at");
    const [total, jobsInRange, countries, appsInRange, appStatuses] = await Promise.all([
      q<{ n: string }>("select count(*)::text n from jobs"),
      q<{ n: string }>(`select count(*)::text n from jobs where ${jobsWhere}`, filter.params),
      q<{ c: string; n: string }>(
        `select country_code c, count(*)::text n from jobs where ${jobsWhere} group by country_code order by count(*) desc limit 20`,
        filter.params,
      ),
      q<{ n: string }>(`select count(*)::text n from applications where ${applicationFilter.where}`, applicationFilter.params),
      q<{ s: string; n: string }>(
        `select status s, count(*)::text n from applications where ${applicationFilter.where} group by status order by count(*) desc limit 20`,
        applicationFilter.params,
      ),
    ]);

    return {
      totalJobs: num(total[0]?.n),
      jobsInRange: num(jobsInRange[0]?.n),
      applicationsInRange: num(appsInRange[0]?.n),
      countryBreakdown: countries.map((r) => ({ code: r.c, flag: FLAG(r.c), count: num(r.n) })),
      applicationStatuses: appStatuses.map((r) => ({ status: r.s, count: num(r.n) })),
    };
  }

  const [total, fresh, countries, apps, appStatuses] = await Promise.all([
    q<{ n: string }>("select count(*)::text n from jobs"),
    q<{ n: string }>("select count(*)::text n from jobs where first_seen_at >= now() - interval '24 hours'"),
    q<{ c: string; n: string }>(
      `select country_code c, count(*)::text n from jobs group by country_code order by count(*) desc limit 20`,
    ),
    q<{ n: string }>("select count(*)::text n from applications"),
    q<{ s: string; n: string }>(
      `select status s, count(*)::text n from applications group by status order by count(*) desc`,
    ),
  ]);

  return {
    totalJobs: num(total[0]?.n),
    freshJobs24h: num(fresh[0]?.n),
    totalApplications: num(apps[0]?.n),
    countryBreakdown: countries.map((r) => ({ code: r.c, flag: FLAG(r.c), count: num(r.n) })),
    applicationStatuses: appStatuses.map((r) => ({ status: r.s, count: num(r.n) })),
  };
}

/* ═══════════════════════════════════════════════════════════
   REALTIME STATUS
   ═══════════════════════════════════════════════════════════ */
async function fetchRealtime() {
  const generatedAt = new Date().toISOString();
  const [activeVisitors, queueStats] = await Promise.all([
    q<{ n: string }>(
      `select count(distinct session_id)::text n from page_views where created_at >= now() - interval '5 minutes'`,
    ).then((rows) => ({ available: true as const, count: num(rows[0]?.n) }))
      .catch(() => ({ available: false as const, count: null })),
    resumeQueue.getJobCounts("waiting", "active", "failed", "delayed", "paused")
      .then((counts) => ({ available: true as const, counts }))
      .catch(() => ({ available: false as const, counts: null })),
  ]);

  return {
    generatedAt,
    activeVisitors5m: activeVisitors,
    generationQueue: queueStats,
  };
}

function num(s: string | undefined): number {
  return Number(s ?? 0) || 0;
}

function formatMilliseconds(value: string | undefined): string {
  const milliseconds = num(value);
  if (!milliseconds) return "—";
  return milliseconds >= 1_000
    ? `${(milliseconds / 1_000).toFixed(1)}s`
    : `${milliseconds}ms`;
}
