"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download } from "@/app/icons";
import { Button, Notice } from "@/components/ui/primitives";
import { lastDaysRange, utcDayString } from "@/lib/analytics-range";
import {
  DataRow,
  MetricDrawer,
  PageHeader,
  SegmentedControl,
  StatCard,
  TrendChart,
  exportCsv,
} from "../admin-shared";
import Skeleton from "@/components/ui/Skeleton";

/** Every drill-down resolves to this one shape, so one drawer serves them all. */
type BreakdownRow = { label: string; value: number; meta?: string };
type Drill = {
  title: string;
  subtitle?: string;
  rows: BreakdownRow[];
  /** Column heading for the value column. */
  unit?: string;
  link?: { href: string; label: string };
  csvName?: string;
} | null;

type RangePreset = "default" | "7d" | "30d" | "90d" | "custom";

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "default", label: "Standard" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom" },
];

/** Range maths lives in lib/analytics-range.ts so it matches the server parser. */
function presetRange(preset: RangePreset): { from: string; to: string } | null {
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 0;
  return days ? lastDaysRange(days) : null;
}

function toRows(list: any[] | undefined, label: (item: any) => string, value: (item: any) => number): BreakdownRow[] {
  return (list || []).map((item) => ({ label: label(item), value: Number(value(item)) || 0 }));
}

