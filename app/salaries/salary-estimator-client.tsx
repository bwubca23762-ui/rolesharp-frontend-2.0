"use client";

import { useEffect, useState } from "react";
import { Button, Card, Notice } from "@/components/ui/primitives";

type SalaryStats = {
  role: string;
  country: string;
  sampleSize: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
  avgLow: number | null;
  avgHigh: number | null;
  currency: string;
};

const QUICK_ROLES = ["data analyst", "software engineer", "product manager", "graphic designer", "accountant", "nurse"];

function fmt(n: number | null, currency: string): string {
  if (n == null) return "—";
  return `${currency} ${n.toLocaleString()}`;
}

export default function SalaryEstimatorClient({
  countries,
  dataUnavailable = false,
}: {
  countries: Array<{ code: string; n: number }>;
  dataUnavailable?: boolean;
}) {
  const [role, setRole] = useState("data analyst");
  const [country, setCountry] = useState(() =>
    countries.some((c) => c.code === "US") ? "US" : (countries[0]?.code ?? "US"),
  );
  const [stats, setStats] = useState<SalaryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function lookup(r = role, c = country) {
    if (loading) return;
    if (!r.trim() || !c) return;
    setLoading(true);
    setErr("");
    setStats(null);
    try {
      const res = await fetch(`/api/salaries?role=${encodeURIComponent(r.trim())}&country=${encodeURIComponent(c)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || j.error || "No salary data for this combination.");
      setStats(j as SalaryStats);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (countries.length > 0 && !stats && !loading && !err) void lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card padding="lg">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-[var(--fg)]">Role</span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && void lookup()}
            placeholder="e.g. data analyst"
            maxLength={60}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-[var(--fg)]">Country</span>
          <select
            value={country}
            disabled={dataUnavailable || countries.length === 0}
            onChange={(e) => {
              const next = e.target.value;
              setCountry(next);
              if (role.trim()) void lookup(role, next);
            }}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.n.toLocaleString()})
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <Button onClick={() => void lookup()} isLoading={loading} disabled={dataUnavailable || countries.length === 0} className="w-full sm:w-auto">
            💰 Estimate
          </Button>
        </div>
      </div>

      {(dataUnavailable || countries.length === 0) && (
        <Notice variant="warning" role="status" className="mt-4">
          {dataUnavailable
            ? "Salary data is temporarily unavailable. Please refresh in a little while."
            : "There is not enough current salary data to estimate a range yet."}
        </Notice>
      )}

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {QUICK_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            disabled={loading || dataUnavailable || countries.length === 0}
            onClick={() => {
              setRole(r);
              void lookup(r, country);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              role === r
                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-fg)] hover:border-[var(--primary)] hover:text-[var(--fg)]"
            }`}
          >
            ⚡ {r}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 text-sm font-semibold text-[var(--color-danger)]" role="alert">{err}</p>}

      {stats && (
        <div className="mt-6 border-t border-[var(--hairline)] pt-5" role="status">
          <p className="text-xs font-medium text-[var(--muted-fg)]">
            Based on <b>{stats.sampleSize.toLocaleString()}</b> live postings with published annual salaries ({stats.country})
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              ["25th percentile", stats.p25],
              ["Median", stats.median],
              ["75th percentile", stats.p75],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted-fg)]">{label}</div>
                <div className="mt-1 text-xl font-extrabold! tabular-nums tracking-tight text-[var(--fg)] md:text-2xl">
                  {fmt(value as number | null, stats.currency)}
                </div>
              </div>
            ))}
          </div>

          {stats.p25 != null && stats.p75 != null && stats.median != null && (
            <div className="mt-6 px-2 pb-4" aria-hidden="true">
              <div className="relative h-2 rounded-full bg-[var(--surface-2)]">
                <div
                  className="absolute h-2 rounded-full bg-[var(--primary)]/35"
                  style={{ left: "12%", right: "12%" }}
                />
                <div
                  className="absolute -top-1 h-4 w-4 rounded-full border-2 border-white bg-[var(--primary)] shadow-md"
                  style={{ left: "calc(12% + ((76% - 24%) * 0.5))", transform: "translateX(-50%)" }}
                  title={`Median ${fmt(stats.median, stats.currency)}`}
                />
                <span className="absolute -bottom-5 left-0 text-xs text-[var(--muted-fg)]">{fmt(stats.p25, stats.currency)}</span>
                <span className="absolute -bottom-5 right-0 text-xs text-[var(--muted-fg)]">{fmt(stats.p75, stats.currency)}</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-4">
            <Button as="a" href={`/build#role=${encodeURIComponent(role)}&country=${encodeURIComponent(country)}`} size="sm">
              🎯 Tailor Resume for {role} →
            </Button>
            <Button as="a" href={`/jobs/${country.toLowerCase()}`} variant="outline" size="sm">
              🔍 Live {country} Jobs
            </Button>
            <Button as="a" href="/salary-negotiation-script" variant="ghost" size="sm">
              💬 Negotiation Script
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
