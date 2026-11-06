"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard, Toolbar } from "../admin-shared";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { fetchJson, useAdminQuery } from "../query-client";
import { DataTable, RowActions, type DataTableColumn } from "@/components/ui/admin/data-table";
import { Card, CardContent } from "@/components/ui/admin/card";
import { ConfirmActionDialog } from "@/components/ui/admin/confirm-action-dialog";

type JobListing = { id: string; provider?: string; title: string; company: string; country_code?: string; location?: string; is_remote?: boolean; job_type?: string; last_seen_at: string; expires_at: string; apply_url?: string };
type ProviderHealth = { provider: string; n: string; fresh24: string; last_seen: string | null };
type JobListResponse = { rows: JobListing[]; total: number; stats?: Record<string, number>; countries?: { code: string; n: number }[]; providerHealth?: ProviderHealth[]; profiles?: any[] };

const BOARD_LABELS: Record<string, string> = {
  indeed: "Indeed",
  linkedin: "LinkedIn",
  glassdoor: "Glassdoor",
  google: "Google Jobs",
  naukri: "Naukri",
  bayt: "Bayt",
  zip_recruiter: "ZipRecruiter",
  bdjobs: "Bdjobs",
  admin: "Admin Manual",
};

const FILTER_BOARDS = ["", "indeed", "linkedin", "glassdoor", "google", "naukri", "bayt", "zip_recruiter", "admin"] as const;

const EMPTY_LISTING = { title: "", company: "", country_code: "", location: "", job_type: "", is_remote: false, apply_url: "https://", salary_min: "", salary_max: "", salary_currency: "", description: "" };

