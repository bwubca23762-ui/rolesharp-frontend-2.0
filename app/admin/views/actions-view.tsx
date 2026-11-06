"use client";

import { useEffect, useState } from "react";
import { csvCell } from "@/lib/csv";
import { PageHeader } from "../admin-shared";
import { Badge, Button } from "@/components/ui/primitives";
import { fetchJson, useAdminQuery } from "../query-client";
import { DataTable, type DataTableColumn } from "@/components/ui/admin/data-table";
import { Card, CardContent } from "@/components/ui/admin/card";

type AuditRow = { id: string; action: string; target_email?: string; details?: unknown; created_at: string; actor_email?: string | null; authentication_method?: string | null };
type AuditListResponse = { rows: AuditRow[]; total: number };

function formatAuditDetails(details: unknown): string {
  if (details == null) return "";
  if (typeof details === "string") return details;
  return JSON.stringify(details) ?? "";
}

export default function ActionsView() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const pageSize = 30;

  const { data, isPending, isError, error, refetch, isSuccess } = useAdminQuery<AuditListResponse>(
    ["admin", "audit", query, actionFilter, from, to, page],
    (signal) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (query.trim()) params.set("email", query.trim());
      if (actionFilter) params.set("action", actionFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return fetchJson<AuditListResponse>(`/api/admin/audit?${params.toString()}`, { signal });
    },
  );

  const rows = data?.rows ?? undefined;
  const total = data?.total ?? 0;
  const tableStatus = isError ? "error" : isPending ? "loading" : "success";

  const columns: DataTableColumn<AuditRow>[] = [
    { id: "action", header: "Action", cell: (a) => <Badge variant="warning">{a.action}</Badge> },
    { id: "target_email", header: "Target email", className: "cell-main", cell: (a) => a.target_email || <span className="text-[var(--muted-fg)]">—</span> },
    {
      id: "details",
      header: "Details",
      className: "tabular",
      cell: (a) => {
        const t = formatAuditDetails(a.details);
        const expanded = expandedDetails === a.id;
        return (
          <span className="block max-w-[320px]">
            <button
              type="button"
              disabled={!t}
              onClick={() => setExpandedDetails((cur) => (cur === a.id ? null : a.id))}
              aria-expanded={expanded}
              className={t ? "block max-w-[320px] truncate text-left hover:text-[var(--primary)]" : "block max-w-[320px] truncate"}
              title={expanded ? "Click to collapse" : t || undefined}
            >
              {t ? (expanded ? "▾ Hide JSON" : t.slice(0, 120)) : "—"}
            </button>
          </span>
        );
      },
    },
    {
      id: "actor",
      header: "Actor",
      cell: (a) => a.actor_email
        ? <span className="block max-w-[220px] truncate" title={`${a.actor_email} · ${a.authentication_method ?? "unknown auth"}`}>{a.actor_email}</span>
        : <span className="text-[var(--muted-fg)]">system</span>,
    },
    { id: "created_at", header: "Timestamp", className: "tabular", cell: (a) => new Date(a.created_at).toLocaleString() },
  ];

  // Also fetch distinct actions for the filter dropdown on mount
  useEffect(() => {
    fetch("/api/admin/audit?pageSize=0&distinct=1")
      .then((r) => r.json())
      .then((j) => { if (j.distinctActions) setAvailableActions(j.distinctActions); })
      .catch(() => {});
  }, []);

  function clearFilters() {
    setQuery("");
    setActionFilter("");
    setFrom("");
    setTo("");
  }

  async function exportCsvFile() {
    // Export the FULL filtered result (paged at 100/request), not just the
    // 30 rows currently on screen.
    const params = new URLSearchParams({ pageSize: "100" });
    if (query) params.set("email", query);
    if (actionFilter) params.set("action", actionFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const collected: AuditRow[] = [];
    for (let page = 1; page <= 50; page++) {
      params.set("page", String(page));
      const r = await fetch(`/api/admin/audit?${params.toString()}`, { credentials: "same-origin" });
      if (!r.ok) return;
      const j = await r.json().catch(() => ({})) as { rows?: AuditRow[] };
      const batch = j.rows ?? [];
      collected.push(...batch);
      if (batch.length < 100) break;
    }
    if (!collected.length) return;
    const header = ["action", "target_email", "actor_email", "authentication_method", "details", "created_at"];
    // details is a parsed jsonb object — stringifying it here (like the table
    // cell does) prevents "[object Object]" in every CSV row.
    const csv = [header.map(csvCell).join(","), ...collected.map((r) => [r.action, r.target_email ?? "", r.actor_email ?? "", r.authentication_method ?? "", formatAuditDetails(r.details), r.created_at].map(csvCell).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "admin-audit.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHeader title="Admin actions" desc="Every manual change — premium grants, deletions, credits, queue maintenance." />
      <Card>
        <CardContent className="p-0">
          <div className="admin-table-toolbar">
            <input className="admin-table-search" placeholder="Search by email..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
            <select className="admin-table-filter" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} aria-label="Filter by action">
              <option value="">All actions</option>
              {availableActions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <input type="date" className="admin-table-filter" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} title="From date" aria-label="From date" />
            <input type="date" className="admin-table-filter" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} title="To date" aria-label="To date" />
            <Button variant="outline" size="compact" onClick={() => void exportCsvFile()} disabled={!rows || rows.length === 0}>Export CSV</Button>
            <Button variant="outline" size="compact" onClick={clearFilters}>Clear filters</Button>
          </div>
          <DataTable
            columns={columns}
            data={rows}
            status={tableStatus}
            error={error?.message}
            onRetry={() => refetch()}
            rowKey={(row) => row.id}
            skeletonRows={Math.min(pageSize, 8)}
            empty={{ title: "No audit entries match", description: "Adjust your filters or check back later." }}
            pagination={isSuccess ? { page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total, onPage: setPage } : undefined}
          />
          {expandedDetails && (() => {
            const row = (rows ?? []).find((r) => r.id === expandedDetails);
            if (!row) return null;
            const pretty = row.details && typeof row.details === "object"
              ? JSON.stringify(row.details, null, 2)
              : formatAuditDetails(row.details) || "(no metadata)";
            return (
              <div className="mt-3 rounded-[var(--radius-md)] border border-admin-border bg-black/60 p-3" role="region" aria-label="Audit entry JSON inspector">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="rsx-mono text-xs font-bold text-admin-fg">{row.action} · {new Date(row.created_at).toLocaleString()}</p>
                  <Button variant="ghost" size="compact" onClick={() => setExpandedDetails(null)}>Close</Button>
                </div>
                <pre className="rsx-mono max-h-72 overflow-auto text-[11px] leading-5 text-[#7dd3fc]">{pretty}</pre>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-admin-muted-fg">
                  <span>Actor: <b className="text-admin-fg">{row.actor_email || "system"}</b></span>
                  <span>Method: <b className="text-admin-fg">{row.authentication_method || "—"}</b></span>
                  <span>Target: <b className="text-admin-fg">{row.target_email || "—"}</b></span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </>
  );
}
