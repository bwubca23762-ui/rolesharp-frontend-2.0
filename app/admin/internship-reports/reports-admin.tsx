"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Shield, Trash } from "@/app/icons";
import { Badge, Button } from "@/components/ui/primitives";
import { useAdminConfirm } from "../confirm-dialog";
import { useAdminRefreshSignal } from "../admin-shared";
import Skeleton from "@/components/ui/Skeleton";
import { adminFetchJson } from "../admin-helpers";

type Evidence = { id: string; fileName: string; contentType: string; sizeBytes: number };
type ReportRow = {
  id: string;
  company: string;
  location: string;
  platform: string | null;
  risk: string;
  categories: string[];
  description: string;
  source_url: string | null;
  status: "pending" | "approved" | "rejected";
  moderation_note: string | null;
  reporter_email: string;
  evidence: Evidence[];
  comments: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
};

export default function InternshipReportsAdmin({ canManage = false }: { canManage?: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState("");
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
    if (query.trim()) params.set("q", query.trim());
    try {
      const result = await adminFetchJson<{ rows: ReportRow[]; stats: Record<string, number>; total: number }>(`/api/admin/internship-reports?${params}`, { cache: "no-store" });
      if (!result.ok || !result.data) throw new Error(result.error || "load_failed");
      const data = result.data;
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setNotes((current) => Object.fromEntries((Array.isArray(data.rows) ? data.rows : []).map((row: ReportRow) => [row.id, current[row.id] ?? row.moderation_note ?? ""])));
      setStats(data.stats || {});
      setTotal(Number(data.total || 0));
    } catch {
      setMessage("Could not load internship reports.");
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useAdminRefreshSignal(load);

  useEffect(() => { void load(); }, [load]);

  function moderate(row: ReportRow, nextStatus: "approved" | "rejected" | "pending") {
    const note = notes[row.id]?.trim() || "";
    if (nextStatus === "rejected" && !note) {
      setMessage("Add an internal moderation note before rejecting a report.");
      return;
    }
    const actionLabel = nextStatus === "approved" ? "publish" : nextStatus === "rejected" ? "reject" : "return to the private review queue";
    ask({
      title: `${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} report`,
      body: `This ${actionLabel} the report about ${row.company}.`,
      word: nextStatus === "approved" ? "PUBLISH" : nextStatus === "rejected" ? "REJECT" : "RETURN",
      run: async () => {
        setBusy(row.id);
        setMessage("");
        try {
          const result = await adminFetchJson("/api/admin/internship-reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, status: nextStatus, moderationNote: note }) });
          if (!result.ok) throw new Error(result.error);
          await load();
          setMessage(`Report ${nextStatus}.`);
        } catch (error) {
          setMessage("Moderation action failed.");
          throw error;
        } finally {
          setBusy("");
        }
      },
    });
  }

  function remove(row: ReportRow) {
    ask({
      title: "Delete report",
      body: `Permanently delete the report about ${row.company}? Evidence, comments, and votes will also be removed.`,
      word: "DELETE",
      run: async () => {
        setBusy(row.id);
        try {
          const result = await adminFetchJson(`/api/admin/internship-reports?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
          if (!result.ok) throw new Error(result.error);
          await load();
          setMessage("Report permanently deleted.");
        } catch (error) {
          setMessage("Delete failed.");
          throw error;
        } finally {
          setBusy("");
        }
      },
    });
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
  return (
    <>
      <div className="admin-page-head">
        <div><div className="page-kicker">Community safety</div><h1>Internship reports</h1><p className="mt-1! mb-0! text-[14px] text-[var(--muted-fg)]">Review allegations and private evidence before anything reaches the public board.</p></div>
        <button className="admin-refresh-btn" type="button" onClick={() => void load()}><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="admin-stat-grid">
        {(["pending", "approved", "rejected", "total"] as const).map((key) => <div className="admin-stat-card" key={key}><div className="admin-stat-label">{key}</div><div className="admin-stat-value">{stats[key] ?? 0}</div></div>)}
      </div>

      <div className="admin-table-toolbar" style={{ marginTop: 20 }}>
        <input className="admin-table-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search company, location, or reporter" />
        <select className="admin-table-search" aria-label="Report status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} style={{ maxWidth: 190 }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All statuses</option></select>
      </div>

      {message && <div className="admin-ops-banner" role="status" style={{ marginTop: 14 }}><span className="admin-ops-signal" /><div><b>{message}</b></div></div>}
      {loading ? (
        <div className="grid gap-3" style={{ padding: "24px 0" }} aria-busy="true">
          <Skeleton variant="card" height="8rem" />
          <Skeleton variant="card" height="8rem" />
          <Skeleton variant="card" height="8rem" />
        </div>
      ) : rows.length === 0 ? <div className="admin-chart-card" style={{ marginTop: 16, textAlign: "center", padding: 50 }}><Shield size={28} /><h3>No {status === "all" ? "" : status} reports</h3><p className="text-[var(--muted-fg)]">The moderation queue is clear for this filter.</p></div> : <div className="mt-4 grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <nav className="rsx-card grid gap-2 p-3" aria-label="Reports awaiting review">
          {rows.map((row) => <button key={row.id} type="button" aria-current={selected?.id === row.id ? "true" : undefined} className={`rounded-lg border p-3 text-left transition-colors ${selected?.id === row.id ? "border-admin-primary bg-admin-primary/10" : "border-admin-border hover:bg-admin-muted"}`} onClick={() => setSelectedId(row.id)}><strong className="block">{row.company}</strong><span className="block text-xs text-admin-muted-fg">{row.location} · {row.status}</span><span className="mt-1 block text-xs">{row.evidence.length} evidence file(s) · {row.risk} risk</span></button>)}
        </nav>
        {(selected ? [selected] : []).map((row) => <article className="admin-chart-card min-w-0" key={row.id} style={{ padding: 20 }}>
          <div className="row" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}><div><div className="row" style={{ gap: 8, flexWrap: "wrap" }}><h3 style={{ margin: 0 }}>{row.company}</h3><Badge variant={row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"}>{row.status}</Badge><Badge variant={row.risk === "high" ? "danger" : "warning"}>{row.risk}</Badge></div><p className="text-[13px] text-[var(--muted-fg)]" style={{ marginTop: 5 }}>{row.location}{row.platform ? ` · ${row.platform}` : ""} · {new Date(row.created_at).toLocaleString()}</p></div>{canManage && <div className="row" style={{ gap: 6 }}><Button disabled={busy === row.id} isLoading={busy === row.id} size="compact" onClick={() => void moderate(row, "approved")}>Approve</Button><Button disabled={busy === row.id} isLoading={busy === row.id} variant="outline" size="compact" onClick={() => void moderate(row, "rejected")}>Reject</Button>{row.status !== "pending" && <Button disabled={busy === row.id} isLoading={busy === row.id} variant="outline" size="compact" onClick={() => void moderate(row, "pending")}>Return to queue</Button>}<Button disabled={busy === row.id} isLoading={busy === row.id} variant="danger" size="compact" aria-label={`Delete report about ${row.company}`} onClick={() => void remove(row)}><Trash size={15} /></Button></div>}</div>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{row.description}</p>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{row.categories.map((category) => <Badge key={category}>{category}</Badge>)}</div>
          <div className="admin-data-row" style={{ marginTop: 14 }}><span>Reporter</span><b>{row.reporter_email}</b></div>
          <div className="admin-data-row"><span>Community activity</span><span>{row.upvotes} helpful · {row.downvotes} not useful · {row.comments} comments</span></div>
          {row.source_url && <div className="admin-data-row"><span>Submitted source</span><a href={row.source_url} target="_blank" rel="noopener noreferrer">Open cautiously ↗</a></div>}
          <div className="admin-data-row"><span>Private evidence</span><span>{row.evidence.length ? row.evidence.map((file, index) => <span key={file.id}>{index ? " · " : ""}<a href={`/api/admin/internship-reports/${row.id}/evidence/${file.id}`}>{file.fileName} ({Math.ceil(file.sizeBytes / 1024)} KB)</a></span>) : "No files"}</span></div>
          <label className="admin-data-row" style={{ alignItems: "flex-start" }}><span>Internal moderation note</span><textarea disabled={!canManage} value={notes[row.id] ?? ""} onChange={(event) => setNotes((values) => ({ ...values, [row.id]: event.target.value }))} maxLength={1000} rows={2} placeholder="Required for rejection; never shown publicly" style={{ width: "min(100%, 560px)", resize: "vertical" }} /></label>
        </article>)}
      </div>}

      {pages > 1 && <div className="admin-pagination"><span className="text-[13px] text-[var(--muted-fg)]">{total} reports · page {page}/{pages}</span><div className="row" style={{ gap: 8 }}><Button variant="outline" size="compact" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Previous</Button><Button variant="outline" size="compact" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next →</Button></div></div>}
      {dialog}
    </>
  );
}
