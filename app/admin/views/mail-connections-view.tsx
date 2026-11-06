"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge, type BadgeVariant, Button, Notice } from "@/components/ui/primitives";
import { exportCsv, PageHeader, StatCard, Toolbar } from "../admin-shared";
import { fetchJson, useAdminQuery } from "../query-client";
import { DataTable, RowActions, type DataTableColumn } from "@/components/ui/admin/data-table";
import { Card, CardContent } from "@/components/ui/admin/card";
import { ConfirmActionDialog } from "@/components/ui/admin/confirm-action-dialog";
import { adminFetchJson } from "../admin-helpers";

type ConnectionRow = {
  id: string;
  user_id: string;
  email: string;
  provider: string;
  provider_tenant: string;
  verified_sender: string;
  connection_generation: number;
  status: string;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
  has_refresh_token: boolean;
};

export default function MailConnectionsView({ canEdit = false }: { canEdit?: boolean }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");
  const [busyRow, setBusyRow] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, setPending] = useState<{ id: string } | null>(null);
  const pageSize = 20;

  const { data, isPending, isError, error, refetch, isSuccess } = useAdminQuery<{ rows: ConnectionRow[]; total: number; stats?: Record<string, number> }>(
    ["admin", "mail-connections", query, provider, status, page],
    (signal) => fetchJson<{ rows: ConnectionRow[]; total: number }>(`/api/admin/mail-connections?q=${encodeURIComponent(query)}&provider=${provider}&status=${status}&page=${page}&pageSize=${pageSize}`, { signal }),
    { refetchInterval: 60_000 },
  );

  const rows = data?.rows ?? undefined;
  const total = data?.total ?? 0;
  const tableStatus = isError ? "error" : isPending ? "loading" : "success";

  async function disable(connectionId: string) {
    setBusyRow(connectionId);
    setMsg(null);
    try {
      const result = await adminFetchJson("/api/admin/mail-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, action: "disable" }),
      });
      if (!result.ok) {
        throw new Error(result.error || "Action failed.");
      }
      const ok = `Done: disabled connection ${connectionId.slice(0, 8)}`;
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
    if (provider !== "all") params.set("provider", provider);
    if (status !== "all") params.set("status", status);
    const collected: ConnectionRow[] = [];
    for (let page = 1; page <= 100; page++) {
      params.set("page", String(page));
      const r = await fetch(`/api/admin/mail-connections?${params.toString()}`, { credentials: "same-origin" });
      if (!r.ok) return;
      const j = await r.json().catch(() => ({})) as { rows?: ConnectionRow[] };
      const batch = j.rows ?? [];
      collected.push(...batch);
      if (batch.length < 100) break;
    }
    if (!collected.length) return;
    exportCsv("rolesharp-mail-connections.csv", collected, [
      ["email", (r) => r.email || "—"],
      ["provider", (r) => r.provider],
      ["verified_sender", (r) => r.verified_sender],
      ["status", (r) => r.status],
      ["connection_generation", (r) => r.connection_generation],
      ["created_at", (r) => r.created_at],
    ]);
  }

  const statusBadge = (s: string): BadgeVariant => {
    const map: Record<string, BadgeVariant> = {
      active: "success",
      needs_user: "warning",
      disabled: "default",
    };
    return map[s] || "default";
  };

  const columns: DataTableColumn<ConnectionRow>[] = [
    { id: "email", header: "User Email", className: "cell-main", cell: (c) => c.email || "—" },
    { id: "provider", header: "Provider", cell: (c) => <Badge variant="warning">{c.provider === "google" ? "Google (Gmail)" : "Microsoft (Outlook)"}</Badge> },
    { id: "verified_sender", header: "Verified Sender", className: "tabular", cell: (c) => c.verified_sender },
    { id: "status", header: "Status", cell: (c) => <Badge variant={statusBadge(c.status)}>{c.status}</Badge> },
    { id: "credential", header: "Refresh credential", cell: (c) => <Badge variant={c.has_refresh_token ? "success" : c.status === "disabled" ? "default" : "warning"}>{c.has_refresh_token ? "Stored" : c.status === "disabled" ? "Removed" : "Reconnect required"}</Badge> },
    { id: "gen", header: "Gen", align: "right", className: "num-col tabular", cell: (c) => c.connection_generation },
    { id: "created", header: "Created", cell: (c) => new Date(c.created_at).toLocaleDateString() },
  ];

  return (
    <>
      <PageHeader

        title="Mail Connections"
        desc="View and manage user email provider connections (Gmail and Outlook)."
        onRefresh={() => void refetch()}
      />
      <div className="admin-stat-grid" style={{ marginBottom: 18 }}>
        {/* stats come from the API over the FULL dataset, not the 20-row page */}
        <StatCard label="Total Connections" value={total} />
        <StatCard
          label="Active"
          value={data?.stats?.active ?? rows?.filter((r) => r.status === "active").length ?? 0}
          accent="green"
        />
        <StatCard
          label="Needs User"
          value={data?.stats?.needs_user ?? rows?.filter((r) => r.status === "needs_user").length ?? 0}
          accent="amber"
        />
        <StatCard
          label="Disabled"
          value={data?.stats?.disabled ?? rows?.filter((r) => r.status === "disabled").length ?? 0}
          accent="red"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <Toolbar placeholder="Search by email..." onSearch={(value) => { setQuery(value); setPage(1); }}>
            <select className="admin-table-filter" value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} aria-label="Filter by provider">
              <option value="all">All providers</option>
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
            </select>
            <select className="admin-table-filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="needs_user">Needs User</option>
              <option value="disabled">Disabled</option>
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
            empty={{ title: "No connections match", description: "Try a different search, provider, or status." }}
            rowActions={canEdit ? (c) => (
              <RowActions>
                {c.status === "active" && <Button variant="danger" size="compact" disabled={!!busyRow} onClick={() => setPending({ id: c.id })}>Disable</Button>}
                {c.status === "needs_user" && <span className="text-[13px] text-[var(--muted-fg)]">Awaiting user re-auth</span>}
                {c.status === "disabled" && <span className="text-[13px] text-[var(--muted-fg)]">Disabled</span>}
              </RowActions>
            ) : undefined}
            pagination={isSuccess ? { page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total, onPage: setPage } : undefined}
          />
        </CardContent>
      </Card>
      <ConfirmActionDialog
        open={!!pending}
        title="Disable email connection"
        description="Disable this email connection? The user will need to re-authorize."
        confirmLabel="Disable connection"
        busy={!!pending && busyRow === pending.id}
        onConfirm={async () => { const p = pending; if (p) await disable(p.id); setPending(null); }}
        onClose={() => setPending(null)}
      />
    </>
  );
}
