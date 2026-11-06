"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, ChevronDown, MessageSquare, Shield, Upload, X } from "@/app/icons";
import { Button } from "@/components/ui/primitives/Button";
import { Container } from "@/components/ui/primitives/Container";
import { useToast } from "@/components/ui/Toast";
import { useSession, type SessionData } from "@/app/session-context";

const RISKS = [
  { value: "high", label: "High reported risk", style: "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300" },
  { value: "suspicious", label: "Suspicious", style: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300" },
  { value: "unconfirmed", label: "Unconfirmed", style: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" },
] as const;
const CATEGORIES = ["Fake offer letter", "Upfront payment", "Identity or data theft", "Unpaid or ghosted", "Training fee scam"] as const;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

type Report = {
  id: string;
  company: string;
  location: string;
  platform: string | null;
  risk: string;
  categories: string[];
  description: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  comments: number;
  my_vote: number | null;
};
type Comment = { id: string; body: string; author: string; created_at: string };
type Evidence = { name: string; type: string; data: string; size: number };

function ago(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(time));
}

function errorMessage(code: string) {
  const messages: Record<string, string> = {
    login_required: "Log in before using this community feature.",
    verified_email_required: "Verify your email before posting, voting, or commenting.",
    payload_too_large: "The evidence files are too large.",
    invalid_source_url: "Use a complete http:// or https:// source link.",
    invalid_evidence_file: "One evidence file does not match its stated file type.",
    evidence_total_too_large: "Evidence must be 2 MB or less in total.",
    too_many_reports: "Too many reports were submitted. Please try later.",
  };
  return messages[code] || "The request could not be completed. Please try again.";
}

export default function InternshipReportsBoard() {
  const { toast } = useToast();
  const { session: me } = useSession();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(false);
  const pageSize = 12;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (query.trim()) params.set("q", query.trim());
    if (risk) params.set("risk", risk);
    if (category) params.set("category", category);
    try {
      const response = await fetch(`/api/internship-reports?${params}`, { cache: "no-store" });
      const data = await response.json();
      setReports(Array.isArray(data.reports) ? data.reports : []);
      setTotal(Number(data.total || 0));
    } catch {
      setReports([]);
      toast("Could not load community reports.", "error");
    } finally {
      setLoading(false);
    }
  }, [category, page, query, risk, toast]);

  useEffect(() => { void load(); }, [load]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function startReport() {
    if (!me?.loggedIn) {
      window.location.href = "/login?next=%2Finternship-reports";
      return;
    }
    if (!me.emailVerified) {
      toast("Verify your email before submitting a report.", "error");
      return;
    }
    setReportOpen(true);
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(37,99,235,0.14),transparent_38%),radial-gradient(circle_at_85%_15%,rgba(245,158,11,0.12),transparent_35%)]" />
        <Container className="relative py-14 md:py-20">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]/80">
                <Shield size={15} /> Community safety
              </div>
              <h1 className="text-3xl font-extrabold leading-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)] sm:text-4xl md:text-5xl">
                Check the offer before you trust it.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] md:text-lg">
                Browse moderated community reports about suspicious internship offers, fees, fake documents, and requests for personal data. Reports are allegations—not verified legal findings.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button onClick={startReport} leftIcon={<Shield size={18} />}>Report a suspicious internship</Button>
                <Button as="a" href="/internships" variant="outline" leftIcon={<Briefcase size={18} />}>Find current internships</Button>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/90 p-5 shadow-[var(--shadow-md)] backdrop-blur dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]/90">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">Before applying</p>
              <ul className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                <li>• Never pay to receive an offer or interview.</li>
                <li>• Verify the sender on the company&apos;s official domain.</li>
                <li>• Do not send banking IDs or passwords over chat.</li>
                <li>• Contact local authorities if money or identity theft occurred.</li>
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-10 md:py-14">
        <div className="mb-7 grid gap-3 md:grid-cols-[minmax(0,1fr)_210px_230px]">
          <label className="sr-only" htmlFor="report-search">Search reports</label>
          <input id="report-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search company, location, or report details" className="min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]" />
          <FilterSelect label="Risk" value={risk} onChange={(value) => { setRisk(value); setPage(1); }} options={RISKS.map((item) => ({ value: item.value, label: item.label }))} />
          <FilterSelect label="Category" value={category} onChange={(value) => { setCategory(value); setPage(1); }} options={CATEGORIES.map((item) => ({ value: item, label: item }))} />
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">Moderated reports</p><h2 className="mt-1 text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{total.toLocaleString()} community report{total === 1 ? "" : "s"}</h2></div>
          <p className="max-w-lg text-right text-xs leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">RoleSharp reviews submissions for safety and relevance. Approval does not prove every claim.</p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2"><ReportSkeleton /><ReportSkeleton /></div>
        ) : reports.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {reports.map((report) => <ReportCard key={report.id} report={report} me={me} onChange={(next) => setReports((items) => items.map((item) => item.id === next.id ? next : item))} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]">
            <Shield size={32} /><h3 className="mt-4 text-lg font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">No matching approved reports</h3><p className="mt-2 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Try fewer filters. New submissions stay private until a moderator reviews them.</p>
          </div>
        )}

        {pages > 1 && <div className="mt-8 flex items-center justify-center gap-3"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Page {page} of {pages}</span><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div>}
      </Container>

      {reportOpen && <ReportDialog onClose={() => setReportOpen(false)} onSubmitted={() => { setReportOpen(false); toast("Report submitted privately for moderator review."); }} />}
    </>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="relative"><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 pr-10 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]"><option value="">All {label.toLowerCase()}{label === "Risk" ? " levels" : " options"}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="pointer-events-none absolute right-3 top-3.5"><ChevronDown size={18} /></span></label>;
}

