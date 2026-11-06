"use client";

import { useState } from "react";
import { fetchJson, useAdminQuery } from "../query-client";
import { useAdminRefreshSignal } from "../admin-shared";
import { Button, Notice } from "@/components/ui/primitives";

export default function LogViewer() {
  const [service, setService] = useState("resume-web");
  const { data, isFetching: loading, isError, refetch } = useAdminQuery<{ lines: string[]; unavailable?: boolean }>(
    ["admin", "logs", service],
    (signal) => fetchJson(`/api/admin/logs?service=${encodeURIComponent(service)}&lines=100`, { signal }),
  );
  useAdminRefreshSignal(() => { void refetch(); });
  const logs = data?.lines ?? [];
  const available = !isError && !data?.unavailable;
  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <label className="sr-only" htmlFor="admin-log-service">Log service</label>
        <select id="admin-log-service" className="admin-table-search" value={service} onChange={(event) => setService(event.target.value)}>
          <option value="resume-web">Web</option>
          <option value="resume-worker">Resume worker</option>
          <option value="rolesharp-jobs">Jobs ingestion</option>
          <option value="rolesharp-recommendation-agent">Recommendation agent</option>
          <option value="rolesharp-auto-apply-agent">Auto Apply agent</option>
          <option value="rolesharp-blog-worker">Blog worker</option>
        </select>
        <Button variant="outline" size="compact" type="button" onClick={() => void refetch()} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>
        <span className="text-[13px] text-[var(--muted-fg)]">Last 100 redacted lines</span>
      </div>
      {!available && <Notice variant="danger" role="status">Logs are unavailable for this service on the current host.</Notice>}
      <pre style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, fontSize: 12, lineHeight: 1.6, maxHeight: 400, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--fg)", fontFamily: "var(--font-mono),monospace" }}>
        {logs.length === 0 ? "No logs available." : logs.join("\n")}
      </pre>
    </div>
  );
}
