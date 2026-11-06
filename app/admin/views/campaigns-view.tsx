"use client";

import { useState } from "react";
import { toast } from "sonner";
import { exportCsv, PageHeader, StatCard, Toolbar } from "../admin-shared";
import { Badge, type BadgeVariant, Button, Notice } from "@/components/ui/primitives";
import { fetchJson, useAdminQuery } from "../query-client";
import { DataTable, RowActions, type DataTableColumn } from "@/components/ui/admin/data-table";
import { Card, CardContent } from "@/components/ui/admin/card";
import { ConfirmActionDialog } from "@/components/ui/admin/confirm-action-dialog";
import { adminFetchJson } from "../admin-helpers";

type CampaignRow = {
  id: string;
  user_id: string;
  email: string;
  mode: string;
  authorization_mode: string;
  status: string;
  profile_version: number;
  criteria_version: number;
  timezone: string;
  daily_time: string;
  daily_limit: number;
  fit_score_floor: number;
  confidence_score_floor: number;
  consent_version: number | null;
  consent_expires_at: string | null;
  created_at: string;
  updated_at: string;
  canceled_at: string | null;
};

export default function CampaignsView({ canManage = false }: { canManage?: boolean }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("all");
  const [busyRow, setBusyRow] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, setPending] = useState<{ campaignId: string; action: string; label: string } | null>(null);
  const pageSize = 20;

  const { data, isPending, isError, error, refetch, isSuccess } = useAdminQuery<{ rows: CampaignRow[]; total: number; stats?: Record<string, number> }>(
    ["admin", "campaigns", query, mode, status, page],
    (signal) => fetchJson<{ rows: CampaignRow[]; total: number }>(`/api/admin/campaigns?q=${encodeURIComponent(query)}&mode=${mode}&status=${status}&page=${page}&pageSize=${pageSize}`, { signal }),
  );

  const rows = data?.rows ?? undefined;
  const total = data?.total ?? 0;
  const tableStatus = isError ? "error" : isPending ? "loading" : "success";

  async function act(campaignId: string, action: string) {
    setBusyRow(campaignId + action);
    setMsg(null);
    try {
      const result = await adminFetchJson("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, action }),
      });
      if (!result.ok) throw new Error(result.error || "Action failed.");
      const ok = `Done: ${action} — campaign ${campaignId.slice(0, 8)}`;
      setMsg({ ok }); toast.success(ok);
      void refetch();
    } catch (error) {
      const m = error instanceof Error ? error.message : "Network error.";
      setMsg({ error: m }); toast.error(m);
      throw error;
    } finally {
      setBusyRow("");
    }
  }

  // Export the FULL filtered dataset (paged at the 100-row API max), not just
  // the 20 rows currently on screen.
  async function exportAll() {
    const params = new URLSearchParams({ pageSize: "100" });
    if (query) params.set("q", query);
    if (mode !== "all") params.set("mode", mode);
    if (status !== "all") params.set("status", status);
    const collected: CampaignRow[] = [];
    for (let page = 1; page <= 100; page++) {
      params.set("page", String(page));
      const r = await fetch(`/api/admin/campaigns?${params.toString()}`, { credentials: "same-origin" });
      if (!r.ok) return;
      const j = await r.json().catch(() => ({})) as { rows?: CampaignRow[] };
      const batch = j.rows ?? [];
      collected.push(...batch);
      if (batch.length < 100) break;
    }
    if (!collected.length) return;
    exportCsv("rolesharp-campaigns.csv", collected, [
      ["email", (r) => r.email || "—"],
      ["mode", (r) => r.mode],
      ["status", (r) => r.status],
      ["daily_limit", (r) => r.daily_limit],
      ["fit_score_floor", (r) => r.fit_score_floor],
      ["confidence_score_floor", (r) => r.confidence_score_floor],
      ["timezone", (r) => r.timezone],
      ["daily_time", (r) => r.daily_time],
      ["created_at", (r) => r.created_at],
    ]);
  }

  const statusBadge = (s: string): BadgeVariant => {
    const map: Record<string, BadgeVariant> = {
      active: "success",
      paused: "warning",
      draft: "default",
      needs_user: "warning",
      expired: "default",
      canceled: "default",
    };
    return map[s] || "default";
  };

  const columns: DataTableColumn<CampaignRow>[] = [
    { id: "email", header: "Email", className: "cell-main", cell: (c) => c.email || "—" },
    { id: "mode", header: "Mode", cell: (c) => <Badge variant="warning">{c.mode === "daily_matches" ? "Daily Matches" : "Role Apply"}</Badge> },
    { id: "status", header: "Status", cell: (c) => <Badge variant={statusBadge(c.status)}>{c.status}</Badge> },
    { id: "daily_limit", header: "Daily Limit", align: "right", className: "num-col tabular", cell: (c) => c.daily_limit },
    { id: "fit_floor", header: "Fit Floor", align: "right", className: "num-col tabular", cell: (c) => c.fit_score_floor },
    { id: "conf_floor", header: "Conf Floor", align: "right", className: "num-col tabular", cell: (c) => c.confidence_score_floor },
    { id: "timezone", header: "Timezone", className: "tabular", cell: (c) => <span className="block max-w-[120px] truncate" title={c.timezone}>{c.timezone}</span> },
    { id: "daily_time", header: "Daily Time", className: "tabular", cell: (c) => c.daily_time?.slice(0, 5) },
  ];

  return (
    <>
      <PageHeader

        title="Campaigns"
        desc="View and manage user job-match campaigns (daily matches and auto-apply)."
      />
      <div className="admin-stat-grid" style={{ marginBottom: 18 }}>
        {/* stats come from the API over the FULL dataset, not the 20-row page */}
        <StatCard label="Total Campaigns" value={total} />
        <StatCard label="Active" value={data?.stats?.active ?? rows?.filter((r) => r.status === "active").length ?? 0} accent="green" />
        <StatCard label="Paused" value={data?.stats?.paused ?? rows?.filter((r) => r.status === "paused").length ?? 0} accent="amber" />
        <StatCard label="Needs User" value={data?.stats?.needs_user ?? rows?.filter((r) => r.status === "needs_user").length ?? 0} accent="red" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Toolbar placeholder="Search by email..." onSearch={(value) => { setQuery(value); setPage(1); }}>
            <select className="admin-table-filter" value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }} aria-label="Filter by mode">
              <option value="all">All modes</option>
              <option value="daily_matches">Daily Matches</option>
              <option value="role_apply">Role Apply</option>
            </select>
            <select className="admin-table-filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="needs_user">Needs User</option>
              <option value="expired">Expired</option>
              <option value="canceled">Canceled</option>
            </select>
            <Button variant="outline" size="compact" onClick={() => void exportAll()}>Export CSV</Button>
          </Toolbar>
          {msg?.ok && <Notice variant="success" role="status">{msg.ok}</Notice>}
          {msg?.error && <Notice variant="danger" role="alert">{msg.error}</Notice>}
          <DataTable
            columns={columns}
            data={rows}
            status={tableStatus}
            error={error?.message}
            onRetry={() => refetch()}
            rowKey={(c) => c.id}
            skeletonRows={Math.min(pageSize, 8)}
            empty={{ title: "No campaigns match", description: "Try a different search, mode, or status." }}
            rowActions={canManage ? (c) => (
              <RowActions>
                {c.status === "active" && <Button variant="outline" size="compact" disabled={!!busyRow} onClick={() => setPending({ campaignId: c.id, action: "pause", label: "Pause" })}>Pause</Button>}
                {c.status === "paused" && <Button size="compact" disabled={!!busyRow} onClick={() => setPending({ campaignId: c.id, action: "activate", label: "Activate" })}>Activate</Button>}
                {/* updateCampaign allows resuming needs_user too — the operator
                    may have just fixed the underlying mailbox/recipient issue. */}
                {c.status === "needs_user" && <Button variant="outline" size="compact" disabled={!!busyRow} onClick={() => setPending({ campaignId: c.id, action: "activate", label: "Activate" })}>Activate</Button>}
                {c.status !== "canceled" && c.status !== "expired" && <Button variant="danger" size="compact" disabled={!!busyRow} onClick={() => setPending({ campaignId: c.id, action: "cancel", label: "Cancel" })}>Cancel</Button>}
              </RowActions>
            ) : undefined}
            pagination={isSuccess ? { page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total, onPage: setPage } : undefined}
          />
        </CardContent>
      </Card>
      <ConfirmActionDialog
        open={!!pending}
        title={pending ? `${pending.label} campaign` : "Confirm campaign action"}
        description={pending ? `${pending.label} this campaign?` : ""}
        confirmLabel={pending?.label || "Confirm"}
        busy={!!pending && busyRow === pending.campaignId + pending.action}
        onConfirm={async () => { const p = pending; if (p) await act(p.campaignId, p.action); setPending(null); }}
        onClose={() => setPending(null)}
      />
    </>
  );
}