export default function AnalyticsView({ canExport = false }: { canExport?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [preset, setPreset] = useState<RangePreset>("default");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [drill, setDrill] = useState<Drill>(null);
  const rangeRef = useRef<{ from: string; to: string } | null>(null);

  const load = useCallback(async (range: { from: string; to: string } | null, signal?: AbortSignal) => {
    const query = range ? `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : "";
    const response = await fetch(`/api/admin/analytics${query}`, { cache: "no-store", signal });
    const next = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        next.error === "date_range_too_large" ? "Choose a range of 366 days or less."
        : next.error === "rate_limited" ? "Too many refreshes. Wait a moment and try again."
        : next.error === "invalid_date_range" ? "Choose a valid range with the start on or before the end."
        : "Analytics data is temporarily unavailable.",
      );
    }
    rangeRef.current = range;
    setData(next);
    setError("");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(null, controller.signal)
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Analytics data is temporarily unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(async (range?: { from: string; to: string } | null) => {
    setRefreshing(true);
    try {
      await load(range === undefined ? rangeRef.current : range);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Analytics data is temporarily unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [load]);

  // Auto-refresh is opt-in: the endpoint is rate limited to 30/min and cached.
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  async function applyPreset(next: RangePreset) {
    setPreset(next);
    if (next === "custom") return;
    await refresh(presetRange(next));
  }

  const display = data;
  const traffic = display?.traffic;
  const users = display?.users;
  const revenue = display?.revenue;
  const funnel = display?.funnel;
  const content = display?.content;
  const generation = display?.generation;
  const jobs = display?.jobs;
  const realtime = display?.realtime;
  const isCustom = display?.range?.kind === "custom";

  const viewsSeries = useMemo(() => toRows(traffic?.dailyTrend, (d) => d.d, (d) => d.views), [traffic]);
  const visitorSeries = useMemo(() => toRows(traffic?.dailyTrend, (d) => d.d, (d) => d.visitors ?? 0), [traffic]);

  const openDaily = (title: string, rows: BreakdownRow[], csvName: string) =>
    setDrill({ title, subtitle: "One row per UTC day, newest last.", rows, unit: "Count", csvName });

  if (loading && !data) {
    return (
      <div style={{ padding: 24 }} aria-busy="true">
        <Skeleton variant="heading" width="12rem" />
        <div className="grid gap-3" style={{ marginTop: 12 }}>
          {[0, 1, 2, 3].map((row) => <Skeleton key={row} variant="table-row" />)}
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: 24 }}>
        <Notice variant="danger" role="alert">{error || "Analytics data is temporarily unavailable."}</Notice>
        <Button size="compact" type="button" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? "Retrying..." : "Retry"}
        </Button>
      </div>
    );
  }

  return (
    <div className="analytics-hub">
      <PageHeader

        title="Operational analytics"
        desc="Privacy-bounded aggregate metrics. Select any figure to see the rows behind it."
        onRefresh={() => void refresh()}
      >
        <label className="admin-autorefresh">
          <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
          Auto-refresh
        </label>
      </PageHeader>

      <div className="admin-analytics-bar">
        <SegmentedControl options={RANGE_OPTIONS} value={preset} onChange={(next) => void applyPreset(next)} ariaLabel="Date range" />
        {preset === "custom" && (
          <div className="admin-analytics-custom">
            <label className="sr-only" htmlFor="analytics-date-from">Analytics start date</label>
            <input id="analytics-date-from" type="date" max={utcDayString(0)} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="admin-table-search" style={{ width: 158 }} />
            <span className="text-[var(--muted-fg)]">to</span>
            <label className="sr-only" htmlFor="analytics-date-to">Analytics end date</label>
            <input id="analytics-date-to" type="date" max={utcDayString(0)} value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="admin-table-search" style={{ width: 158 }} />
            <Button size="compact" disabled={!dateFrom || !dateTo || refreshing} onClick={() => void refresh({ from: dateFrom, to: dateTo })}>
              {refreshing ? "Applying..." : "Apply"}
            </Button>
          </div>
        )}
        <span className="admin-analytics-meta">
          {display.timezone || "UTC"} · generated {display.generatedAt ? new Date(display.generatedAt).toLocaleTimeString() : "—"}
          {refreshing && " · refreshing..."}
        </span>
        {canExport && (
          <Button as="a" variant="outline" size="compact" href={`/api/admin/analytics/export${isCustom ? `?from=${encodeURIComponent(display.range.from)}&to=${encodeURIComponent(display.range.to)}` : ""}`}>
            <Download size={14} /> Export CSV
          </Button>
        )}
      </div>

      <p className="admin-analytics-contract text-[var(--muted-fg)]">
        {isCustom ? `${display.range.fromInclusive ?? display.range.from} inclusive to ${display.range.toExclusive ?? display.range.to} exclusive.` : display.range?.definition}
      </p>

      {error && <Notice variant="danger" role="alert" className="mb-4">{error}</Notice>}
      {display.warnings?.length > 0 && (
        <Notice variant="danger" role="status" className="mb-5">
          Some sections are temporarily unavailable: {display.warnings.map((warning: any) => warning.section).join(", ")}. Refresh to retry them.
        </Notice>
      )}

      {realtime && (
        <div className="rs-stagger admin-stat-grid">
          <StatCard
            label="Active visitors (5m)"
            value={realtime.activeVisitors5m?.available ? realtime.activeVisitors5m.count : "Unavailable"}
            accent={realtime.activeVisitors5m?.available ? "green" : "amber"}
            hint="Distinct sessions with a page view in the last five minutes."
          />
          <StatCard
            label="Queue waiting"
            value={realtime.generationQueue?.available ? realtime.generationQueue.counts.waiting ?? 0 : "Unavailable"}
            accent={realtime.generationQueue?.available && (realtime.generationQueue.counts.failed ?? 0) > 0 ? "red" : undefined}
            hint="Resume generation jobs waiting to be picked up. Opens system controls."
            href="/admin/system"
          />
          <StatCard label="Measured at" value={new Date(realtime.generatedAt).toLocaleTimeString()} hint="Server time this snapshot was taken." />
        </div>
      )}

      {traffic && (
        <>
          <h2 className="analytics-section-title">Traffic &amp; visitors</h2>
          <div className="rs-stagger admin-stat-grid">
            {isCustom ? (
              <>
                <StatCard label="Views in range" value={traffic.customRange?.views?.toLocaleString()} series={viewsSeries.map((row) => row.value)} onClick={() => openDaily("Views per day", viewsSeries, "views-by-day.csv")} hint="Total page views inside the selected range." />
                <StatCard label="Visitors in range" value={traffic.customRange?.visitors?.toLocaleString()} accent="green" series={visitorSeries.map((row) => row.value)} onClick={() => openDaily("Visitors per day", visitorSeries, "visitors-by-day.csv")} hint="Distinct sessions inside the selected range." />
                <StatCard label="Range length" value={`${display.range.days} days`} />
              </>
            ) : (
              <>
                <StatCard label="Views today" value={traffic.today?.views?.toLocaleString()} onClick={() => openDaily("Views per day", viewsSeries, "views-by-day.csv")} hint="Page views since 00:00 UTC." />
                <StatCard label="Visitors today" value={traffic.today?.visitors?.toLocaleString()} accent="green" onClick={() => openDaily("Visitors per day", visitorSeries, "visitors-by-day.csv")} hint="Distinct sessions since 00:00 UTC." />
                <StatCard label="Views (7 days)" value={traffic.last7Days?.views?.toLocaleString()} onClick={() => openDaily("Views per day", viewsSeries, "views-by-day.csv")} />
                <StatCard label="Visitors (7 days)" value={traffic.last7Days?.visitors?.toLocaleString()} onClick={() => openDaily("Visitors per day", visitorSeries, "visitors-by-day.csv")} />
                <StatCard label="Views (30 days)" value={traffic.last30Days?.views?.toLocaleString()} series={viewsSeries.map((row) => row.value)} onClick={() => openDaily("Views per day", viewsSeries, "views-by-day.csv")} />
                <StatCard label="Visitors (30 days)" value={traffic.last30Days?.visitors?.toLocaleString()} accent="green" series={visitorSeries.map((row) => row.value)} onClick={() => openDaily("Visitors per day", visitorSeries, "visitors-by-day.csv")} />
                <StatCard
                  label="Week change"
                  value={traffic.weekChange > 0 ? `+${traffic.weekChange}%` : `${traffic.weekChange}%`}
                  accent={traffic.weekChange >= 0 ? "green" : "red"}
                  delta={typeof traffic.weekChange === "number" ? traffic.weekChange : null}
                  hint="Views in the last 7 days against the 7 days before that."
                />
              </>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <TrendChart
              label="Page views / day"
              series={viewsSeries.map((row) => ({ d: row.label, n: row.value }))}
              onSelectDay={(point) => setDrill({
                title: `Traffic on ${point.d}`,
                subtitle: "Aggregate figures for the selected UTC day.",
                rows: [{ label: "Page views", value: point.n }, { label: "Visitors", value: visitorSeries.find((row) => row.label === point.d)?.value ?? 0 }],
                unit: "Count",
              })}
            />
          </div>

          {traffic.hourly?.length > 0 && (
            <div className="admin-chart-card" style={{ marginBottom: 18 }}>
              <div className="admin-chart-head"><b>Today by hour</b><span className="text-[12px] text-[var(--muted-fg)]">UTC hours</span></div>
              <HourBars
                hours={traffic.hourly}
                onSelect={(hour) => setDrill({
                  title: `Hour ${hour.hour}:00 UTC`,
                  subtitle: "Views recorded in this hour today.",
                  rows: [{ label: `Views at ${hour.hour}:00`, value: hour.views }],
                  unit: "Views",
                })}
              />
            </div>
          )}

          <div className="grid-2" style={{ marginBottom: 18 }}>
            <BreakdownPanel
              title="Top pages (30d)"
              rows={toRows(traffic.topPages, (p) => p.path, (p) => p.views)}
              unit="Views"
              onExpand={setDrill}
              csvName="top-pages.csv"
            />
            <BreakdownPanel
              title="Countries (30d)"
              rows={(traffic.countries || []).map((c: any) => ({ label: `${c.flag ?? ""} ${c.code}`.trim(), value: c.views }))}
              unit="Views"
              onExpand={setDrill}
              csvName="countries.csv"
            />
          </div>
          <div className="grid-2" style={{ marginBottom: 18 }}>
            <BreakdownPanel title="Devices" rows={toRows(traffic.devices, (d) => d.type, (d) => d.views)} unit="Views" onExpand={setDrill} csvName="devices.csv" />
            <BreakdownPanel title="Referrers" rows={toRows(traffic.referrers, (r) => r.source, (r) => r.views)} unit="Views" onExpand={setDrill} csvName="referrers.csv" />
          </div>
        </>
      )}

      {users && (
        <>
          <h2 className="analytics-section-title">Users &amp; growth</h2>
          <div className="rs-stagger admin-stat-grid">
            <StatCard label="Total users" value={users.total?.toLocaleString()} href="/admin/users" hint="All registered accounts. Opens the user list." />
            <StatCard label="Premium" value={users.premium?.toLocaleString()} href="/admin/users?filter=premium" hint="Accounts with an unexpired premium entitlement." />
            <StatCard label="Verified" value={users.verified?.toLocaleString()} href="/admin/users" hint="Accounts that confirmed their email address." />
            <StatCard label="Students" value={users.students?.toLocaleString()} href="/admin/students" hint="Accounts on a confirmed student plan." />
            <StatCard label="Conversion" value={users.conversionRate} accent="green" hint="Premium accounts as a share of all accounts." />
            <StatCard label="Verification" value={users.verificationRate} hint="Verified accounts as a share of all accounts." />
            {isCustom ? (
              <StatCard label="New in range" value={users.newInRange} accent="green" />
            ) : (
              <>
                <StatCard label="New today" value={users.newToday} accent="green" />
                <StatCard label="New this week" value={users.newThisWeek} />
                <StatCard label="New this month" value={users.newThisMonth} />
              </>
            )}
            <StatCard label="Credits earned" value={users.creditsEarned?.toLocaleString()} />
            <StatCard label="Credits spent" value={users.creditsSpent?.toLocaleString()} />
            <StatCard label="Referrals (30d)" value={users.referralsRecent} />
          </div>
          <TrendChart
            label="Signups / day"
            series={(users.signupTrend || []).map((d: any) => ({ d: d.d, n: d.signups }))}
            color="var(--success)"
            onSelectDay={(point) => setDrill({ title: `Signups on ${point.d}`, rows: [{ label: "New accounts", value: point.n }], unit: "Count", link: { href: "/admin/users", label: "Open user list" } })}
          />
        </>
      )}

      {revenue && (
        <>
          <h2 className="analytics-section-title">Revenue &amp; monetization</h2>
          <div className="rs-stagger admin-stat-grid">
            <StatCard label="Settled invoice value (all time)" value={`$${revenue.totalSettledInvoiceValue} USD`} accent="green" href="/admin/payments" hint="Sum of settled invoices. Opens billing." />
            <StatCard label={isCustom ? "Settled invoice value (range)" : "Settled invoice value (30d)"} value={`$${revenue.selectedRangeSettledInvoiceValue} USD`} href="/admin/payments" />
            <StatCard label="MRR / ARR" value={revenue.recurringRevenue?.available ? "Available" : "Unavailable"} accent="amber" hint="Recurring revenue requires a subscription source that is not configured." />
            <StatCard label={isCustom ? "Settled payments (range)" : "Settled payments (30d)"} value={revenue.completedPayments} href="/admin/payments" />
            <StatCard label={isCustom ? "Card / UPI payments (range)" : "Card / UPI payments (30d)"} value={revenue.razorpayCompletedPayments} href="/admin/payments" hint="Completed Razorpay payments. INR is intentionally not summed into USD crypto revenue." />
            <StatCard label="Students (30d)" value={revenue.studentClaims} href="/admin/students" />
          </div>
          <TrendChart
            label="Revenue / day"
            series={(revenue.revenueTrend || []).map((d: any) => ({ d: d.d, n: d.revenue }))}
            color="var(--secondary)"
            onSelectDay={(point) => setDrill({ title: `Revenue on ${point.d}`, rows: [{ label: "Settled value (USD)", value: point.n }], unit: "USD", link: { href: "/admin/payments", label: "Open billing" } })}
          />
          <div className="grid-2" style={{ marginTop: 18, marginBottom: 18 }}>
            <BreakdownPanel title="Settlement currencies" rows={toRows(revenue.paymentCurrencies, (m) => m.currency, (m) => m.count)} unit="Payments" onExpand={setDrill} csvName="currencies.csv" />
            <BreakdownPanel title="Plan breakdown (30d)" rows={toRows(revenue.planBreakdown, (p) => p.plan, (p) => p.count)} unit="Payments" onExpand={setDrill} csvName="plans.csv" />
          </div>
        </>
      )}

      {funnel && (
        <>
          <h2 className="analytics-section-title">Premium checkout funnel</h2>
          <p className="mb-3 text-sm text-[var(--muted-fg)]">Distinct measured sessions at each step. Provider choice and payment outcome are tracked separately.</p>
          <div className="rs-stagger admin-stat-grid">
            {(funnel.steps || []).map((step: any) => (
              <StatCard
                key={step.event}
                label={step.event.replaceAll("_", " ")}
                value={step.sessions?.toLocaleString() ?? 0}
                accent={step.event === "checkout_verified" ? "green" : step.event === "checkout_failed" ? "red" : step.event === "checkout_cancelled" ? "amber" : undefined}
                hint={`${step.events ?? 0} recorded event${step.events === 1 ? "" : "s"}.`}
              />
            ))}
          </div>
        </>
      )}

      {content && (
        <>
          <h2 className="analytics-section-title">Content &amp; SEO</h2>
          <div className="rs-stagger admin-stat-grid">
            <StatCard label="Blog posts" value={content.blogPostsTotal} href="/admin/blog" />
            <StatCard label="Blog posts (30d)" value={content.blogPostsThisMonth} accent="green" href="/admin/blog" />
            <StatCard label="Companies indexed" value={content.companiesIndexed?.toLocaleString()} />
            <StatCard label="Roles indexed" value={content.rolesIndexed?.toLocaleString()} />
            <StatCard label="Jobs listed (30d)" value={content.jobsListed?.toLocaleString()} href="/admin/jobs" />
          </div>
        </>
      )}

      {generation && (
        <>
          <h2 className="analytics-section-title">AI resume generation</h2>
          <div className="rs-stagger admin-stat-grid">
            <StatCard label="Total resumes" value={generation.totalResumes?.toLocaleString()} href="/admin/resumes" hint="Every resume ever generated. Opens the resume list." />
            {isCustom ? (
              // Both fields run the same range SQL — one card, honestly labeled.
              <StatCard label="Generated (range)" value={generation.generatedThisMonth?.toLocaleString()} accent="green" href="/admin/resumes" />
            ) : (
              <>
                <StatCard label="Generated today" value={generation.generatedToday} accent="green" href="/admin/resumes" />
                <StatCard label="Generated (30d)" value={generation.generatedThisMonth?.toLocaleString()} href="/admin/resumes" />
              </>
            )}
            <StatCard label="Avg ATS" value={generation.avgAtsScore} hint="Mean ATS score across generated resumes." />
            <StatCard label="P95 ATS" value={generation.p95AtsScore} hint="95th percentile ATS score." />
            <StatCard label="Avg speed" value={generation.avgSpeed} hint="Mean end-to-end generation time." />
            <StatCard label="P95 speed" value={generation.p95Speed} hint="95th percentile generation time." />
            <StatCard label="Free avg speed" value={generation.freeAvgSpeed} />
            <StatCard label="Premium avg speed" value={generation.premiumAvgSpeed} />
            <StatCard label={isCustom ? "Errors (range)" : "Errors (24h)"} value={generation.errors24h} accent={generation.errors24h > 0 ? "red" : undefined} href="/admin/system" hint={isCustom ? "Failed generations inside the selected range. Opens system logs." : "Failed generations in the last 24 hours. Opens system logs."} />
          </div>
          <TrendChart
            label="Resumes generated / day"
            series={(generation.generationTrend || []).map((d: any) => ({ d: d.d, n: d.count }))}
            onSelectDay={(point) => setDrill({ title: `Resumes on ${point.d}`, rows: [{ label: "Generated", value: point.n }], unit: "Count", link: { href: "/admin/resumes", label: "Open resume list" } })}
          />
          <div className="grid-2" style={{ marginTop: 18, marginBottom: 18 }}>
            <BreakdownPanel title="Top roles (30d)" rows={toRows(generation.topRoles, (r) => r.title, (r) => r.count)} unit="Resumes" onExpand={setDrill} csvName="top-roles.csv" />
            <BreakdownPanel title="Top companies (30d)" rows={toRows(generation.topCompanies, (c) => c.name, (c) => c.count)} unit="Resumes" onExpand={setDrill} csvName="top-companies.csv" />
          </div>
        </>
      )}

      {jobs && (
        <>
          <h2 className="analytics-section-title">Jobs &amp; applications</h2>
          <div className="rs-stagger admin-stat-grid">
            <StatCard label="Total jobs" value={jobs.totalJobs?.toLocaleString()} href="/admin/jobs" hint="Unexpired job listings. Opens the job list." />
            <StatCard label={isCustom ? "Jobs added in range" : "Fresh jobs (24h)"} value={(isCustom ? jobs.jobsInRange : jobs.freshJobs24h)?.toLocaleString()} accent="green" href="/admin/jobs" />
            <StatCard label={isCustom ? "Applications in range" : "Applications"} value={(isCustom ? jobs.applicationsInRange : jobs.totalApplications)?.toLocaleString()} href="/admin/campaigns" />
          </div>
          <div className="grid-2" style={{ marginBottom: 18 }}>
            <BreakdownPanel
              title="Jobs by country"
              rows={(jobs.countryBreakdown || []).map((c: any) => ({ label: `${c.flag ?? ""} ${c.code}`.trim(), value: c.count }))}
              unit="Jobs"
              limit={15}
              onExpand={setDrill}
              csvName="jobs-by-country.csv"
            />
            <BreakdownPanel title="Application statuses" rows={toRows(jobs.applicationStatuses, (a) => a.status, (a) => a.count)} unit="Applications" onExpand={setDrill} csvName="application-statuses.csv" />
          </div>
        </>
      )}

      <MetricDrawer
        open={Boolean(drill)}
        title={drill?.title ?? ""}
        subtitle={drill?.subtitle}
        onClose={() => setDrill(null)}
        footer={
          drill && (
            <>
              {drill.csvName && (
                <Button variant="outline" size="compact" type="button" onClick={() => exportCsv(drill.csvName!, drill.rows, [["Label", (row) => row.label], ["Value", (row) => row.value]])}>
                  <Download size={14} /> Download CSV
                </Button>
              )}
              {drill.link && <Button as="a" size="compact" href={drill.link.href}>{drill.link.label}</Button>}
            </>
          )
        }
      >
        {drill && <BreakdownList rows={drill.rows} unit={drill.unit} />}
      </MetricDrawer>
    </div>
  );
}

/** Ranked rows with a share-of-total bar, so magnitude is readable at a glance. */
function BreakdownList({ rows, unit = "Value" }: { rows: BreakdownRow[]; unit?: string }) {
  if (!rows.length) return <p className="text-[var(--muted-fg)]">No rows for this metric yet.</p>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <>
      <div className="admin-breakdown-head"><span>Item</span><span>{unit}</span></div>
      <ol className="admin-breakdown">
        {rows.map((row, index) => (
          <li key={`${row.label}-${index}`}>
            <span className="admin-breakdown-bar" style={{ width: `${(row.value / max) * 100}%` }} aria-hidden="true" />
            <span className="admin-breakdown-label">{row.label}</span>
            <span className="admin-breakdown-value">
              {row.value.toLocaleString()}
              {total > 0 && <small>{((row.value / total) * 100).toFixed(1)}%</small>}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[var(--muted-fg)]" style={{ marginTop: 14 }}>{rows.length} rows · total {total.toLocaleString()}</p>
    </>
  );
}

/** A list panel whose rows open the full breakdown in the drawer. */
function BreakdownPanel({
  title,
  rows,
  unit,
  limit = 8,
  onExpand,
  csvName,
}: {
  title: string;
  rows: BreakdownRow[];
  unit: string;
  limit?: number;
  onExpand: (drill: Drill) => void;
  csvName: string;
}) {
  const expand = () => onExpand({ title, subtitle: `Full breakdown, ranked by ${unit.toLowerCase()}.`, rows, unit, csvName });
  return (
    <div className="admin-chart-card">
      <div className="admin-chart-head">
        <b>{title}</b>
        {rows.length > 0 && (
          <button type="button" className="admin-linkish" onClick={expand}>
            {rows.length > limit ? `All ${rows.length}` : "Expand"}
          </button>
        )}
      </div>
      {rows.length === 0 && <p className="text-[var(--muted-fg)]" style={{ margin: 0 }}>No data yet.</p>}
      {rows.slice(0, limit).map((row) => (
        <DataRow key={row.label} left={<span style={{ fontWeight: 500, wordBreak: "break-word" }}>{row.label}</span>} right={<b>{row.value.toLocaleString()}</b>} onClick={expand} />
      ))}
    </div>
  );
}

function HourBars({ hours, onSelect }: { hours: any[]; onSelect: (hour: any) => void }) {
  const max = Math.max(1, ...hours.map((hour) => hour.views));
  return (
    <div className="admin-hour-bars">
      {hours.map((hour) => (
        <button
          key={hour.hour}
          type="button"
          className="admin-hour-bar"
          onClick={() => onSelect(hour)}
          title={`${hour.views} views at ${hour.hour}:00 UTC`}
          aria-label={`${hour.views} views at ${hour.hour}:00 UTC`}
        >
          <span className="admin-hour-count">{hour.views}</span>
          <span className="admin-hour-fill" style={{ height: `${Math.max(4, (hour.views / max) * 100)}%` }} />
          <span className="admin-hour-label">{hour.hour}</span>
        </button>
      ))}
    </div>
  );
}
