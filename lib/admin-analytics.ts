export const ADMIN_ANALYTICS_TIMEZONE = "UTC" as const;
export const ADMIN_ANALYTICS_DEFAULT_DAYS = 30;

export type AnalyticsMetricDefinition = {
  key: string;
  label: string;
  definition: string;
  source: string;
  unit: "count" | "milliseconds" | "score" | "percent" | "USD";
  availability: "available" | "unavailable";
  unavailableReason?: string;
};

export const ADMIN_ANALYTICS_METRICS: readonly AnalyticsMetricDefinition[] = [
  { key: "traffic.views", label: "Page views", definition: "Accepted page-view rows whose created_at falls within the selected UTC interval.", source: "page_views", unit: "count", availability: "available" },
  { key: "traffic.visitors", label: "Visitors", definition: "Distinct privacy-safe session identifiers among accepted page views in the selected UTC interval.", source: "page_views.session_id", unit: "count", availability: "available" },
  { key: "users.signups", label: "New users", definition: "User accounts created within the selected UTC interval.", source: "users.created_at", unit: "count", availability: "available" },
  { key: "users.premium", label: "Currently premium users", definition: "Accounts whose premium_until is later than the query time. This is a current-state count, not a historical cohort measure.", source: "users.premium_until", unit: "count", availability: "available" },
  { key: "revenue.settled_usd", label: "Settled USD invoice value", definition: "Sum of price_amount for finished or confirmed invoices. Invoice price currency is fixed to USD by the checkout contract.", source: "crypto_payments.price_amount", unit: "USD", availability: "available" },
  { key: "revenue.mrr", label: "Monthly recurring revenue", definition: "Unavailable: invoices grant fixed-duration access and the database does not identify recurring subscriptions or renewal cohorts.", source: "not_collected", unit: "USD", availability: "unavailable", unavailableReason: "No recurring subscription ledger exists." },
  { key: "revenue.arr", label: "Annual recurring revenue", definition: "Unavailable because truthful MRR cannot be derived from the current fixed-duration invoice model.", source: "not_collected", unit: "USD", availability: "unavailable", unavailableReason: "No recurring subscription ledger exists." },
  { key: "generation.created", label: "Resumes generated", definition: "Resume rows created within the selected UTC interval.", source: "resumes.created_at", unit: "count", availability: "available" },
  { key: "generation.latency", label: "Generation latency", definition: "Average and p95 of non-null generation duration values for resume rows in the selected UTC interval.", source: "resumes.gen_ms", unit: "milliseconds", availability: "available" },
  { key: "generation.ats", label: "ATS score", definition: "Average and p95 of non-null stored ATS scores for resume rows in the selected UTC interval.", source: "resumes.ats_score", unit: "score", availability: "available" },
  { key: "queue.current", label: "Current generation queue", definition: "Point-in-time BullMQ counts. Reported unavailable when Redis cannot be queried; never replaced with zero.", source: "resumeQueue", unit: "count", availability: "available" },
] as const;

export function utcDateFilter(column: string, fromParam = 1, toParam = 2) {
  if (!/^[a-z_][a-z0-9_.]*$/iu.test(column)) throw new Error("invalid_analytics_column");
  return `${column} >= ($${fromParam}::date::timestamp at time zone 'UTC') and ${column} < (($${toParam}::date + 1)::timestamp at time zone 'UTC')`;
}

export function analyticsRangeMetadata(range: { from: string; to: string; days: number } | null, generatedAt: string) {
  return {
    timezone: ADMIN_ANALYTICS_TIMEZONE,
    generatedAt,
    range: range
      ? { kind: "custom" as const, ...range, fromInclusive: `${range.from}T00:00:00.000Z`, toExclusive: new Date(Date.parse(`${range.to}T00:00:00.000Z`) + 86_400_000).toISOString() }
      : { kind: "rolling" as const, days: ADMIN_ANALYTICS_DEFAULT_DAYS, definition: "Trailing 30 days ending at generatedAt." },
    definitions: ADMIN_ANALYTICS_METRICS,
  };
}
