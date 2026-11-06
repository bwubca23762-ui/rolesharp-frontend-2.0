"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Notice, type BadgeVariant } from "@/components/ui/primitives";
import { PageHeader, StatCard, Toolbar } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import Skeleton from "@/components/ui/Skeleton";
import { adminFetchJson } from "../admin-helpers";

type AutoMailData = {
  campaigns: {
    total: number;
    active: number;
    dailyMatches: number;
    roleApply: number;
    paused: number;
  };
  matches: {
    total: number;
    today: number;
    eligible: number;
    consumed: number;
    excluded: number;
  };
  packages: {
    total: number;
    reviewRequired: number;
    ready: number;
    blocked: number;
    stale: number;
  };
  recentMatches: Array<{
    id: string;
    fit_score: number;
    confidence_score: number;
    status: string;
    created_at: string;
    ranked_at: string;
    email: string;
    campaign_mode: string;
    campaign_status: string;
  }>;
  recentPackages: Array<{
    id: string;
    status: string;
    subject: string;
    created_at: string;
    updated_at: string;
    email: string;
    connection_provider: string;
    verified_sender: string;
  }>;
};

export default function AutoMailView() {
  const [data, setData] = useState<AutoMailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"matches" | "packages">("matches");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminFetchJson<AutoMailData>("/api/admin/auto-mail", { cache: "no-store" });
      if (!result.ok || !result.data) throw new Error(result.error);
      setData(result.data);
      setError("");
    } catch {
      setError("Could not load auto-mail data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useAdminRefreshSignal(load);  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const matchStatusBadge = (s: string): BadgeVariant => {
    const map: Record<string, BadgeVariant> = {
      eligible: "success",
      consumed: "warning",
      excluded: "default",
      stale: "default",
    };
    return map[s] || "default";
  };

  const packageStatusBadge = (s: string): BadgeVariant => {
    const map: Record<string, BadgeVariant> = {
      ready: "success",
      review_required: "warning",
      blocked: "default",
      stale: "default",
      preparing: "warning",
    };
    return map[s] || "default";
  };

  return (
    <>
      <PageHeader

        title="Auto Mail"
        desc="Daily match digests and application-email delivery pipeline status."
        onRefresh={load}
      />

      {loading && !data && (
        <div className="admin-chart-card" aria-busy="true" style={{ margin: 40, maxWidth: 640 }}>
          <Skeleton variant="heading" width="10rem" />
          <div className="grid gap-2" style={{ marginTop: 12 }}>
            {[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} variant="table-row" />)}
          </div>
        </div>
      )}
      {error && !data && (
        <div className="admin-chart-card" style={{ margin: 40, maxWidth: 420 }}>
          <h3 style={{ marginTop: 0 }}>Auto Mail unavailable</h3>
          <p className="text-[var(--muted-fg)]">{error}</p>
          <Button onClick={() => load()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <>
          {error && <Notice variant="danger" role="alert">{error} Displaying the last loaded data. <Button variant="outline" size="compact" onClick={() => void load()}>Retry</Button></Notice>}
          <div className="admin-stat-grid" style={{ marginBottom: 18 }}>
            <StatCard label="Total Campaigns" value={data.campaigns.total} />
            <StatCard label="Active" value={data.campaigns.active} accent="green" />
            <StatCard label="Daily Matches Mode" value={data.campaigns.dailyMatches} />
            <StatCard label="Role Apply Mode" value={data.campaigns.roleApply} />
            <StatCard label="Paused" value={data.campaigns.paused} accent="amber" />
          </div>

          <div className="admin-stat-grid" style={{ marginBottom: 18 }}>
            <StatCard label="Total Matches" value={data.matches.total} />
            <StatCard label="Matches Today" value={data.matches.today} accent="green" />
            <StatCard label="Eligible" value={data.matches.eligible} />
            <StatCard label="Consumed" value={data.matches.consumed} />
            <StatCard label="Excluded" value={data.matches.excluded} accent="amber" />
          </div>

          <div className="admin-stat-grid" style={{ marginBottom: 18 }}>
            <StatCard label="Total Packages" value={data.packages.total} />
            <StatCard label="Review Required" value={data.packages.reviewRequired} accent="amber" />
            <StatCard label="Ready" value={data.packages.ready} accent="green" />
            <StatCard label="Blocked" value={data.packages.blocked} accent="red" />
            <StatCard label="Stale" value={data.packages.stale} accent="red" />
          </div>

          <div className="admin-table-card">
            <Toolbar placeholder="Auto-mail tables are read-only...">
              <div className="row" style={{ gap: 4 }}>
                <Button
                  variant={tab === "matches" ? "primary" : "outline"}
                  size="compact"
                  onClick={() => setTab("matches")}
                >
                  Recent Matches ({data.recentMatches.length})
                </Button>
                <Button
                  variant={tab === "packages" ? "primary" : "outline"}
                  size="compact"
                  onClick={() => setTab("packages")}
                >
                  Recent Packages ({data.recentPackages.length})
                </Button>
              </div>
            </Toolbar>

            {tab === "matches" && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Campaign Mode</th>
                      <th className="num-col">Fit</th>
                      <th className="num-col">Confidence</th>
                      <th>Status</th>
                      <th>Ranked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentMatches.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-[var(--muted-fg)]">
                          No matches yet.
                        </td>
                      </tr>
                    )}
                    {data.recentMatches.map((m) => (
                      <tr key={m.id}>
                        <td className="cell-main">{m.email || "—"}</td>
                        <td>
                          <Badge variant="warning">
                            {m.campaign_mode === "daily_matches" ? "Daily Matches" : "Role Apply"}
                          </Badge>
                        </td>
                        <td className="num-col tabular">{m.fit_score}</td>
                        <td className="num-col tabular">{m.confidence_score}</td>
                        <td>
                          <Badge variant={matchStatusBadge(m.status)}>{m.status}</Badge>
                        </td>
                        <td>{m.ranked_at ? new Date(m.ranked_at).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "packages" && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Subject</th>
                      <th>Provider</th>
                      <th>Sender</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentPackages.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-[var(--muted-fg)]">
                          No packages yet.
                        </td>
                      </tr>
                    )}
                    {data.recentPackages.map((p) => (
                      <tr key={p.id}>
                        <td className="cell-main">{p.email || "—"}</td>
                        <td className="tabular" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.subject || "—"}
                        </td>
                        <td>
                          <Badge variant="warning">
                            {p.connection_provider === "google" ? "Google" : p.connection_provider === "microsoft" ? "Microsoft" : "—"}
                          </Badge>
                        </td>
                        <td className="tabular">{p.verified_sender || "—"}</td>
                        <td>
                          <Badge variant={packageStatusBadge(p.status)}>{p.status}</Badge>
                        </td>
                        <td>{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
