"use client";

import { fetchJson, useAdminQuery } from "../query-client";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { useAdminRefreshSignal } from "../admin-shared";

export default function RateLimitPanel() {
  const { data, isPending, isError, refetch } = useAdminQuery<any>(["admin", "rate-limits"],
    (signal) => fetchJson("/api/admin/rate-limits", { signal }));
  useAdminRefreshSignal(() => { void refetch(); });
  if (isError) return <Notice variant="danger" role="alert">Could not load rate limits. <Button variant="outline" onClick={() => void refetch()}>Retry rate limits</Button></Notice>;
  if (isPending || !data) return <p className="text-[var(--muted-fg)]" role="status">Loading rate limits…</p>;
  return (
    <div>
      <span className="text-[13px] text-[var(--muted-fg)]">{data.scanned ?? 0} active rate limit keys</span>
      <div style={{ maxHeight: 300, overflow: "auto", marginTop: 8 }}>
        <table className="admin-table">
          <thead><tr><th>Endpoint</th><th className="num-col">Hits</th><th className="num-col">TTL (s)</th></tr></thead>
          <tbody>
            {(data.limits || []).slice(0, 30).map((l: any) => (
              <tr key={l.key}>
                <td className="cell-main"><code style={{ fontSize: 12 }}>{l.key}</code></td>
                <td className="num-col"><Badge variant={l.hits > 50 ? "warning" : "success"}>{l.hits}</Badge></td>
                <td className="num-col">{l.ttl_sec}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