function ReportSkeleton() {
  return <div className="h-64 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]" />;
}

function ReportCard({ report, me, onChange }: { report: Report; me: SessionData | null; onChange: (report: Report) => void }) {
  const { toast } = useToast();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const risk = RISKS.find((item) => item.value === report.risk) || RISKS[2];

  async function vote(value: 1 | -1) {
    if (!me?.loggedIn) { window.location.href = "/login?next=%2Finternship-reports"; return; }
    if (!me.emailVerified) { toast("Verify your email before voting.", "error"); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/internship-reports/${report.id}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vote: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onChange({ ...report, upvotes: data.upvotes, downvotes: data.downvotes, my_vote: data.myVote });
    } catch (error) { toast(errorMessage(error instanceof Error ? error.message : ""), "error"); } finally { setBusy(false); }
  }

  async function toggleComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments.length === 0) {
      const response = await fetch(`/api/internship-reports/${report.id}/comments`);
      const data = await response.json().catch(() => ({ comments: [] }));
      setComments(Array.isArray(data.comments) ? data.comments : []);
    }
  }

  async function postComment(event: React.FormEvent) {
    event.preventDefault();
    if (!me?.loggedIn) { window.location.href = "/login?next=%2Finternship-reports"; return; }
    if (!me.emailVerified) { toast("Verify your email before commenting.", "error"); return; }
    if (comment.trim().length < 2) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/internship-reports/${report.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: comment.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setComments((items) => [...items, data.comment]);
      setComment("");
      onChange({ ...report, comments: report.comments + 1 });
    } catch (error) { toast(errorMessage(error instanceof Error ? error.message : ""), "error"); } finally { setBusy(false); }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{report.company}</h3><p className="mt-1 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{report.location}{report.platform ? ` — Reported from ${report.platform}` : ""}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${risk.style}`}>{risk.label}</span></div>
        <div className="mt-4 flex flex-wrap gap-2">{report.categories.map((item) => <span key={item} className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-muted)] dark:bg-[var(--color-dark-surface-2)] dark:text-[var(--color-dark-text-muted)]">{item}</span>)}</div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{report.description}</p>
        <p className="mt-4 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Submitted {ago(report.created_at)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/60 px-4 py-3 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]/50">
        <button type="button" disabled={busy} aria-pressed={report.my_vote === 1} onClick={() => vote(1)} className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${report.my_vote === 1 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] dark:text-[var(--color-dark-text-muted)] dark:hover:bg-[var(--color-dark-surface)]"}`}>↑ Helpful {report.upvotes}</button>
        <button type="button" disabled={busy} aria-pressed={report.my_vote === -1} onClick={() => vote(-1)} className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${report.my_vote === -1 ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] dark:text-[var(--color-dark-text-muted)] dark:hover:bg-[var(--color-dark-surface)]"}`}>↓ Not useful {report.downvotes}</button>
        <button type="button" onClick={toggleComments} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] dark:text-[var(--color-dark-text-muted)] dark:hover:bg-[var(--color-dark-surface)]"><MessageSquare size={16} /> {report.comments}</button>
      </div>
      {commentsOpen && <div className="border-t border-[var(--color-border)] p-5 dark:border-[var(--color-dark-border)]"><div className="max-h-52 space-y-3 overflow-y-auto">{comments.length ? comments.map((item) => <div key={item.id} className="rounded-xl bg-[var(--color-surface-2)] p-3 text-sm dark:bg-[var(--color-dark-surface-2)]"><div className="flex justify-between gap-3 text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]"><span>{item.author}</span><span>{ago(item.created_at)}</span></div><p className="mt-1 whitespace-pre-wrap text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{item.body}</p></div>) : <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">No comments yet.</p>}</div><form onSubmit={postComment} className="mt-4 flex gap-2"><label className="sr-only" htmlFor={`comment-${report.id}`}>Add comment</label><input id={`comment-${report.id}`} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add context without sharing private information" className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]" /><Button size="sm" disabled={busy || comment.trim().length < 2} isLoading={busy}>Post</Button></form></div>}
    </article>
  );
}

