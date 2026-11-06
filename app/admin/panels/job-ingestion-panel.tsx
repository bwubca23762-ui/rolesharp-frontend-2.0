"use client";

import { fetchJson, useAdminQuery } from "../query-client";
import { StatCard, useAdminRefreshSignal } from "../admin-shared";
import { Badge, Button, Notice } from "@/components/ui/primitives";

export default function JobIngestionPanel() {
  const { data, isPending, isError, refetch } = useAdminQuery<any>(["admin", "job-ingestion"],
    (signal) => fetchJson("/api/admin/jobs-status", { signal }));
  useAdminRefreshSignal(() => { void refetch(); });
  if (isError) return <Notice variant="danger" role="alert">Could not load ingestion. <Button variant="outline" onClick={() => void refetch()}>Retry ingestion</Button></Notice>;
  if (isPending || !data) return <p className="text-[var(--muted-fg)]" role="status">Loading ingestion…</p>;
  return (
    <div>
      <div className="admin-stat-grid" style={{ marginTop: 12, marginBottom: 12 }}>
        <StatCard label="Total profiles" value={data.totalProfiles} />
        <StatCard label="Errors (24h)" value={data.errors24h} accent={data.errors24h > 0 ? "red" : "green"} />
      </div>
      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Recent runs (last 50)</h4>
      <div style={{ maxHeight: 300, overflow: "auto" }}>
        <table className="admin-table">
          <thead><tr><th>Profile</th><th>Status</th><th>Fetched</th><th>Stored</th><th>Started</th><th>Error</th></tr></thead>
          <tbody>
            {(data.recentRuns || []).map((r: any) => (
              <tr key={r.id}>
                <td className="cell-main">{r.country_code}/{r.search_term}</td>
                <td><Badge variant={r.status === "success" ? "success" : r.status === "running" ? "premium" : "warning"}>{r.status}</Badge></td>
                <td className="num-col">{r.fetched_count ?? "-"}</td>
                <td className="num-col">{r.stored_count ?? "-"}</td>
                <td>{r.started_fmt}</td>
                <td><span className="text-[var(--muted-fg)]" style={{ fontSize: 11, maxWidth: 200, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.error || ""}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
