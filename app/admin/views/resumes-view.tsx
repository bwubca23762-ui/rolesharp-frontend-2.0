"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminStats as S } from "../admin-types";
import { DataRow, PageHeader, Toolbar } from "../admin-shared";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import AccessibleDialog from "@/components/ui/AccessibleDialog";
import { fetchJson, useAdminQuery } from "../query-client";
import { DataTable, RowActions, type DataTableColumn } from "@/components/ui/admin/data-table";
import { Card, CardContent } from "@/components/ui/admin/card";
import { ConfirmActionDialog } from "@/components/ui/admin/confirm-action-dialog";
import { adminFetchJson } from "../admin-helpers";

function formatMs(value: number) {
  if (!value) return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

type ResumeRow = { id: string; candidate_name?: string; has_jd?: boolean; email?: string; company?: string; role?: string; ats_score?: number; gen_ms?: number; created_at: string };
type ResumeListResponse = { rows: ResumeRow[]; total: number };

export default function ResumesView({ s, onRefresh, canManage = false }: { s: S; onRefresh: () => void; canManage?: boolean }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [inspectorTab, setInspectorTab] = useState<"preview" | "diagnostics" | "json">("preview");
  const [openingId, setOpeningId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const pageSize = 20;

  const { data, isPending, isError, error, refetch, isSuccess } = useAdminQuery<ResumeListResponse>(
    ["admin", "resumes", query, page],
    (signal) => fetchJson<ResumeListResponse>(`/api/admin/resumes?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`, { signal }),
    { refetchInterval: 60_000 },
  );

  const rows = data?.rows ?? undefined;
  const total = data?.total ?? 0;
  const tableStatus = isError ? "error" : isPending ? "loading" : "success";

  const columns: DataTableColumn<ResumeRow>[] = [
    { id: "candidate", header: "Candidate", className: "cell-main", cell: (r) => <>{r.candidate_name || "—"}{r.has_jd && <span className="text-[13px] text-[var(--muted-fg)]" style={{ display: "block" }}>JD-tailored</span>}</> },
    { id: "owner", header: "Owner", cell: (r) => r.email || <span className="text-[var(--muted-fg)]">guest</span> },
    { id: "company_role", header: "Company · Role", cell: (r) => [r.company, r.role].filter(Boolean).join(" · ") || "—" },
    { id: "ats", header: "ATS", align: "right", className: "num-col", cell: (r) => <Badge variant={(r.ats_score ?? 0) >= 70 ? "success" : "warning"}>{r.ats_score ?? "—"}</Badge> },
    { id: "speed", header: "Speed", align: "right", className: "num-col tabular", cell: (r) => formatMs(r.gen_ms ?? 0) },
    { id: "created", header: "Created", cell: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  async function del(id: string, name: string) {
    setBusyId(id); setMessage(null);
    try {
      const r = await fetch(`/api/admin/resumes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) { const m: string = payload.error || "Could not delete the resume."; setMessage({ error: m }); toast.error(m); return; }
      const ok = `Deleted resume "${name || id}".`;
      setMessage({ ok }); toast.success(ok);
      await refetch();
    } catch { const m = "Network error. The resume was not confirmed deleted."; setMessage({ error: m }); toast.error(m); }
    finally { setBusyId(""); }
  }

  async function inspect(id: string) {
    setOpeningId(id);
    setMessage(null);
    const result = await adminFetchJson(`/api/admin/resume-detail?id=${encodeURIComponent(id)}`);
    if (result.ok && result.data) { setDetail(result.data); setInspectorTab("preview"); }
    else setMessage({ error: result.error || "Could not load resume detail." });
    setOpeningId("");
  }

  return (
    <>
      <PageHeader title="Resumes" desc="Every generated resume — searchable by candidate, owner email, company, or role." onRefresh={() => { void refetch(); onRefresh(); }} />
      {message?.ok && <Notice variant="success" role="status">{message.ok}</Notice>}
      {message?.error && <Notice variant="danger" role="alert">{message.error}</Notice>}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="admin-chart-card">
          <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Top roles</h3>
          {s.topRoles.length === 0 && <p className="text-[var(--muted-fg)]">No data yet.</p>}
          {s.topRoles.map((r, i) => <DataRow key={i} left={r.title} right={<b>{r.n}</b>} />)}
        </div>
        <div className="admin-chart-card">
          <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Top companies</h3>
          {s.topCompanies.length === 0 && <p className="text-[var(--muted-fg)]">No data yet.</p>}
          {s.topCompanies.map((c, i) => <DataRow key={i} left={c.name} right={<b>{c.n}</b>} />)}
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Toolbar placeholder="Search candidate, email, company, role..." onSearch={(value) => { setQuery(value); setPage(1); }} />
          <DataTable
            columns={columns}
            data={rows}
            status={tableStatus}
            error={error?.message}
            onRetry={() => refetch()}
            rowKey={(row) => row.id}
            skeletonRows={Math.min(pageSize, 8)}
            empty={{ title: "No resumes match", description: "Try a different search term." }}
            rowActions={(r) => (
              <RowActions>
                <Button variant="outline" size="compact" type="button" disabled={Boolean(openingId)} isLoading={openingId === r.id} onClick={() => void inspect(r.id)}>Inspect</Button>
                {canManage && <Button variant="danger" size="compact" type="button" disabled={busyId === r.id} isLoading={busyId === r.id} onClick={() => setPendingDelete({ id: r.id, name: r.candidate_name ?? "" })}>{busyId === r.id ? "Deleting..." : "Delete"}</Button>}
              </RowActions>
            )}
            pagination={isSuccess ? { page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total, onPage: setPage } : undefined}
          />
        </CardContent>
      </Card>
      {detail && (
        <AccessibleDialog placement="right" label={`Resume detail for ${detail.candidateName || "candidate"}`} onClose={() => setDetail(null)}>
          <div className="p-5 sm:p-8" style={{ width: "100%", minWidth: 0 }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:16}}>
              <div>
                <h3 style={{margin:0}}>{detail.candidateName || "Resume"}</h3>
                <p className="text-[var(--muted-fg)]" style={{margin:"4px 0 0"}}>{[detail.companyName, detail.roleTitle].filter(Boolean).join(" · ") || detail.headline}</p>
              </div>
              <Button variant="outline" size="compact" type="button" onClick={()=>setDetail(null)}>Close</Button>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              <Badge variant={detail.atsScore >= 70 ? "success" : "warning"}>ATS {detail.atsScore}</Badge>
              <Badge variant="premium">{detail.template}</Badge>
              <Badge variant="default">{formatMs(detail.genMs)}</Badge>
              <Badge>{detail.created}</Badge>
            </div>
            <div className="mb-4 flex flex-wrap gap-2" aria-label="Resume inspector views">
              {(["preview", "diagnostics", "json"] as const).map((tab) => <Button key={tab} variant={inspectorTab === tab ? "primary" : "outline"} size="compact" aria-pressed={inspectorTab === tab} onClick={() => setInspectorTab(tab)}>{tab === "preview" ? "Preview" : tab === "diagnostics" ? "ATS diagnostics" : "Raw JSON"}</Button>)}
            </div>
            <div className="mb-5 flex flex-wrap gap-2">{["pdf", "docx", "txt"].map((format) => <Button key={format} as="a" variant="outline" size="compact" href={`/api/admin/resume-detail?id=${encodeURIComponent(detail.id)}&format=${format}`}>Download {format.toUpperCase()}</Button>)}</div>
            {inspectorTab === "json" && <pre className="max-h-[50vh] overflow-auto rounded-lg bg-black/10 p-4 text-xs">{JSON.stringify(detail.content, null, 2)}</pre>}
            {inspectorTab === "diagnostics" && <div className="space-y-4">{detail.diagnostics ? <>
              <p className="text-sm">Recomputed against the saved job description; the original score remains unchanged.</p>
              <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-[var(--border)] p-4"><b className="block text-2xl">{detail.diagnostics.score}/100</b><span className="text-sm">Current ATS score</span></div><div className="rounded-lg border border-[var(--border)] p-4"><b className="block text-2xl">{detail.diagnostics.quantifiedBullets}/{detail.diagnostics.totalBullets}</b><span className="text-sm">Bullets with measurable evidence</span></div></div>
              <p>{detail.diagnostics.tip}</p>
              <h4 className="font-semibold">Missing supported keywords</h4><p>{detail.diagnostics.missingKeywords?.join(", ") || "No keyword gaps identified."}</p>
              <h4 className="font-semibold">Evidence to review</h4><ul className="list-disc space-y-2 pl-5">{detail.diagnostics.evidencePrompts?.map((prompt: string) => <li key={prompt}>{prompt}</li>)}</ul>
            </> : <p>This saved resume cannot be scored with the current schema.</p>}</div>}
            {inspectorTab === "preview" && detail.content && (
              <div style={{display:"grid",gap:16}}>
                {detail.content.summary && <div><h4 style={{margin:"0 0 6px"}}>Summary</h4><p className="text-[var(--muted-fg)]" style={{margin:0}}>{detail.content.summary}</p></div>}
                {detail.content.skills?.length > 0 && <div><h4 style={{margin:"0 0 6px"}}>Skills</h4><div className="chip-row">{(detail.content.skills||[]).map((s:string)=><span className="skill-chip" key={s}>{s}</span>)}</div></div>}
                {(detail.content.experiences||[]).length > 0 && <div><h4 style={{margin:"0 0 6px"}}>Experience</h4>{detail.content.experiences.map((e:any,i:number)=><div key={i} style={{marginBottom:12,border:"1px solid var(--border)",borderRadius:8,padding:12}}><b>{e.title}{e.company?` · ${e.company}`:""}</b>{e.period&&<span className="text-[13px] text-[var(--muted-fg)]" style={{marginLeft:8}}>{e.period}</span>}<ul style={{margin:"8px 0 0",paddingLeft:18,fontSize:13}}>{(e.bullets||[]).map((b:string,j:number)=><li key={j}>{b}</li>)}</ul></div>)}</div>}
                {(detail.content.education||[]).length > 0 && <div><h4 style={{margin:"0 0 6px"}}>Education</h4>{detail.content.education.map((e:any,i:number)=><p className="text-[var(--muted-fg)]" key={i} style={{margin:0}}>{e.degree}{e.school?` — ${e.school}`:""}{e.year?` (${e.year})`:""}</p>)}</div>}
                {(detail.content.projects||[]).length > 0 && <div><h4 style={{margin:"0 0 6px"}}>Projects</h4>{detail.content.projects.map((p:any,i:number)=><p className="text-[var(--muted-fg)]" key={i} style={{margin:0}}><b>{p.name}</b>{p.detail?`: ${p.detail}`:""}</p>)}</div>}
              </div>
            )}
          </div>
        </AccessibleDialog>
      )}
      <ConfirmActionDialog
        open={!!pendingDelete}
        title="Delete resume"
        description={pendingDelete ? `Delete resume "${pendingDelete.name || pendingDelete.id}"? This cannot be undone.` : ""}
        confirmLabel="Delete resume"
        busy={!!pendingDelete && busyId === pendingDelete.id}
        // Async: the dialog stays open with its busy state until del settles.
        onConfirm={async () => { const p = pendingDelete; if (p) await del(p.id, p.name); setPendingDelete(null); }}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
