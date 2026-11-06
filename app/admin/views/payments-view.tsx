"use client";

import { useState } from "react";
import type { AdminStats as S } from "../admin-types";
import { PageHeader, StatCard, Toolbar } from "../admin-shared";
import { Badge, Button } from "@/components/ui/primitives";
import AccessibleDialog from "@/components/ui/AccessibleDialog";
import { fetchJson, useAdminQuery } from "../query-client";
import { DataTable, type DataTableColumn } from "@/components/ui/admin/data-table";
import { Card, CardContent } from "@/components/ui/admin/card";
import { CopyableId } from "@/components/ui/admin/copyable-id";

type PaymentRow = {
  id: string;
  email?: string;
  order_id?: string;
  plan?: string;
  status?: string;
  price_amount?: string | number;
  pay_currency?: string;
  provider?: "crypto" | "razorpay";
  created_at: string;
};

type PaymentListResponse = { rows: PaymentRow[]; total: number; statuses: string[] };

export default function PaymentsView({ s }: { s: S }) {
  const np = s.payments?.nowpayments || {};
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState<PaymentRow | null>(null);
  const pageSize = 20;

  const { data, isPending, isError, error, refetch, isSuccess } = useAdminQuery<PaymentListResponse>(
    ["admin", "payments", query, status, page],
    (signal) => fetchJson<PaymentListResponse>(`/api/admin/payments?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&page=${page}&pageSize=${pageSize}`, { signal }),
  );

  const rows = data?.rows ?? undefined;
  const total = data?.total ?? 0;
  const statuses = data?.statuses ?? [];
  const tableStatus = isError ? "error" : isPending ? "loading" : "success";

  const columns: DataTableColumn<PaymentRow>[] = [
    { id: "email", header: "User", cell: (p) => (<button type="button" className="text-left font-semibold text-[var(--color-primary)] underline underline-offset-2 hover:no-underline" onClick={() => setDetail(p)}>{p.email || <span className="text-[var(--muted-fg)]">unknown</span>}</button>) },
    { id: "order_id", header: "Order", className: "tabular", cell: (p) => <CopyableId value={p.order_id} /> },
    { id: "plan", header: "Plan", cell: (p) => p.plan || "monthly" },
    { id: "status", header: "Status", cell: (p) => <Badge variant={["finished", "confirmed", "paid"].includes(p.status || "") ? "success" : ["waiting", "invoice_pending", "invoice_unknown", "created"].includes(p.status || "") ? "warning" : ["validation_failed", "invoice_failed", "cancelled", "failed", "refunded"].includes(p.status || "") ? "danger" : "default"}>{p.status}</Badge> },
    { id: "amount", header: "Amount", align: "right", className: "tabular tabular-nums", cell: (p) => `${p.pay_currency?.toUpperCase() === "INR" ? "₹" : "$"}${p.price_amount ?? 0} ${p.pay_currency?.toUpperCase() || "USD"}` },
    { id: "provider", header: "Provider", cell: (p) => p.provider === "razorpay" ? "Razorpay" : "NOWPayments" },
    { id: "created_at", header: "Created", cell: (p) => new Date(p.created_at).toLocaleString() },
  ];

  return (
    <>
      <PageHeader title="Payments" desc="Razorpay and crypto checkout activity, with provider-safe amounts and downloadable invoices." />
      <div className="admin-stat-grid">
        <StatCard label="Settled invoice value" value={`$${s.totals.revenue} ${s.totals.revenueCurrency || "USD"}`} accent="green" />
        <StatCard label="Payment rows" value={s.totals.payRows} />
        <StatCard label="Premium users" value={s.totals.premiumUsers} />
        <StatCard label="NOW mode" value={np.live ? "Live" : np.dev ? "Dev" : "Off"} accent={np.live ? "green" : "amber"} />
        <StatCard label="API key" value={np.apiKeyConfigured ? "Set" : "Missing"} accent={np.apiKeyConfigured ? undefined : "red"} />
        <StatCard label="IPN secret" value={np.ipnSecretConfigured ? "Set" : "Missing"} accent={np.ipnSecretConfigured ? undefined : "red"} />
      </div>
      <Card>
        <CardContent className="p-0">
          <Toolbar placeholder="Search email or order id..." onSearch={(value) => { setQuery(value); setPage(1); }}>
            <select className="admin-table-filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
              <option value="">All statuses</option>
              {statuses.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          </Toolbar>
          <DataTable
            columns={columns}
            data={rows}
            status={tableStatus}
            error={error?.message}
            onRetry={() => refetch()}
            rowKey={(row) => row.id}
            skeletonRows={Math.min(pageSize, 8)}
            empty={{ title: "No payments match", description: "Adjust your search or status filter." }}
            pagination={isSuccess ? { page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total, onPage: setPage } : undefined}
          />
        </CardContent>
      </Card>
      {detail && (
        <AccessibleDialog label="Payment detail" onClose={() => setDetail(null)}>
          <div style={{ padding: 30, maxWidth: 600, width: "min(600px, calc(100vw - 40px))", maxHeight: "80vh", overflow: "auto" }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:16}}>
              <h3 style={{margin:0}}>Payment Detail</h3>
              <Button variant="outline" size="compact" type="button" onClick={()=>setDetail(null)}>Close</Button>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
              <Badge variant={["finished", "confirmed", "paid"].includes(detail.status || "") ? "success" : ["waiting", "created"].includes(detail.status || "") ? "warning" : "default"}>{detail.status}</Badge>
              <Badge variant="premium">{detail.plan || "monthly"}</Badge>
              <Badge>{detail.provider === "razorpay" ? "Razorpay" : "NOWPayments"}</Badge>
              {detail.email && <Badge>{detail.email}</Badge>}
            </div>
            <div className="admin-data-row"><span>Order ID</span><CopyableId value={detail.order_id} /></div>
            <div className="admin-data-row"><span>Invoice price</span><span className="text-[13px] text-[var(--muted-fg)]">{detail.pay_currency?.toUpperCase() === "INR" ? "₹" : "$"}{detail.price_amount ?? "—"} {detail.pay_currency?.toUpperCase() || "USD"}</span></div>
            <div className="admin-data-row"><span>Created</span><span className="text-[13px] text-[var(--muted-fg)]">{detail.created_at ? new Date(detail.created_at).toLocaleString() : "—"}</span></div>
            {(detail.status === "invoice_unknown" || detail.status === "validation_failed") && (
              <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginTop: 12 }}>
                {detail.status === "invoice_unknown"
                  ? "The invoice response was lost in transit — run npm run ipn:check to reconcile it with the provider."
                  : "The paid amount did not match the invoice — investigate before granting access manually."}
              </p>
            )}
          </div>
        </AccessibleDialog>
      )}
    </>
  );
}
