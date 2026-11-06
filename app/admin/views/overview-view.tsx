"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, CreditCard, FileText, LifeBuoy, Server, Shield, Sparkles, Users } from "@/app/icons";
import { Button } from "@/components/ui/primitives";
import { PageHeader, TrendChart } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { useAdminConfirm } from "../confirm-dialog";
import type { AdminStats as S } from "../admin-types";
import { adminFetchJson, formatDuration, formatMs, timeAgo } from "../admin-helpers";

export default function Overview({ s, onRefresh, permissions = [] }: { s: S; onRefresh: () => void; permissions?: readonly string[] }) {
  const t = s.totals;
  const [trends, setTrends] = useState<any>(null);
  useAdminRefreshSignal(() => { fetch("/api/admin/trends").then((r) => r.ok ? r.json() : null).then(setTrends).catch(() => {}); });
  useEffect(() => { fetch("/api/admin/trends").then((r) => r.ok ? r.json() : null).then(setTrends).catch(() => {}); }, []);
  const conversion = t.users ? (((t.paidUsers ?? 0) / t.users) * 100).toFixed(1) : "0.0";
  const verification = t.users ? ((t.verifiedUsers / t.users) * 100).toFixed(1) : "0.0";
  // `disk` is null wherever statfs is unavailable, so treat "unknown" as 0% rather
  // than comparing undefined and silently never raising the alert.
  const diskUsedPct = s.system?.disk?.usedPct ?? 0;
  const latestFailures = (s.recentFailures || []).slice(0, 3); // server-side WHERE already returns only failures
  const issues = [
    s.health?.queueDepth === -1 ? { label: "Resume queue telemetry is unavailable", href: "/admin/system", level: "warning" } : null,
    s.health?.queueCounts?.failed ? { label: `${s.health.queueCounts.failed} failed queue jobs`, href: "/admin/system", level: "danger" } : null,
    s.support?.openCount ? { label: `${s.support.openCount} open support tickets`, href: "/admin/support", level: "warning" } : null,
    s.students?.pendingCount ? { label: `${s.students.pendingCount} student confirmations waiting`, href: "/admin/students", level: "warning" } : null,
    s.internshipReports?.pendingCount ? { label: `${s.internshipReports.pendingCount} internship safety reports waiting`, href: "/admin/internship-reports", level: "warning" } : null,
    diskUsedPct > 85 ? { label: `Disk usage is ${diskUsedPct}%`, href: "/admin/system", level: "danger" } : null,
    s.health?.keys?.available === 0 ? { label: "No AI keys are currently available", href: "/admin/system", level: "danger" } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; level: string }>;

  return (
    <>
      <PageHeader title="Business overview" desc="Live product health, growth, revenue, and customer operations." onRefresh={onRefresh} />

      <section className="admin-priority-panel" aria-labelledby="priority-heading">
        <div className="admin-section-heading">
          <div>
            <h2 id="priority-heading">{issues.length ? "Needs attention" : "Operations"}</h2>
            <p className="admin-priority-description">{issues.length ? `${issues.length} ${issues.length === 1 ? "item to review" : "items to review"}` : "No operational alerts are currently reported."}</p>
          </div>
          <Link href="/admin/system">System health <ChevronRight size={14} aria-hidden /></Link>
        </div>
        {issues.length > 0 && (
          <div className="admin-priority-list">
            {issues.map((issue) => <Link key={issue.label} href={issue.href} className={issue.level}><span aria-hidden /><b>{issue.label}</b><ChevronRight size={17} aria-hidden /></Link>)}
          </div>
        )}
      </section>

      <section aria-labelledby="admin-overview-metrics">
        <h2 id="admin-overview-metrics" className="admin-overview-heading">Product at a glance</h2>
      <div className="admin-executive-grid">
        <ExecutiveStat icon={<Users size={20} />} label="Total users" value={t.users} detail={`${t.signupsToday} today, ${verification}% verified`} href="/admin/users" series={trends?.signups} trendLabel="Daily signups" />
        <ExecutiveStat icon={<Sparkles size={20} />} label="Premium users" value={t.premiumUsers} detail={`${conversion}% of all accounts are on paid plans`} href="/admin/users?filter=premium" series={trends?.premiumCohorts} trendLabel="Current premium accounts by signup day" />
        <ExecutiveStat icon={<FileText size={20} />} label="Resumes generated" value={t.resumes} detail={`${t.resumesToday} today, average ATS ${t.avgAts}`} href="/admin/resumes" series={trends?.resumes} trendLabel="Daily resume generations" />
        <ExecutiveStat icon={<CreditCard size={20} />} label="Crypto revenue in USD" value={`$${Number(t.revenue || 0).toLocaleString()}`} detail={`$${Number(t.revenue30 || 0).toLocaleString()} in the last 30 days`} href="/admin/payments" series={trends?.revenue} trendLabel="Daily settled crypto invoice value in USD" />
        <ExecutiveStat icon={<Shield size={20} />} label="Verified accounts" value={t.verifiedUsers} detail={`${verification}% of all accounts`} href="/admin/users" series={trends?.verifiedCohorts} trendLabel="Currently verified accounts by signup day" />
        <ExecutiveStat icon={<LifeBuoy size={20} />} label="Open support" value={s.support?.openCount ?? 0} detail="Tickets awaiting resolution" href="/admin/support" series={trends?.openTicketCohorts} trendLabel="Currently open tickets by creation day" />
      </div>
      </section>

      <p className="mb-5 text-xs text-[var(--muted-fg)]">Charts cover 30 UTC days. Premium, verified-account, and open-ticket charts group current records by their original creation date.</p>

      <section className="admin-dashboard-panel" aria-labelledby="plan-mix-heading" style={{ marginBottom: 18 }}>
        <div className="admin-section-heading"><div><h2 id="plan-mix-heading">Account breakdown</h2></div><Link href="/admin/users">Manage users <ChevronRight size={14} /></Link></div>
        <div className="admin-plan-mix">
          <PlanMixRow label="Free" value={t.freeUsers} total={t.users} href="/admin/users?filter=free" tone="var(--muted-fg)" />
          <PlanMixRow label="Paid premium" value={t.paidUsers ?? 0} total={t.users} href="/admin/users?filter=paid" tone="var(--secondary)" />
          <PlanMixRow label="Student premium" value={t.studentUsers ?? 0} total={t.users} href="/admin/users?filter=student" tone="var(--success)" />
        </div>
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-dashboard-panel admin-dashboard-wide">
          <div className="admin-section-heading"><div><h2>Product activity</h2></div><Link href="/admin/analytics">Full analytics <ChevronRight size={14} /></Link></div>
          <div className="admin-trend-grid">
            <TrendChart label="Resumes / day" series={trends?.resumes} />
            <TrendChart label="Signups / day" series={trends?.signups} color="var(--success)" />
          </div>
        </section>

        <section className="admin-dashboard-panel">
          <div className="admin-section-heading"><div><h2>Quick actions</h2></div></div>
          <div className="admin-quick-actions">
            <QuickAction icon={<Users size={17} />} title="Find a user" detail="Account and entitlements" href="/admin/users" />
            <QuickAction icon={<LifeBuoy size={17} />} title="Answer support" detail={`${s.support?.openCount ?? 0} open tickets`} href="/admin/support" />
            <QuickAction icon={<Sparkles size={17} />} title="Review students" detail={`${s.students?.pendingCount ?? 0} awaiting confirmation`} href="/admin/students" />
            <QuickAction icon={<Shield size={17} />} title="Moderate reports" detail={`${s.internshipReports?.pendingCount ?? 0} awaiting review`} href="/admin/internship-reports" />
            <QuickAction icon={<Server size={17} />} title="System controls" detail="Queues, keys, logs" href="/admin/system" />
          </div>
        </section>

        <section className="admin-dashboard-panel">
          <div className="admin-section-heading"><div><h2>Runtime health</h2></div><Link href="/admin/system">Inspect <ChevronRight size={14} /></Link></div>
          <div className="admin-health-list">
            <HealthItem label="Resume queue" value={s.health?.queueDepth === -1 ? "Unavailable" : `${s.health?.queueDepth ?? "—"} waiting`} ok={(s.health?.queueDepth ?? -1) >= 0 && !s.health?.queueCounts?.failed} meta={`${s.health?.queueCounts?.active ?? 0} active`} />
            <HealthItem label="AI capacity" value={`${s.health?.keys?.available ?? 0}/${s.health?.keys?.total ?? 0} keys`} ok={(s.health?.keys?.available ?? 0) > 0} meta={`${s.health?.workerConcurrency ?? "—"} workers`} />
            <HealthItem label="Generation" value={formatMs(t.avgGenMs)} ok={!t.p95GenMs || t.p95GenMs < 60000} meta={`P95 ${formatMs(t.p95GenMs)}`} />
            <HealthItem label="Disk" value={`${s.system?.disk?.usedPct ?? "—"}% used`} ok={!s.system?.disk || s.system.disk.usedPct < 85} meta={formatDuration(s.system?.uptimeSec)} />
          </div>
        </section>

        <section className="admin-dashboard-panel admin-dashboard-wide">
          <div className="admin-section-heading"><div><h2>Recent customer activity</h2></div><Link href="/admin/users">View all users <ChevronRight size={14} /></Link></div>
          <div className="admin-activity-table-wrap" role="region" aria-label="Recent customer activity table" tabIndex={0}>
            <table className="admin-activity-table">
              <thead><tr><th>User</th><th>Plan</th><th>Resumes</th><th>Joined</th></tr></thead>
              <tbody>
                {!s.recentUsers?.length && <tr><td colSpan={4}>No recent customer activity.</td></tr>}
                {(s.recentUsers || []).slice(0, 6).map((user: any) => (
                  <tr key={`${user.created_at}-${user.resumes}`}><td><span className="admin-user-initial">U</span><b>New account</b></td><td><span className={`admin-plan-pill ${user.premium_until && new Date(user.premium_until) > new Date() ? "premium" : "free"}`}>{user.premium_until && new Date(user.premium_until) > new Date() ? "Premium" : "Free"}</span></td><td>{user.resumes ?? 0}</td><td>{timeAgo(user.created_at)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-dashboard-panel">
          <div className="admin-section-heading"><div><h2>Revenue status</h2></div><Link href="/admin/payments">Open billing <ChevronRight size={14} /></Link></div>
          <div className="admin-health-list">
            <HealthItem label="Crypto · successful" value={t.successfulPayments ?? 0} ok meta="All time" />
            <HealthItem label="Crypto · failed / expired" value={t.failedPayments ?? 0} ok={!(t.failedPayments > 0)} meta="Requires review" />
            <HealthItem label="NOWPayments" value={s.payments?.nowpayments?.live ? "Live" : "Not live"} ok={!!s.payments?.nowpayments?.live} meta={s.payments?.nowpayments?.currency || "USD"} />
            {s.payments?.razorpay?.map((payment) => <HealthItem key={payment.currency} label={`Razorpay · ${payment.currency}`} value={new Intl.NumberFormat("en", { style: "currency", currency: payment.currency }).format(payment.revenue)} ok={payment.failed === 0} meta={`${payment.paid} paid · ${payment.failed} failed/refunded · ${new Intl.NumberFormat("en", { style: "currency", currency: payment.currency }).format(payment.revenue30)} in 30 days`} />)}
            {s.payments?.razorpay?.length === 0 && <p className="text-sm text-[var(--muted-fg)]">No Razorpay payments recorded yet.</p>}
          </div>
          {latestFailures.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <small className="admin-mini-head">Latest failures</small>
              {latestFailures.map((p: any, index: number) => (
                <div key={`${p.created_at}-${index}`} className="admin-mini-row">
                  <span>{p.plan || "monthly"} · ${p.price_amount ?? 0} {(p.pay_currency || "").toUpperCase()}</span>
                  <small>{p.status} · {timeAgo(p.created_at)}</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-dashboard-panel admin-dashboard-wide">
          <div className="admin-section-heading"><div><h2>What users are applying to</h2></div><Link href="/admin/analytics">Full analytics <ChevronRight size={14} /></Link></div>
          <div className="grid-2">
            <div>
              <small className="admin-mini-head">Top roles</small>
              {(s.topRoles || []).length === 0 && <p className="text-[var(--muted-fg)]" style={{ margin: 0 }}>No resume data yet.</p>}
              {(s.topRoles || []).map((role: any) => (
                <div key={role.title} className="admin-mini-row">
                  <span>{role.title}</span><b>{role.n}</b>
                </div>
              ))}
            </div>
            <div>
              <small className="admin-mini-head">Top companies</small>
              {(s.topCompanies || []).length === 0 && <p className="text-[var(--muted-fg)]" style={{ margin: 0 }}>No resume data yet.</p>}
              {(s.topCompanies || []).map((company: any) => (
                <div key={company.name} className="admin-mini-row">
                  <span>{company.name}</span><b>{company.n}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <AdminOperationalActions onRefresh={onRefresh} canManageSystem={permissions.includes("system.manage")} canManageJobs={permissions.includes("jobs.manage")} />
    </>
  );
}

function AdminOperationalActions({ onRefresh, canManageSystem, canManageJobs }: { onRefresh: () => void; canManageSystem: boolean; canManageJobs: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function run(label: string, endpoint: string, body?: Record<string, unknown>) {
    setBusy(label);
    setMessage("");
    try {
      const result = await adminFetchJson<{ removed?: number; retried?: number }>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!result.ok) throw new Error(result.error || "Action failed");
      const data = result.data ?? {};
      const detail = data.removed !== undefined ? ` (${data.removed} removed)` : data.retried !== undefined ? ` (${data.retried} retried)` : "";
      setMessage(`${label} completed${detail}.`);
      onRefresh();
    } catch (error) {
      setMessage(`${label} failed: ${error instanceof Error ? error.message : "unknown error"}`);
      throw error;
    } finally {
      setBusy("");
    }
  }

  return (
    (canManageSystem || canManageJobs) && <section className="admin-action-strip" aria-label="Operational actions">
      <div><span>Operator actions</span><strong>Keep the platform healthy</strong><small>These controls call the production admin APIs and record destructive operations.</small></div>
      <div className="admin-action-strip-buttons">
        {canManageSystem && <Button variant="outline" size="compact" disabled={!!busy} onClick={() => ask({ title: "Retry failed jobs", body: "Every failed resume job is retried now, up to its attempt cap.", word: "RETRY", run: () => run("Retry failed jobs", "/api/admin/queue", { action: "retryFailed" }) })}>{busy === "Retry failed jobs" ? "Working..." : "Retry failed jobs"}</Button>}
        {canManageJobs && <Button variant="outline" size="compact" disabled={!!busy} onClick={() => ask({ title: "Purge expired jobs", body: "All expired job listings are deleted. This cannot be undone.", word: "PURGE", run: () => run("Purge expired jobs", "/api/admin/job-listings", { action: "purgeExpired" }) })}>{busy === "Purge expired jobs" ? "Working..." : "Purge expired jobs"}</Button>}
        {canManageSystem && <Button variant="outline" size="compact" disabled={!!busy} onClick={() => ask({ title: "Purge CDN cache", body: "The configured CDN cache is purged; pages refill over the next few minutes.", word: "PURGE", run: () => run("Purge CDN cache", "/api/admin/cache") })}>{busy === "Purge CDN cache" ? "Working..." : "Purge CDN cache"}</Button>}
      </div>
      {message && <p className="admin-action-result" role="status">{message}</p>}
      {dialog}
    </section>
  );
}

function ExecutiveStat({ icon, label, value, detail, href, series, trendLabel }: { icon: any; label: string; value: any; detail: string; href: string; series?: Array<{ d: string; n: number }>; trendLabel: string }) {
  const maximum = Math.max(1, ...(series ?? []).map((point) => point.n));
  const points = series?.map((point, index) => `${index * 100 / Math.max(1, series.length - 1)},${26 - (point.n / maximum) * 23}`).join(" ");
  return <Link href={href} className="admin-executive-card"><span className="admin-executive-icon" aria-hidden>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p>{points && <svg className="mt-2 h-7 w-full text-[var(--primary)]" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label={`${trendLabel}, last 30 days in UTC`}><title>{trendLabel} · last 30 days (UTC)</title><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>}</div><ChevronRight size={17} /></Link>;
}

function QuickAction({ icon, title, detail, href }: { icon: any; title: string; detail: string; href: string }) {
  return <Link href={href}><span>{icon}</span><div><b>{title}</b><small>{detail}</small></div><ChevronRight size={16} /></Link>;
}

function HealthItem({ label, value, ok, meta }: { label: string; value: any; ok: boolean; meta: string }) {
  return <div className="admin-health-item"><span className={ok ? "ok" : "warn"} /><div><b>{label}</b><small>{meta}</small></div><strong>{value}</strong></div>;
}

/** One row of the account plan mix: label, share bar, count, and a filtered-list link. */
function PlanMixRow({ label, value, total, href, tone }: { label: string; value: number; total: number; href: string; tone: string }) {
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <Link href={href} className="admin-plan-mix-row">
      <span className="admin-plan-mix-label">{label}</span>
      <span className="admin-plan-mix-track">
        <span className="admin-plan-mix-fill" style={{ width: `${Math.max(share, value > 0 ? 2 : 0)}%`, background: tone }} />
      </span>
      <span className="admin-plan-mix-value">
        <b>{Number(value || 0).toLocaleString()}</b> <small>{share.toFixed(1)}%</small>
      </span>
    </Link>
  );
}
