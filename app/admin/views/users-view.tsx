"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import "./users-view.css";
import { exportCsv, PageHeader, StatCard, Toolbar } from "../admin-shared";
import { useAdminQuery } from "../query-client";
import { DataTable, RowActions, type DataTableColumn } from "@/components/ui/admin/data-table";
import { Button } from "@/components/ui/admin/button";
import { Badge } from "@/components/ui/admin/badge";
import { Card, CardContent } from "@/components/ui/admin/card";
import { Notice } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";
import { useAdminConfirm } from "../confirm-dialog";

type GrantDays = 7 | 30 | 90 | 365;

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  premium_until: string | null;
  premium_source: string | null;
  email_verified_at: string | null;
  credits: number;
  resumes: number;
};

type UserListResponse = { rows: UserRow[]; total: number };

function planLabel(user: UserRow): "free" | "student" | "premium" {
  const isPremium = user.premium_until && new Date(user.premium_until) > new Date();
  if (!isPremium) return "free";
  return user.premium_source === "student" ? "student" : "premium";
}

type SortState = { column: string; dir: "asc" | "desc" };

function SortHeader({ column, sort, onSort, children }: { column: string; sort: SortState; onSort: (next: SortState) => void; children: ReactNode }) {
  const active = sort.column === column;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-admin-muted-fg hover:text-admin-fg"
      onClick={() => onSort({ column, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
    >
      {children}
      <span aria-hidden>{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
    </button>
  );
}

export default function UsersView({ onRefresh, canManage = false }: { onRefresh: () => void; canManage?: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const GRANT_DAYS: GrantDays[] = [7, 30, 90, 365];
  const [grantDays, setGrantDays] = useState<GrantDays>(30);
  const [busyEmail, setBusyEmail] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequest = useRef(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ column: string; dir: "asc" | "desc" }>({ column: "created_at", dir: "desc" });
  const pageSize = 20;
  const rowLocked = (email: string) => busyEmail === "*" || busyEmail === email;

  const { data, isPending, isSuccess, isError, error, refetch } = useAdminQuery<UserListResponse>(
    ["admin", "users", query, plan, page, sort.column, sort.dir],
    async (signal) => {
      const res = await fetch(`/api/admin/users?list=1&q=${encodeURIComponent(query)}&plan=${plan}&page=${page}&pageSize=${pageSize}&sort=${sort.column}&dir=${sort.dir}`, { credentials: "same-origin", cache: "no-store", signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error || "Could not load users.");
      }
      return (await res.json()) as UserListResponse;
    },
    { refetchInterval: 60_000 },
  );

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("filter");
    if (initial && ["all", "premium", "paid", "student", "free"].includes(initial)) setPlan(initial);
  }, []);

  useEffect(() => { setRows(data?.rows ?? null); setTotal(data?.total ?? 0); }, [data]);
  useEffect(() => { setSelected(new Set()); }, [page, query, plan]);
  useEffect(() => { setPage(1); }, [query, plan, sort]);

  const toggleDetail = useCallback(async (userId: string) => {
    const requestId = ++detailRequest.current;
    if (detailId === userId) { setDetailId(null); setDetail(null); setDetailLoading(false); return; }
    setDetailId(userId); setDetail(null); setDetailLoading(true);
    try {
      const r = await fetch(`/api/admin/user-detail?userId=${encodeURIComponent(userId)}`, { credentials: "same-origin" });
      const next = r.ok ? await r.json() : null;
      if (requestId === detailRequest.current) setDetail(next);
    } catch { if (requestId === detailRequest.current) setDetail(null); }
    finally { if (requestId === detailRequest.current) setDetailLoading(false); }
  }, [detailId]);

  async function performAct(email: string, body: { action: string; days?: number; delta?: number }) {
    setBusyEmail(email); setMsg(null);
    try {
      const url = body.action === "grant" || body.action === "revoke" ? "/api/admin/premium" : body.action === "verify" || body.action === "resend" ? "/api/admin/verify-email" : "/api/admin/users";
      const payload = body.action === "verify" ? { email } : { email, ...body };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const m = (j as { error?: string })?.error || "Action failed."; setMsg({ error: m }); toast.error(m); return; }
      setMsg({ ok: `Done: ${body.action} — ${email}` });
      toast.success(`Done: ${body.action} — ${email}`);
      // The deleted user's detail drawer must not stay open over stale data.
      if (body.action === "delete") { ++detailRequest.current; setDetailId(null); setDetail(null); setDetailLoading(false); }
      void refetch(); onRefresh();
    } catch { const m = "Network error."; setMsg({ error: m }); toast.error(m); }
    finally { setBusyEmail(""); }
  }

  const ACT_META: Record<string, { title: string; word: string }> = {
    grant: { title: "Grant Premium", word: "GRANT" },
    revoke: { title: "Revoke Premium", word: "REVOKE" },
    verify: { title: "Mark as verified", word: "VERIFY" },
    resend: { title: "Send verification email", word: "RESEND" },
    credits: { title: "Add credits", word: "CREDITS" },
    delete: { title: "Delete user", word: "DELETE USER" },
  };

  function act(email: string, body: { action: string; days?: number; delta?: number }, confirmText?: string) {
    const meta = ACT_META[body.action];
    if (!meta) { void performAct(email, body); return; }
    ask({
      title: `${meta.title} — ${email}`,
      body: body.action === "delete"
        ? `Permanently delete ${email} and all their data? This cannot be undone.`
        : confirmText ?? "This applies to the selected account and is recorded in the audit log.",
      word: meta.word,
      run: () => performAct(email, body),
    });
  }

  async function performBulkGrant(users: UserRow[]) {
    setBusyEmail("*"); setMsg(null);
    let completed = 0;
    try {
      for (const user of users) {
        const response = await fetch("/api/admin/premium", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, action: "grant", days: grantDays }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`${user.email}: ${(payload as { error?: string })?.error || "grant failed"}`);
        completed += 1;
      }
      setSelected(new Set());
      const m = `Granted ${grantDays} days Premium to ${completed} users.`;
      setMsg({ ok: m }); toast.success(m);
      await refetch(); onRefresh();
    } catch (error) {
      const m = `Completed ${completed} of ${users.length}. ${error instanceof Error ? error.message : "Bulk grant failed."}`;
      setMsg({ error: m }); toast.error(m);
      await refetch(); onRefresh();
    } finally { setBusyEmail(""); }
  }

  function grantSelectedPremium() {
    const users = (rows || []).filter((user) => selected.has(user.id));
    if (!users.length) return;
    ask({
      title: "Bulk grant Premium",
      body: `Grant ${grantDays} days Premium to ${users.length} selected users.`,
      word: "GRANT",
      run: () => performBulkGrant(users),
    });
  }

  async function exportAll() {
    const r = await fetch(`/api/admin/users?list=1&export=csv&q=${encodeURIComponent(query)}&plan=${plan}&page=1&pageSize=1000`);
    if (!r.ok) return;
    const j = await r.json();
    exportCsv("rolesharp-users.csv", j.rows, [
      ["user_id", (u) => u.id], ["email", (u) => u.email], ["joined", (u) => u.created_at],
      ["plan", (u) => planLabel(u)],
      ["premium_source", (u) => u.premium_source || ""], ["premium_until", (u) => u.premium_until || ""], ["verified", (u) => (u.email_verified_at ? "yes" : "no")],
      ["credits", (u) => u.credits], ["resumes", (u) => u.resumes],
    ]);
  }

  const columns: DataTableColumn<UserRow>[] = [
    // ADMIN-03: the bulk action bar filtered on `selected`, but nothing ever
    // populated that set — a checkbox column was missing entirely.
    {
      id: "select",
      header: canManage ? (
        <input
          type="checkbox"
          aria-label="Select all users on this page"
          checked={(rows ?? []).length > 0 && (rows ?? []).every((u) => selected.has(u.id))}
          onChange={(event) => {
            const next = new Set(selected);
            if (event.target.checked) (rows ?? []).forEach((u) => next.add(u.id));
            else (rows ?? []).forEach((u) => next.delete(u.id));
            setSelected(next);
          }}
        />
      ) : null,
      cell: (u) => canManage ? (
        <input
          type="checkbox"
          aria-label={`Select ${u.email}`}
          checked={selected.has(u.id)}
          onChange={(event) => {
            const next = new Set(selected);
            if (event.target.checked) next.add(u.id);
            else next.delete(u.id);
            setSelected(next);
          }}
        />
      ) : null,
    },
    {
      id: "email",
      header: <SortHeader column="email" sort={sort} onSort={setSort}>Email</SortHeader>,
      cell: (u) => (
        <div>
        <button type="button" className="text-left font-semibold text-[var(--color-primary)] underline underline-offset-2 hover:no-underline" onClick={() => toggleDetail(u.id)}>
          {u.email}
        </button>
        <button type="button" className="mt-1 block break-all text-left text-xs text-admin-muted-fg" aria-label={`Copy user ID ${u.id}`} title="Copy user ID" onClick={async () => {
          try { await navigator.clipboard.writeText(u.id); toast.success("User ID copied"); }
          catch { toast.error("Could not copy user ID."); }
        }}>{u.id}</button>
        </div>
      ),
    },
    { id: "created_at", header: <SortHeader column="created_at" sort={sort} onSort={setSort}>Joined</SortHeader>, cell: (u) => new Date(u.created_at).toLocaleDateString() },
    {
      id: "premium_until",
      header: <SortHeader column="premium_until" sort={sort} onSort={setSort}>Plan</SortHeader>,
      cell: (u) => {
        const isPremium = u.premium_until && new Date(u.premium_until) > new Date();
        const isStudent = isPremium && u.premium_source === "student";
        return (
          <div className="flex flex-col gap-0.5">
            <Badge variant={isStudent ? "warning" : isPremium ? "success" : "neutral"}>
              {isStudent ? "Student" : isPremium ? "Premium" : "Free"}
            </Badge>
            {isPremium && u.premium_until && <span className="text-[13px] text-[var(--muted-fg)]">until {new Date(u.premium_until).toLocaleDateString()}</span>}
          </div>
        );
      },
    },
    { id: "email_verified_at", header: <SortHeader column="email_verified_at" sort={sort} onSort={setSort}>Verified</SortHeader>, cell: (u) => (u.email_verified_at ? <Badge variant="success">Yes</Badge> : <Badge variant="warning">No</Badge>) },
    { id: "credits", header: <SortHeader column="credits" sort={sort} onSort={setSort}>Credits</SortHeader>, align: "right", className: "tabular tabular-nums", cell: (u) => u.credits },
    { id: "resumes", header: <SortHeader column="resumes" sort={sort} onSort={setSort}>Resumes</SortHeader>, align: "right", className: "tabular tabular-nums", cell: (u) => u.resumes },
  ];

  return (
    <div className="uv2">
      <PageHeader title="Users" desc={canManage ? "Search, filter, manage plans, verify emails, adjust credits, export, or delete accounts." : "Search, filter, inspect, and export user accounts."} onRefresh={() => { void refetch(); onRefresh(); }} />

      <Card>
        <CardContent className="p-0">
          <Toolbar placeholder="Search by email or user ID..." onSearch={(value) => { setQuery(value); setPage(1); }}>
            <select className="admin-table-filter" value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} aria-label="Filter by plan">
              <option value="all">All plans</option>
              <option value="premium">Premium (all)</option>
              <option value="paid">Paid premium</option>
              <option value="student">Student premium</option>
              <option value="free">Free</option>
            </select>
            {canManage && <select className="admin-table-filter" value={grantDays} onChange={(e) => setGrantDays(Number(e.target.value) as GrantDays)} aria-label="Premium grant duration">
              {GRANT_DAYS.map((days) => <option key={days} value={days}>Grant: {days} days</option>)}
            </select>}
            <Button variant="outline" size="sm" onClick={exportAll}>Export CSV</Button>
          </Toolbar>
          {msg?.ok && <Notice variant="success" role="status">{msg.ok}</Notice>}
          {msg?.error && <Notice variant="danger" role="alert">{msg.error}</Notice>}
          {canManage && selected.size > 0 && (
            <Notice variant="success" className="flex flex-wrap items-center gap-2.5">
              <span><b>{selected.size}</b> selected</span>
              <Button size="compact" disabled={!!busyEmail} isLoading={!!busyEmail} onClick={() => void grantSelectedPremium()}>Grant {grantDays}d Premium</Button>
              <Button variant="outline" size="compact" onClick={() => { exportCsv("rolesharp-selected.csv", (rows||[]).filter(r => selected.has(r.id)), [["user_id",(u:any)=>u.id],["email",(u:any)=>u.email],["joined",(u:any)=>u.created_at],["plan",(u:any)=>planLabel(u)],["premium_source",(u:any)=>u.premium_source||""],["credits",(u:any)=>u.credits],["resumes",(u:any)=>u.resumes]]); }}>Export CSV</Button>
              <Button variant="outline" size="compact" onClick={() => setSelected(new Set())}>Clear selection</Button>
            </Notice>
          )}
          <DataTable
            columns={columns}
            data={rows ?? undefined}
            // API failures must surface as the DataTable error state with a
            // Retry — status="success" + empty rows read as "No records found".
            status={isError ? "error" : isPending ? "loading" : "success"}
            error={isError ? (error?.message || "Could not load users.") : msg?.error}
            onRetry={() => refetch()}
            rowKey={(row) => row.id}
            skeletonRows={Math.min(pageSize, 8)}
            rowActions={canManage ? (u) => {
              const isPremium = u.premium_until && new Date(u.premium_until) > new Date();
              return (
                <RowActions>
                  {!isPremium && <Button size="compact" disabled={rowLocked(u.email)} isLoading={busyEmail === u.email} onClick={() => act(u.email, { action: "grant", days: grantDays }, `Grant ${grantDays} days Premium to ${u.email}?`)}>+{grantDays}d</Button>}
                  {isPremium && <Button variant="outline" size="compact" disabled={rowLocked(u.email)} isLoading={busyEmail === u.email} onClick={() => act(u.email, { action: "grant", days: grantDays }, `Extend Premium for ${u.email} by ${grantDays} days?`)}>+{grantDays}d</Button>}
                  {isPremium && <Button variant="destructive" size="compact" disabled={rowLocked(u.email)} isLoading={busyEmail === u.email} onClick={() => act(u.email, { action: "revoke" }, `Revoke Premium for ${u.email}?`)}>Revoke</Button>}
                  {!u.email_verified_at && <Button variant="outline" size="compact" disabled={rowLocked(u.email)} isLoading={busyEmail === u.email} onClick={() => act(u.email, { action: "verify" }, `Manually mark ${u.email} as verified? Only continue after independently confirming ownership.`)}>Verify</Button>}
                  {!u.email_verified_at && <Button variant="outline" size="compact" disabled={rowLocked(u.email)} isLoading={busyEmail === u.email} onClick={() => act(u.email, { action: "resend" }, `Send a fresh verification email to ${u.email}?`)}>Resend</Button>}
                  <Button variant="outline" size="compact" disabled={rowLocked(u.email)} isLoading={busyEmail === u.email} onClick={() => act(u.email, { action: "credits", delta: 5 }, `Add 5 credits to ${u.email}?`)}>+5cr</Button>
                  <Button variant="destructive" size="compact" disabled={rowLocked(u.email)} isLoading={busyEmail === u.email} onClick={() => act(u.email, { action: "delete" })}>Delete...</Button>
                </RowActions>
              );
            } : undefined}
            pagination={isSuccess ? { page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total, onPage: setPage } : undefined}
          />
        </CardContent>
      </Card>

      {detailId && (
        <div className="admin-chart-card uv2-detail" style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>User Detail</h3>
            <Button variant="outline" size="compact" onClick={() => { setDetailId(null); setDetail(null); }}>Close</Button>
          </div>
          {detailLoading && <Skeleton variant="card" height="16rem" />}
          {!detailLoading && !detail && <p className="text-[var(--muted-fg)]">Could not load user detail.</p>}
          {detail && (
            <>
              <div className="admin-stat-grid" style={{ marginTop: 0, marginBottom: 18 }}>
                <StatCard label="Email" value={detail.user.email} />
                <StatCard label="Joined" value={new Date(detail.user.created_at).toLocaleDateString()} />
                <StatCard label="Premium" value={detail.user.premium_until && new Date(detail.user.premium_until) > new Date() ? `Until ${new Date(detail.user.premium_until).toLocaleDateString()}` : "Free"} accent={detail.user.premium_until && new Date(detail.user.premium_until) > new Date() ? "green" : undefined} />
                <StatCard label="Verified" value={detail.user.email_verified_at ? "Yes" : "No"} accent={detail.user.email_verified_at ? "green" : undefined} />
                <StatCard label="Credits" value={detail.user.credits} />
                <StatCard label="Source" value={detail.user.premium_source || "—"} />
              </div>
              {detail.resumes?.length > 0 && (
                <div className="admin-chart-card" style={{ marginBottom: 12 }}>
                  <h4 style={{ marginTop: 0, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Resumes ({detail.resumes.length})</h4>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Candidate</th><th>Headline</th><th>Company · Role</th><th className="num-col">ATS</th><th>Created</th></tr></thead>
                      <tbody>{detail.resumes.map((r: any) => (
                        <tr key={r.id}><td className="cell-main">{r.candidate_name || "—"}</td><td>{r.headline || "—"}</td><td>{[r.company_name, r.role_title].filter(Boolean).join(" · ") || "—"}</td><td className="num-col"><Badge variant={r.ats_score >= 70 ? "success" : "warning"}>{r.ats_score ?? "—"}</Badge></td><td>{new Date(r.created_at).toLocaleDateString()}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {detail.payments?.length > 0 && (
                <div className="admin-chart-card" style={{ marginBottom: 12 }}>
                  <h4 style={{ marginTop: 0, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Payments ({detail.payments.length})</h4>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Order</th><th>Plan</th><th>Status</th><th className="num-col">Amount</th><th>Created</th></tr></thead>
                      <tbody>{detail.payments.map((p: any) => (
                        <tr key={p.id}><td className="tabular">{p.order_id || "—"}</td><td>{p.plan || "monthly"}</td><td><Badge variant={p.status === "finished" || p.status === "confirmed" ? "success" : p.status === "waiting" ? "warning" : "default"}>{p.status}</Badge></td><td className="num-col tabular">${p.price_amount ?? 0} {(p.pay_currency || "").toUpperCase()}</td><td>{new Date(p.created_at).toLocaleDateString()}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {detail.creditEvents?.length > 0 && (
                <div className="admin-chart-card" style={{ marginBottom: 12 }}>
                  <h4 style={{ marginTop: 0, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Credit Events ({detail.creditEvents.length})</h4>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Kind</th><th className="num-col">Delta</th><th>Details</th><th>Created</th></tr></thead>
                      <tbody>{detail.creditEvents.map((e: any) => (
                        <tr key={e.delta + e.created_at}><td><Badge variant="warning">{e.kind}</Badge></td><td className="num-col">{e.delta > 0 ? `+${e.delta}` : e.delta}</td><td className="tabular" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.details ? String(e.details).slice(0, 80) : "—"}</td><td>{new Date(e.created_at).toLocaleDateString()}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {detail.applications?.length > 0 && (
                <div className="admin-chart-card" style={{ marginBottom: 12 }}>
                  <h4 style={{ marginTop: 0, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Applications ({detail.applications.length})</h4>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Created</th></tr></thead>
                      <tbody>{detail.applications.map((a: any) => (
                        <tr key={a.id}><td className="cell-main">{a.company}</td><td>{a.role}</td><td><Badge variant={a.status === "offer" ? "success" : a.status === "rejected" ? "default" : "warning"}>{a.status}</Badge></td><td>{new Date(a.created_at).toLocaleDateString()}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {detail.tickets?.length > 0 && (
                <div className="admin-chart-card" style={{ marginBottom: 12 }}>
                  <h4 style={{ marginTop: 0, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Support Tickets ({detail.tickets.length})</h4>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Subject</th><th>Status</th><th>Created</th></tr></thead>
                      <tbody>{detail.tickets.map((t: any) => (
                        <tr key={t.id}><td className="cell-main">{t.subject}</td><td><Badge variant={t.status === "open" ? "warning" : "success"}>{t.status}</Badge></td><td>{new Date(t.created_at).toLocaleDateString()}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {dialog}
    </div>
  );
}
