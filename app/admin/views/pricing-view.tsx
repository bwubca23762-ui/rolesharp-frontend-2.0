"use client";

import { Button, Notice } from "@/components/ui/primitives";
import { fetchJson, useAdminQuery } from "../query-client";
import { PageHeader, StatCard, useAdminRefreshSignal } from "../admin-shared";

export default function PricingView() {
  const { data, isPending, isError, refetch } = useAdminQuery<any>(["admin", "pricing"], async (signal) => {
    const result = await fetchJson<any>("/api/admin/pricing", { signal });
    if (!result?.envPricing) throw new Error("Pricing data is unavailable.");
    return result;
  });
  useAdminRefreshSignal(() => { void refetch(); });
  if (isError) return <Notice variant="danger" role="alert">Could not load pricing. <Button variant="outline" onClick={() => void refetch()}>Retry pricing</Button></Notice>;
  if (isPending || !data) return <div style={{ padding: 24 }}><p className="text-[var(--muted-fg)]" role="status">Loading pricing…</p></div>;

  const p = data.envPricing;
  const limits = data.limits;
  const limitOverridden = (envValue: number, key: "freeMonthly" | "premiumMonthly") =>
    limits && typeof limits[key] === "number" && limits[key] !== envValue;
  return (
    <>
      <PageHeader title="Pricing Plans" desc="Live plan pricing and allowances. Allowance overrides saved in Settings are reflected here." onRefresh={() => void refetch()} />
      <div className="admin-chart-card">
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Plans &amp; allowances</h2>
        <div className="admin-stat-grid">
          <StatCard
            label="Free monthly limit"
            value={limits?.freeMonthly ?? p.freeLimit}
            hint={limitOverridden(p.freeLimit, "freeMonthly") ? `Overridden in Settings (env: ${p.freeLimit})` : undefined}
            accent={limitOverridden(p.freeLimit, "freeMonthly") ? "amber" : undefined}
          />
          <StatCard
            label="Premium monthly limit"
            value={limits?.premiumMonthly ?? p.premiumLimit}
            hint={limitOverridden(p.premiumLimit, "premiumMonthly") ? `Overridden in Settings (env: ${p.premiumLimit})` : undefined}
            accent={limitOverridden(p.premiumLimit, "premiumMonthly") ? "amber" : undefined}
          />
          <StatCard label="Student monthly limit" value={limits?.studentMonthly ?? "—"} hint="Set in Settings · usage limits" />
          <StatCard label="Monthly price" value={`$${(p.monthlyCents / 100).toFixed(2)}`} />
          <StatCard label="Yearly price" value={`$${(p.yearlyCents / 100).toFixed(2)}`} accent="green" />
          <StatCard label="Monthly days" value={p.daysMonthly} />
          <StatCard label="Yearly days" value={p.daysYearly} />
        </div>
        <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginTop: 12 }}>
          Allowances are editable in <a href="/admin/settings" className="underline">Settings → Usage limits</a>. Prices are
          configured via environment variables (<code>PRICE_MONTHLY_CENTS</code>, <code>PRICE_YEARLY_CENTS</code>, etc.) and
          stay env-managed so invoice amounts always match what checkout advertised.
        </p>
      </div>
    </>
  );
}
