"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard, Toolbar } from "../admin-shared";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { fetchJson, useAdminQuery } from "../query-client";
import { DataTable, RowActions, type DataTableColumn } from "@/components/ui/admin/data-table";
import { Card, CardContent } from "@/components/ui/admin/card";
import { ConfirmActionDialog } from "@/components/ui/admin/confirm-action-dialog";
import { adminFetchJson } from "../admin-helpers";

type StudentClaim = {
  record_state: string;
  student_email: string;
  account_email?: string;
  user_id?: string;
  requested_at?: string;
  premium_until?: string;
  premium_source?: string;
  expires_at?: string;
  warn30_sent_at?: string;
  expired_sent_at?: string;
  winback_sent_at?: string;
  winback_opt_out?: boolean;
  review?: { academicDomainAllowed: boolean; grantCount: number; requestAccountCount: number };
};
type StudentListResponse = { rows: StudentClaim[]; total: number; stats?: Record<string, number> };

export default function StudentsView({ canManage = false }: { canManage?: boolean }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, setPending] = useState<{ studentEmail: string; action: string; days?: number; label: string } | null>(null);
  const pageSize = 20;

  const { data, isPending, isError, error, refetch, isSuccess } = useAdminQuery<StudentListResponse>(
    ["admin", "students", query, page],
    (signal) => fetchJson<StudentListResponse>(`/api/admin/students?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`, { signal }),
  );

  const rows = data?.rows ?? undefined;
  const total = data?.total ?? 0;
  const st = data?.stats || {};
  const tableStatus = isError ? "error" : isPending ? "loading" : "success";
  const isActive = (c: StudentClaim) => Boolean(c.premium_until && new Date(c.premium_until) > new Date() && c.premium_source === "student");

  const columns: DataTableColumn<StudentClaim>[] = [
    { id: "student_email", header: "Student email", className: "cell-main", cell: (c) => c.student_email },
    { id: "account", header: "Account", cell: (c) => c.account_email || <span className="text-[var(--muted-fg)]">deleted account</span> },
    { id: "requested", header: "Requested / claimed", cell: (c) => c.requested_at ? new Date(c.requested_at).toLocaleString() : "—" },
    { id: "review", header: "Review context", cell: (c) => c.review ? <div className="flex flex-col items-start gap-1"><Badge variant={c.review.academicDomainAllowed ? "success" : "warning"}>{c.review.academicDomainAllowed ? "Academic domain allowed" : "Review domain policy"}</Badge><span className="text-xs">{c.review.grantCount} historical grant{c.review.grantCount === 1 ? "" : "s"}</span><span className="text-xs" title="Distinct accounts using the latest recorded request IP in the last 30 days. Shared networks are common at universities.">{c.review.requestAccountCount || "No"} account{c.review.requestAccountCount === 1 ? "" : "s"} on request IP (30d)</span></div> : "Not available" },
    {
      id: "status",
      header: "Status",
      cell: (c) => {
        const pending = c.record_state === "pending";
        const pendingExpired = c.record_state === "pending_expired";
        return (
          <div className="flex flex-col gap-0.5">
            <Badge variant={isActive(c) || pending ? "success" : "default"}>{pending ? "Awaiting click" : pendingExpired ? "Link expired" : isActive(c) ? "Active" : "Expired"}</Badge>
            {isActive(c) && c.premium_until && <span className="text-[13px] text-[var(--muted-fg)]">until {new Date(c.premium_until).toLocaleDateString()}</span>}
            {(pending || pendingExpired) && c.expires_at && <span className="text-[13px] text-[var(--muted-fg)]">link {pending ? "expires" : "expired"} {new Date(c.expires_at).toLocaleString()}</span>}
          </div>
        );
      },
    },
    {
      id: "lifecycle",
      header: "Lifecycle",
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.warn30_sent_at && <Badge variant="warning">warn30</Badge>}
          {c.expired_sent_at && <Badge variant="warning">expired-mail</Badge>}
          {c.winback_sent_at && <Badge variant="premium">winback</Badge>}
          {c.winback_opt_out && <Badge variant="default">opt-out</Badge>}
        </div>
      ),
    },
  ];

  async function act(studentEmail: string, action: string, days?: number) {
    setBusy(studentEmail + action); setMsg(null);
    try {
      const result = await adminFetchJson("/api/admin/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentEmail, action, days }) });
      if (!result.ok) { const m = result.error === "student_plan_not_current" ? "This account no longer has a student plan. Its current access was preserved." : result.error || "Action failed."; setMsg({ error: m }); toast.error(m); return false; }
      const ok = `Done: ${action} — ${studentEmail}`;
      setMsg({ ok }); toast.success(ok);
      void refetch();
      return true;
    } catch { const m = "Network error."; setMsg({ error: m }); toast.error(m); return false; }
    finally { setBusy(""); }
  }

  return (
    <>
      <PageHeader title="Student Offer" desc="Every academic-email request from link sent through activation, expiry, win-back, and manual overrides." onRefresh={() => refetch()} />
      <div className="admin-stat-grid">
        <StatCard label="Applications" value={st.applications ?? "—"} />
        <StatCard label="Awaiting confirmation" value={st.pending ?? "—"} accent="green" />
        <StatCard label="Expired links" value={st.pending_expired ?? "—"} />
        <StatCard label="Total claims" value={st.total ?? "—"} />
        <StatCard label="Active student premium" value={st.active ?? "—"} accent="green" />
        <StatCard label="Expired" value={st.expired ?? "—"} />
        <StatCard label="Claims (30d)" value={st.last30 ?? "—"} accent="green" />
        <StatCard label="Win-backs sent" value={st.winbacks ?? "—"} />
        <StatCard label="Opt-outs" value={st.optouts ?? "—"} />
      </div>
      <p className="mb-4 text-sm text-[var(--muted-fg)]">Review signals are context, not proof of abuse. Shared university networks can serve many legitimate students. Historical grants remain immutable.</p>
      <Card>
        <CardContent className="p-0">
          <Toolbar placeholder="Search student or account email..." onSearch={(value) => { setQuery(value); setPage(1); }} />
          {msg?.ok && <Notice variant="success" role="status">{msg.ok}</Notice>}
          {msg?.error && <Notice variant="danger" role="alert">{msg.error}</Notice>}
          <DataTable
            columns={columns}
            data={rows}
            status={tableStatus}
            error={error?.message}
            onRetry={() => refetch()}
            rowKey={(c) => `${c.record_state}-${c.student_email}`}
            skeletonRows={Math.min(pageSize, 8)}
            empty={{ title: "No claims match", description: "Try a different search term." }}
            rowActions={canManage ? (c) => (
              <RowActions>
                {c.record_state === "claimed" ? <>
                  {c.user_id && c.premium_source === "student" && <Button variant="outline" size="compact" disabled={Boolean(busy)} isLoading={busy === c.student_email + "extend"} onClick={() => setPending({ studentEmail: c.student_email, action: "extend", days: 30, label: `Extend student Premium for ${c.student_email} by 30 days?` })}>+30d</Button>}
                  {c.user_id && isActive(c) && <Button variant="danger" size="compact" disabled={busy === c.student_email + "revoke"} onClick={() => setPending({ studentEmail: c.student_email, action: "revoke", label: `End student premium for ${c.student_email} now?` })}>Revoke</Button>}
                  <Button variant="danger" size="compact" disabled={busy === c.student_email + "release"} onClick={() => setPending({ studentEmail: c.student_email, action: "release", label: `Release ${c.student_email}? The email becomes claimable for a fresh 6 months.` })}>Release</Button>
                </> : <span className="text-[13px] text-[var(--muted-fg)]">User must click the emailed link</span>}
              </RowActions>
            ) : undefined}
            pagination={isSuccess ? { page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total, onPage: setPage } : undefined}
          />
        </CardContent>
      </Card>
      <ConfirmActionDialog
        open={!!pending}
        title={pending?.action === "extend" ? "Extend student Premium" : pending?.action === "revoke" ? "End student premium" : "Release student claim"}
        description={pending?.label}
        confirmLabel="Confirm"
        busy={!!pending && busy === pending.studentEmail + pending.action}
        // Async: the dialog stays open with its busy state until act settles;
        // pending is cleared here (and by onClose) only after the await.
        onConfirm={async () => { const p = pending; if (p && !await act(p.studentEmail, p.action, p.days)) throw new Error("student_action_not_applied"); setPending(null); }}
        onClose={() => setPending(null)}
      />
    </>
  );
}