function ReportDialog({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [form, setForm] = useState({ company: "", location: "", platform: "", risk: "", description: "", sourceUrl: "" });
  const [categories, setCategories] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const totalBytes = useMemo(() => evidence.reduce((sum, file) => sum + file.size, 0), [evidence]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", close); };
  }, [onClose]);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError("");
    const next = [...evidence];
    for (const file of Array.from(files)) {
      if (next.length >= 3) break;
      if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type)) { setError("Evidence must be PNG, JPEG, or PDF."); continue; }
      if (file.size > MAX_FILE_BYTES || next.reduce((sum, item) => sum + item.size, 0) + file.size > MAX_TOTAL_BYTES) { setError("Each file must be under 1 MB and all evidence under 2 MB."); continue; }
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
      next.push({ name: file.name, type: file.type, data, size: file.size });
    }
    setEvidence(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.risk || categories.length === 0) { setError("Choose a risk level and at least one category."); return; }
    if (form.description.trim().length < 40) { setError("Please describe what happened in at least 40 characters."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/internship-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, categories, evidence: evidence.map(({ name, type, data }) => ({ name, type, data })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onSubmitted();
    } catch (failure) { setError(errorMessage(failure instanceof Error ? failure.message : "")); } finally { setBusy(false); }
  }

  const input = "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]";
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]"><div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]"><div><h2 id="report-dialog-title" className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Report a suspicious internship</h2><p className="mt-1 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Your account and evidence are visible only to moderators.</p></div><button type="button" onClick={onClose} aria-label="Close report form" className="rounded-lg p-2 hover:bg-[var(--color-surface-2)] dark:hover:bg-[var(--color-dark-surface-2)]"><X size={20} /></button></div><form onSubmit={submit} className="space-y-5 p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="Company or organization" required><input required minLength={2} maxLength={160} className={input} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></Field><Field label="Location" required><input required minLength={2} maxLength={160} className={input} placeholder="City, country, or Remote" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Where you found it"><input maxLength={120} className={input} placeholder="LinkedIn, email, WhatsApp…" value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })} /></Field><Field label="Original link"><input type="url" maxLength={2048} className={input} placeholder="https://…" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} /></Field></div><Field label="Reported risk" required><div className="mt-2 grid gap-2 sm:grid-cols-3">{RISKS.map((item) => <button key={item.value} type="button" aria-pressed={form.risk === item.value} onClick={() => setForm({ ...form, risk: item.value })} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${form.risk === item.value ? item.style : "border-[var(--color-border)] text-[var(--color-text-muted)] dark:border-[var(--color-dark-border)] dark:text-[var(--color-dark-text-muted)]"}`}>{item.label}</button>)}</div></Field><Field label="What happened" required><textarea required minLength={40} maxLength={4000} rows={6} className={`${input} resize-y`} placeholder="Describe the messages, requests, payment demands, or behavior. Do not include passwords, government ID numbers, banking details, or private contact information." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><span className="mt-1 block text-right text-xs text-[var(--color-text-muted)]">{form.description.length}/4000</span></Field><Field label="Categories" required><div className="mt-2 flex flex-wrap gap-2">{CATEGORIES.map((item) => { const active = categories.includes(item); return <button type="button" key={item} aria-pressed={active} onClick={() => setCategories((values) => active ? values.filter((value) => value !== item) : [...values, item])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] dark:border-[var(--color-dark-border)] dark:text-[var(--color-dark-text-muted)]"}`}>{item}</button>; })}</div></Field><Field label="Private evidence (optional)"><label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-5 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)] dark:text-[var(--color-dark-text-muted)]"><Upload size={18} /> Add PNG, JPEG, or PDF<input className="sr-only" type="file" multiple accept="image/png,image/jpeg,application/pdf" onChange={(event) => void addFiles(event.target.files)} /></label><p className="mt-1.5 text-xs text-[var(--color-text-muted)]">Up to 3 files, 1 MB each, 2 MB total. Remove passwords, IDs, and banking details first.</p>{evidence.length > 0 && <ul className="mt-2 space-y-2">{evidence.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-xs dark:bg-[var(--color-dark-surface-2)]"><span className="truncate">{file.name} — {Math.ceil(file.size / 1024)} KB</span><button type="button" className="font-bold text-[var(--color-danger)]" onClick={() => setEvidence((files) => files.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></li>)}</ul>}<p className="mt-1 text-right text-xs text-[var(--color-text-muted)]">{Math.ceil(totalBytes / 1024)} / 2048 KB</p></Field>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}<div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] pt-5 dark:border-[var(--color-dark-border)] sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" isLoading={busy}>Submit privately for review</Button></div></form></section></div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{label}{required && <span className="text-[var(--color-danger)]"> *</span>}{children}</label>;
}