export default function JobsAdminView({ canManage = false }: { canManage?: boolean }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [panel, setPanel] = useState<"none" | "quick" | "bulk">("none");
  const [quick, setQuick] = useState({ ...EMPTY_LISTING });
  const [bulkText, setBulkText] = useState("");
  const [pending, setPending] = useState<
    | { kind: "post"; body: Record<string, unknown>; label: string }
    | { kind: "delete"; id: string; title: string; label: string }
    | null
  >(null);
  const pageSize = 20;

  const { data, isPending, isError, error, refetch, isSuccess } = useAdminQuery<JobListResponse>(
    ["admin", "job-listings", query, country, provider, page],
    (signal) => fetchJson<JobListResponse>(`/api/admin/job-listings?q=${encodeURIComponent(query)}&country=${encodeURIComponent(country)}&provider=${encodeURIComponent(provider)}&page=${page}&pageSize=${pageSize}`, { signal }),
  );

  const rows = data?.rows ?? undefined;
  const total = data?.total ?? 0;
  const st = data?.stats || {};
  const tableStatus = isError ? "error" : isPending ? "loading" : "success";

  const columns: DataTableColumn<JobListing>[] = [
    { id: "title", header: "Title", className: "cell-main", cell: (j) => j.title },
    { id: "company", header: "Company", cell: (j) => j.company },
    { id: "source", header: "Source", cell: (j) => <Badge variant={j.provider === "admin" ? "warning" : "default"}>{BOARD_LABELS[j.provider ?? ""] ?? j.provider ?? "—"}</Badge> },
    { id: "where", header: "Where", cell: (j) => `${j.country_code?.toUpperCase() ?? ""}${j.location ? ` · ${j.location}` : ""}${j.is_remote ? " · remote" : ""}` },
    { id: "type", header: "Type", cell: (j) => j.job_type || "—" },
    { id: "last_seen", header: "Last seen", cell: (j) => new Date(j.last_seen_at).toLocaleDateString() },
    { id: "expires", header: "Expires", cell: (j) => new Date(j.expires_at).toLocaleDateString() },
  ];

  async function post(body: Record<string, unknown>) {
    setBusy(JSON.stringify(body)); setMsg(null);
    try {
      const r = await fetch("/api/admin/job-listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const m: string = j.error || "Action failed."; setMsg({ error: m }); toast.error(m); return false; }
      const ok = body.action === "purgeExpired" ? `Removed ${j.removed} expired listings.`
        : body.action === "quickAdd" ? `Added "${(body.listing as any)?.title ?? "listing"}".`
        : body.action === "bulkImport" ? `Imported ${j.inserted} listings (${j.skipped} skipped).`
        : "Done.";
      setMsg({ ok }); toast.success(ok);
      void refetch();
      return true;
    } catch { const m = "Network error."; setMsg({ error: m }); toast.error(m); return false; }
    finally { setBusy(""); }
  }

  async function delListing(id: string, title: string) {
    setBusy(id); setMsg(null);
    try {
      const r = await fetch(`/api/admin/job-listings?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const m: string = j.error || "Could not delete the listing."; setMsg({ error: m }); toast.error(m); return; }
      const ok = `Deleted "${title}".`;
      setMsg({ ok }); toast.success(ok);
      await refetch();
    } catch { const m = "Network error. The listing was not confirmed deleted."; setMsg({ error: m }); toast.error(m); }
    finally { setBusy(""); }
  }

  async function submitQuick() {
    const listing = {
      title: quick.title.trim(),
      company: quick.company.trim(),
      country_code: quick.country_code.trim().toLowerCase(),
      location: quick.location.trim() || undefined,
      job_type: quick.job_type.trim() || undefined,
      is_remote: quick.is_remote,
      apply_url: quick.apply_url.trim(),
      salary_min: quick.salary_min ? Number(quick.salary_min) : undefined,
      salary_max: quick.salary_max ? Number(quick.salary_max) : undefined,
      salary_currency: quick.salary_currency.trim() || undefined,
      description: quick.description.trim() || undefined,
    };
    const ok = await post({ action: "quickAdd", listing });
    if (ok) { setQuick({ ...EMPTY_LISTING }); setPanel("none"); }
  }

  async function submitBulk() {
    let listings: unknown;
    try {
      listings = JSON.parse(bulkText);
    } catch {
      setMsg({ error: "That is not valid JSON." }); toast.error("That is not valid JSON.");
      return;
    }
    if (!Array.isArray(listings)) {
      setMsg({ error: "Paste a JSON array of listing objects." }); toast.error("Paste a JSON array of listing objects.");
      return;
    }
    const ok = await post({ action: "bulkImport", listings });
    if (ok) { setBulkText(""); setPanel("none"); }
  }

  const health = data?.providerHealth ?? [];

  return (
    <>
      <PageHeader title="Job Listings" desc="The live job search index: listings, multi-board source health, country coverage, and ingestion profiles." onRefresh={() => refetch()} />
      <div className="admin-stat-grid">
        <StatCard label="Total listings" value={Number(st.total || 0).toLocaleString()} />
        <StatCard label="Seen in 24h" value={Number(st.fresh24 || 0).toLocaleString()} accent="green" />
        <StatCard label="Expiring in 7d" value={Number(st.expiring7 || 0).toLocaleString()} accent={Number(st.expiring7) > 0 ? "amber" : undefined} />
        <StatCard label="Remote" value={Number(st.remote || 0).toLocaleString()} />
      </div>

      {/* Multi-Board Source Health & Filter Bar */}
      <div className="admin-chart-card" style={{ marginTop: 14 }}>
        <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Source health</h3>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" size="compact" disabled={!!busy} onClick={() => setPanel(panel === "quick" ? "none" : "quick")}>＋ Quick add</Button>
              <Button variant="outline" size="compact" disabled={!!busy} onClick={() => setPanel(panel === "bulk" ? "none" : "bulk")}>⬆ Bulk JSON import</Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter listings by source board">
          {FILTER_BOARDS.map((board) => {
            const active = provider === board;
            const stat = board ? health.find((h) => h.provider === board) : undefined;
            const count = board ? Number(stat?.n ?? 0) : Number(st.total || 0);
            return (
              <button
                key={board || "all"}
                type="button"
                onClick={() => { setProvider(board); setPage(1); }}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-[#0071E3] bg-[#0071E3]/10 text-[#0066CC] dark:text-[#5AC8FA]"
                    : "border-[var(--border)] text-[var(--muted-fg)] hover:text-[var(--fg)]"
                }`}
              >
                {board ? (BOARD_LABELS[board] ?? board) : "All boards"}
                <span className={`rounded-full px-1.5 py-[2px] text-[10px] font-bold ${active ? "bg-[#0071E3]/15" : "bg-black/[0.06] dark:bg-white/[0.1]"}`}>
                  {count.toLocaleString()}
                </span>
                {stat && Number(stat.fresh24) === 0 && <span title="Nothing fresh from this board in 24h">⚠</span>}
              </button>
            );
          })}
        </div>
        {health.length > 0 && (
          <p className="mt-2 text-[12px] text-[var(--muted-fg)]">
            {health
              .slice(0, 8)
              .map((h) => `${BOARD_LABELS[h.provider] ?? h.provider}: ${Number(h.n).toLocaleString()} (${h.fresh24} fresh${h.last_seen ? `, last ${new Date(h.last_seen).toLocaleDateString()}` : ""})`)
              .join(" · ")}
          </p>
        )}
      </div>

      {panel === "quick" && canManage && (
        <Card>
          <CardContent>
            <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Quick add listing</h3>
            <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 10 }}>Stored under source &ldquo;Admin Manual&rdquo; with a 30-day expiry. Apply URLs must be https.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {([
                ["title", "Job title *"], ["company", "Company *"], ["country_code", "Country code * (e.g. us)"],
                ["location", "Location"], ["job_type", "Job type"], ["apply_url", "Apply URL (https) *"],
                ["salary_min", "Salary min"], ["salary_max", "Salary max"], ["salary_currency", "Currency (e.g. USD)"],
              ] as const).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--muted-fg)]">{label}</span>
                  <input
                    value={String(quick[key] ?? "")}
                    onChange={(e) => setQuick((q) => ({ ...q, [key]: e.target.value }))}
                    className="admin-table-search w-full"
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 self-end pb-1 text-xs font-semibold text-[var(--muted-fg)]">
                <input type="checkbox" checked={quick.is_remote} onChange={(e) => setQuick((q) => ({ ...q, is_remote: e.target.checked }))} />
                Remote
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="compact" disabled={!!busy || !quick.title.trim() || !quick.company.trim() || quick.country_code.trim().length !== 2 || !quick.apply_url.startsWith("https://")} onClick={() => void submitQuick()}>Add listing</Button>
              <Button variant="ghost" size="compact" onClick={() => { setPanel("none"); setQuick({ ...EMPTY_LISTING }); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {panel === "bulk" && canManage && (
        <Card>
          <CardContent>
            <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Bulk JSON import</h3>
            <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 10 }}>
              Paste a JSON array (max 200) of objects: <code>{"{ title, company, country_code, apply_url, location?, job_type?, is_remote?, salary_min?, salary_max?, salary_currency?, description? }"}</code>. Invalid rows are skipped with reasons.
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={8}
              aria-label="Bulk import JSON"
              className="admin-table-search w-full font-[family-name:var(--font-mono)] text-xs"
              placeholder='[{"title":"Backend Engineer","company":"Acme","country_code":"us","apply_url":"https://acme.com/careers/1"}]'
            />
            <div className="mt-3 flex gap-2">
              <Button size="compact" disabled={!!busy || !bulkText.trim()} onClick={() => void submitBulk()}>Import listings</Button>
              <Button variant="ghost" size="compact" onClick={() => { setPanel("none"); setBulkText(""); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Toolbar placeholder="Search title or company..." onSearch={(value) => { setQuery(value); setPage(1); }}>
            <select className="admin-table-filter" value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }} aria-label="Filter by country">
              <option value="">All countries</option>
              {(data?.countries || []).map((c: any) => <option key={c.code} value={c.code}>{c.code.toUpperCase()} ({Number(c.n).toLocaleString()})</option>)}
            </select>
            <select className="admin-table-filter" value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} aria-label="Filter by source board">
              {FILTER_BOARDS.map((board) => <option key={board || "all"} value={board}>{board ? (BOARD_LABELS[board] ?? board) : "All boards"}</option>)}
            </select>
            {canManage && <Button variant="outline" size="compact" disabled={!!busy} onClick={() => setPending({ kind: "post", body: { action: "purgeExpired" }, label: "Delete all listings past their expiry date?" })}>Purge expired</Button>}
          </Toolbar>
          {msg?.ok && <Notice variant="success" role="status">{msg.ok}</Notice>}
          {msg?.error && <Notice variant="danger" role="alert">{msg.error}</Notice>}
          <DataTable
            columns={columns}
            data={rows}
            status={tableStatus}
            error={error?.message}
            onRetry={() => refetch()}
            rowKey={(j) => j.id}
            skeletonRows={Math.min(pageSize, 8)}
            empty={{ title: "No listings match", description: "Try a different search term, country, or board." }}
            rowActions={(j) => (
              <RowActions>
                <Button as="a" variant="outline" size="compact" href={j.apply_url} target="_blank" rel="noopener noreferrer">Open</Button>
                {canManage && <Button variant="danger" size="compact" disabled={busy === j.id} onClick={() => setPending({ kind: "delete", id: j.id, title: j.title, label: `Delete listing "${j.title}"?` })}>Delete</Button>}
              </RowActions>
            )}
            pagination={isSuccess ? { page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total, onPage: setPage } : undefined}
          />
        </CardContent>
      </Card>
      <div className="admin-chart-card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700 }}>Ingestion profiles</h3>
        <p className="text-[13px] text-[var(--muted-fg)]" style={{ marginBottom: 12 }}>What the job worker fetches, how often, and whether it&apos;s healthy. &quot;Run now&quot; schedules the next cycle immediately. Profiles set to &ldquo;auto&rdquo; route each country to its highest-volume boards.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Profile</th><th>Every</th><th>Next run</th><th>Last success</th><th>Health</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.profiles || []).map((p: any) => (
                <tr key={p.id}>
                  <td className="cell-main">{p.country_code?.toUpperCase()} · {p.search_term}</td>
                  <td>{p.refresh_hours}h</td>
                  <td>{p.next_run_at ? new Date(p.next_run_at).toLocaleString() : "—"}</td>
                  <td>{p.last_success_at ? new Date(p.last_success_at).toLocaleString() : <span className="text-[var(--muted-fg)]">never</span>}</td>
                  <td>
                    {p.consecutive_failures > 0
                      ? <Badge variant="warning" title={p.last_error || ""}>{p.consecutive_failures} fails</Badge>
                      : <Badge variant="success">OK</Badge>}
                  </td>
                  <td>
        <div className="admin-row-actions">
          {canManage ? <>
          <Button variant={p.enabled ? "primary" : "outline"} size="compact" disabled={!!busy} onClick={() => setPending({ kind: "post", body: { action: "toggleProfile", id: p.id }, label: `${p.enabled ? "Disable" : "Enable"} the ${p.country_code?.toUpperCase()} · ${p.search_term} ingestion profile? This changes scheduled collection immediately.` })}>{p.enabled ? "Enabled" : "Disabled"}</Button>
          <Button variant="outline" size="compact" disabled={!!busy || !p.enabled} onClick={() => setPending({ kind: "post", body: { action: "runProfile", id: p.id }, label: `Schedule ${p.country_code?.toUpperCase()} · ${p.search_term} to run now?` })}>Run now</Button>
          </> : <span className="text-[13px] text-[var(--muted-fg)]">Read only</span>}
        </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmActionDialog
        open={!!pending}
        title={pending?.kind === "delete" ? "Delete listing" : "Confirm job-listing action"}
        description={pending?.label}
        confirmLabel={pending?.kind === "delete" ? "Delete listing" : "Confirm"}
        busy={!!pending && busy !== ""}
        onConfirm={async () => { const p = pending; if (!p) { setPending(null); return; } if (p.kind === "post") await post(p.body); else await delListing(p.id, p.title); setPending(null); }}
        onClose={() => setPending(null)}
      />
    </>
  );
}
