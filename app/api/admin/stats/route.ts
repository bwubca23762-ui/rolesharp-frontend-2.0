import { NextResponse } from "next/server";
import os from "os";
import fs from "fs";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { resumeQueue } from "@/lib/queue";
import { keyStats } from "@/lib/llm";
import { PLANS } from "@/lib/entitlements";
import { getUsageLimits } from "@/lib/settings";
import { now } from "@/lib/nowpay";
import { env } from "@/lib/env";
import { jobIndexHealth } from "@/lib/jobs";

export const runtime = "nodejs";

const STATS_TTL_MS = 15_000;
let cachedStats: { expiresAt: number; payload: unknown } | null = null;

export async function GET(req: Request) {
  if (!(await hasAdminPermission("analytics.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // ?fresh=1 is the manual-refresh bypass: the admin panel's Refresh button
  // must not be served the same 15s cache the previous click just read.
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  if (!fresh && cachedStats && cachedStats.expiresAt > Date.now()) {
    return NextResponse.json(cachedStats.payload, { headers: { "X-RoleSharp-Cache": "HIT" } });
  }

  const [
    userMetricRows,
    resumeMetricRows,
    paymentMetricRows,
    supportMetricRows,
    studentMetricRows,
    internshipMetricRows,
    razorpayMetrics,
  ] = await Promise.all([
    q<{
      users: string;
      premium_users: string;
      student_users: string;
      signups_today: string;
      verified_users: string;
    }>(`select
          count(*)::text users,
          count(*) filter (where premium_until > now())::text premium_users,
          count(*) filter (where premium_until > now() and premium_source = 'student')::text student_users,
          count(*) filter (where created_at >= date_trunc('day', now()))::text signups_today,
          count(*) filter (where email_verified_at is not null)::text verified_users
        from users`),
    q<{
      resumes: string;
      resumes_today: string;
      avg_ats: string;
      low_ats: string;
      with_jd: string;
      avg_gen_ms: string;
      p95_gen_ms: string;
      free_resumes: string;
      premium_resumes: string;
      free_avg_gen_ms: string;
      premium_avg_gen_ms: string;
    }>(`select
          count(*)::text resumes,
          count(*) filter (where r.created_at >= date_trunc('day', now()))::text resumes_today,
          coalesce(round(avg(r.ats_score) filter (where r.ats_score is not null)), 0)::text avg_ats,
          count(*) filter (where r.ats_score < 70)::text low_ats,
          count(*) filter (where coalesce(length(r.jd_text), 0) > 0)::text with_jd,
          coalesce(round(avg(r.gen_ms) filter (where r.gen_ms is not null)), 0)::text avg_gen_ms,
          coalesce(percentile_disc(0.95) within group (order by r.gen_ms)
            filter (where r.gen_ms is not null), 0)::text p95_gen_ms,
          count(*) filter (
            where coalesce(u.premium_until, 'epoch'::timestamptz) <= r.created_at
          )::text free_resumes,
          count(*) filter (where u.premium_until > r.created_at)::text premium_resumes,
          coalesce(round(avg(r.gen_ms) filter (
            where r.gen_ms is not null
              and coalesce(u.premium_until, 'epoch'::timestamptz) <= r.created_at
          )), 0)::text free_avg_gen_ms,
          coalesce(round(avg(r.gen_ms) filter (
            where r.gen_ms is not null and u.premium_until > r.created_at
          )), 0)::text premium_avg_gen_ms
        from resumes r
        left join users u on r.user_id_text = u.id::text`),
    q<{
      pay_rows: string;
      revenue: string;
      revenue_30: string;
      successful_payments: string;
      failed_payments: string;
    }>(`select
          count(*)::text pay_rows,
          coalesce(sum(price_amount) filter (where status in ('finished','confirmed')), 0)::text revenue,
          coalesce(sum(price_amount) filter (
            where status in ('finished','confirmed')
              and created_at >= now() - interval '30 days'
          ), 0)::text revenue_30,
          count(*) filter (where status in ('finished','confirmed'))::text successful_payments,
          count(*) filter (where status in ('failed','expired','refunded','validation_failed','invoice_failed','invoice_unknown','cancelled'))::text failed_payments
        from crypto_payments`),
    q<{ open_tickets: string }>(
      "select count(*) filter (where status='open')::text open_tickets from support_tickets",
    ),
    q<{ pending_students: string }>(`select count(*)::text pending_students from (
      select distinct on (student_email) student_email, expires_at
      from student_verification_tokens
      where used_at is null
        and not exists (select 1 from student_claims sc where sc.student_email=student_verification_tokens.student_email)
      order by student_email, created_at desc
    ) pending where expires_at > now()`),
    q<{ pending_reports: string }>(
      "select count(*) filter (where status='pending')::text pending_reports from internship_reports",
    ).catch(() => [{ pending_reports: "0" }]),
    q<{ currency: string; paid: number; failed: number; revenue: string; revenue_30: string }>(`select currency,
      count(*) filter(where status='paid')::int paid,
      count(*) filter(where status in ('failed','refunded'))::int failed,
      coalesce(sum(amount_paise) filter(where status='paid'),0)::numeric/100 as revenue,
      coalesce(sum(amount_paise) filter(where status='paid' and created_at>=now()-interval '30 days'),0)::numeric/100 as revenue_30
      from razorpay_payments group by currency order by currency`),
  ]);
  const userMetrics = userMetricRows[0];
  const resumeMetrics = resumeMetricRows[0];
  const paymentMetrics = paymentMetricRows[0];
  const users = Number(userMetrics?.users ?? 0);
  const premiumUsers = Number(userMetrics?.premium_users ?? 0);
  const studentUsers = Number(userMetrics?.student_users ?? 0);
  const signupsToday = Number(userMetrics?.signups_today ?? 0);
  const verifiedUsers = Number(userMetrics?.verified_users ?? 0);
  const resumes = Number(resumeMetrics?.resumes ?? 0);
  const resumesToday = Number(resumeMetrics?.resumes_today ?? 0);
  const avgAts = Number(resumeMetrics?.avg_ats ?? 0);
  const lowAts = Number(resumeMetrics?.low_ats ?? 0);
  const withJd = Number(resumeMetrics?.with_jd ?? 0);
  const avgGenMs = Number(resumeMetrics?.avg_gen_ms ?? 0);
  const p95GenMs = Number(resumeMetrics?.p95_gen_ms ?? 0);
  const freeResumes = Number(resumeMetrics?.free_resumes ?? 0);
  const premiumResumes = Number(resumeMetrics?.premium_resumes ?? 0);
  const freeAvgGenMs = Number(resumeMetrics?.free_avg_gen_ms ?? 0);
  const premiumAvgGenMs = Number(resumeMetrics?.premium_avg_gen_ms ?? 0);
  const payRows = Number(paymentMetrics?.pay_rows ?? 0);
  const revenue = Number(paymentMetrics?.revenue ?? 0);
  const revenue30 = Number(paymentMetrics?.revenue_30 ?? 0);
  const successfulPayments = Number(paymentMetrics?.successful_payments ?? 0);
  const failedPayments = Number(paymentMetrics?.failed_payments ?? 0);
  const openTickets = Number(supportMetricRows[0]?.open_tickets ?? 0);
  const pendingStudents = Number(studentMetricRows[0]?.pending_students ?? 0);
  const pendingInternshipReports = Number(internshipMetricRows[0]?.pending_reports ?? 0);
  const [queueDepth, queueCounts, jobs, usageLimits] = await Promise.all([
    resumeQueue.count().catch(() => -1),
    resumeQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused").catch(() => ({})),
    jobIndexHealth().catch(() => ({ total: 0, fresh: 0, last_seen_at: null, countries: [], runs: [] })),
    getUsageLimits(),
  ]);

  const [
    perDay,
    recentUsers,
    recentResumes,
    recentPayments,
    paymentStatus,
    paymentPlans,
    recentSlow,
    recentFailures,
    topCompanies,
    topRoles,
    adminActions,
  ] = await Promise.all([
    q(
    `select to_char(date_trunc('day', created_at),'MM-DD') d, count(*)::int n
     from resumes where created_at >= now() - interval '7 days'
     group by 1 order by 1`,
    ),
    q(
    `select u.premium_until, u.created_at, count(r.id)::int resumes
     from users u
     left join resumes r on r.user_id_text=u.id::text
     group by u.id, u.premium_until, u.created_at
     order by u.created_at desc limit 12`,
    ),
    q(
    `select r.ats_score, r.template, r.created_at,
            case when coalesce(length(r.jd_text),0) > 0 then true else false end as has_jd
     from resumes r order by r.created_at desc limit 12`,
    ),
    q(
    `select p.status, p.plan, p.price_amount, p.pay_currency, p.created_at
     from crypto_payments p order by p.created_at desc limit 12`,
    ),
    q(
    `select status, count(*)::int n, coalesce(sum(price_amount),0)::numeric amount
     from crypto_payments group by status order by n desc`,
    ),
    q(
    `select plan, count(*)::int n, coalesce(sum(price_amount),0)::numeric amount
     from crypto_payments group by plan order by n desc`,
    ),
    q(
    `select gen_ms, ats_score, created_at
     from resumes where gen_ms is not null order by gen_ms desc limit 8`,
    ),
    q(
    // A WHERE is the whole point: without it the 8 newest payments of ANY
    // status were returned and the overview filtered them in JS, so "Latest
    // failed payments" read "none" whenever the newest payments succeeded.
    `select status, plan, price_amount, pay_currency, created_at
     from crypto_payments
     where status in ('failed','expired','refunded','validation_failed','invoice_failed','invoice_unknown','cancelled')
     order by created_at desc limit 8`,
    ),
    q(
    `select c.name, count(*)::int n from resumes r join companies c on c.id=r.company_id
     group by c.name order by n desc limit 6`,
    ),
    q(
    `select ro.title, count(*)::int n from resumes r join roles ro on ro.id=r.role_id
     group by ro.title order by n desc limit 6`,
    ),
    q(
    `select action, created_at
     from admin_actions order by created_at desc limit 8`,
    ).catch(() => []),
  ]);
  const mem = process.memoryUsage();
  const disk = (() => {
    try {
      const d = fs.statfsSync("/");
      const total = d.blocks * d.bsize;
      const free = d.bavail * d.bsize;
      return { total, free, used: total - free, usedPct: total ? Math.round(((total - free) / total) * 100) : 0 };
    } catch {
      return null;
    }
  })();

  const payload = {
    totals: {
      users,
      freeUsers: Math.max(0, users - premiumUsers),
      premiumUsers,
      paidUsers: Math.max(0, premiumUsers - studentUsers),
      studentUsers,
      resumes,
      signupsToday,
      resumesToday,
      payRows,
      revenue,
      revenueCurrency: "USD",
      avgAts,
      lowAts,
      withJd,
      avgGenMs,
      p95GenMs,
      freeResumes,
      premiumResumes,
      freeAvgGenMs,
      premiumAvgGenMs,
      verifiedUsers,
      revenue30,
      successfulPayments,
      failedPayments,
    },
    health: {
      queueDepth,
      queueCounts,
      keys: keyStats(),
      workerConcurrency: env.workerConcurrency,
      maxQueueDepth: env.maxQueueDepth,
      jobs,
    },
    system: {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()} ${os.arch()}`,
      uptimeSec: Math.round(os.uptime()),
      loadAvg: os.loadavg(),
      cpuCount: os.cpus().length,
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      processUptimeSec: Math.round(process.uptime()),
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      disk,
      node: process.version,
      pid: process.pid,
    },
    payments: {
      nowpayments: {
        live: now.live,
        dev: now.dev,
        apiKeyConfigured: !!now.apiKey,
        ipnSecretConfigured: !!now.ipnSecret,
        currency: now.currency,
      },
      plans: Object.values(PLANS).map((p) => ({ id: p.id, label: p.label, price: p.cents / 100, days: p.days })),
      status: paymentStatus,
      byPlan: paymentPlans,
      razorpay: razorpayMetrics.map((row) => ({ currency: row.currency.trim(), paid: row.paid, failed: row.failed, revenue: Number(row.revenue), revenue30: Number(row.revenue_30) })),
    },
    support: { openCount: openTickets },
    students: { pendingCount: pendingStudents },
    internshipReports: { pendingCount: pendingInternshipReports },
    limits: { freeMonthly: usageLimits.freeMonthly, premiumMonthly: usageLimits.premiumMonthly },
    perDay, recentUsers, recentResumes, topCompanies, topRoles, recentPayments, recentSlow, recentFailures, adminActions,
  };
  cachedStats = { expiresAt: Date.now() + STATS_TTL_MS, payload };
  return NextResponse.json(payload, { headers: { "X-RoleSharp-Cache": "MISS" } });
}
