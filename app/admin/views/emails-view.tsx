"use client";

import { useEffect, useState } from "react";
import { PageHeader, Toolbar } from "../admin-shared";
import { Badge } from "@/components/ui/primitives";
import { fetchJson, useAdminQuery } from "../query-client";
import { DataTable, type DataTableColumn } from "@/components/ui/admin/data-table";
import { Card, CardContent } from "@/components/ui/admin/card";

type EmailRow = { id: string; recipient: string; subject: string; type: string; status: string; transport?: string | null; error_msg?: string; created_at: string };
type EmailListResponse = { rows: EmailRow[]; total: number };

export default function EmailsView() {
  const [page, setPage] = useState(1);
  const [recipient, setRecipient] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [transport, setTransport] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [copied, setCopied] = useState("");
  const pageSize = 20;

  const { data, isPending, isError, error, refetch, isSuccess } = useAdminQuery<EmailListResponse>(
    ["admin", "emails", recipient, type, status, transport, page],
    (signal) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (recipient.trim()) params.set("recipient", recipient.trim());
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      if (transport.trim()) params.set("transport", transport.trim());
      return fetchJson<EmailListResponse>(`/api/admin/emails?${params.toString()}`, { signal });
    },
  );

  const rows = data?.rows ?? undefined;
  const total = data?.total ?? 0;
  const tableStatus = isError ? "error" : isPending ? "loading" : "success";

  const columns: DataTableColumn<EmailRow>[] = [
    { id: "recipient", header: "Recipient", className: "cell-main", cell: (e) => (<>{e.recipient}<button type="button" aria-label={`Copy ${e.recipient}`} title="Copy address" className="ml-2 inline-flex text-[var(--color-text-faint)] hover:text-[var(--color-primary)]" onClick={() => { navigator.clipboard?.writeText(e.recipient).catch(() => {}); setCopied(e.id); setTimeout(() => setCopied(""), 1500); }}>{copied === e.id ? "✓" : "⧉"}</button></>) },
    { id: "subject", header: "Subject", cell: (e) => e.subject },
    { id: "transport", header: "Transport", cell: (e) => e.transport || "Not recorded" },
    { id: "type", header: "Type", cell: (e) => <Badge variant="warning">{e.type}</Badge> },
    { id: "status", header: "Status", cell: (e) => <Badge title={e.error_msg || undefined} variant={e.status === "sent" ? "success" : e.status === "queued" ? "warning" : "default"}>{e.status}</Badge> },
    { id: "created", header: "Created", cell: (e) => new Date(e.created_at).toLocaleString() },
  ];

  useEffect(() => {
    fetch("/api/admin/emails?types=1")
      .then((r) => r.json())
      .then((j) => { if (j.types) setTypes(j.types); })
      .catch(() => {});
  }, []);

  return (
    <>
      <PageHeader title="Email Log" desc="Every transactional email sent by the system, searchable by recipient and type." />
      <Card>
        <CardContent className="p-0">
          <Toolbar placeholder="Search by recipient..." onSearch={(value) => { setRecipient(value); setPage(1); }}>
            <select className="admin-table-filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by delivery status">
              <option value="">All delivery states</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="queued">Queued</option>
            </select>
            <input className="admin-table-filter" aria-label="Filter by transport" placeholder="Transport: cloudflare, smtp, bulk:1" value={transport} onChange={(e) => { setTransport(e.target.value); setPage(1); }} />
            <select className="admin-table-filter" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Filter by type">
              <option value="">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Toolbar>
          <DataTable
            columns={columns}
            data={rows}
            status={tableStatus}
            error={error?.message}
            onRetry={() => refetch()}
            rowKey={(e) => e.id}
            skeletonRows={Math.min(pageSize, 8)}
            empty={{ title: "No emails match", description: "Try a different recipient or type." }}
            pagination={isSuccess ? { page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total, onPage: setPage } : undefined}
          />
        </CardContent>
      </Card>
    </>
  );
}
