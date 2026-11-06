"use client";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  FieldError as ErrorMessage,
  Input,
  Label,
  Select,
  SegmentedControl,
  Textarea,
  WorkspaceShell,
} from "@/components/ui/primitives";
import { Briefcase, Plus, Trash } from "../icons";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { useSession } from "../session-context";
import AuthRequiredState from "@/components/AuthRequiredState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AccessibleDialog from "@/components/ui/AccessibleDialog";
import { WorkflowPipelineBar } from "@/components/workspace/WorkflowPipelineBar";
import FollowupsPanel from "./followups-panel";
import VariantInsights from "./variant-insights";
import ApplicationList, { APPLICATION_STAGES as STATUSES } from "./application-list";

type App = {
  id: string;
  company: string;
  role: string;
  status: string;
  job_url?: string;
  notes?: string;
  resume_id?: string;
  resume_variant_label?: string | null;
  created_at?: string;
  updated_at?: string;
  follow_up_at?: string | null;
  comp_target_min?: number | null;
  comp_target_max?: number | null;
  comp_offered_base?: number | null;
  comp_currency?: string | null;
  comp_equity_note?: string | null;
};

type ResumeOption = {
  id: string;
  candidate_name?: string;
  headline?: string;
  ats_score?: number;
};

type AutoAttempt = {
  id: string; package_id: string; status: string; subject: string;
  recipient_record: { email?: string }; provider: string; source_url: string;
  provider_call_started_at?: string | null;
};

// Column accent colours — one hue per stage so the board reads by colour
// before it reads by text. Rendered as a top border on each column card.
const STATUS_ACCENT: Record<string, string> = {
  saved: "var(--color-text-faint)",
  applied: "var(--color-primary)",
  interview: "var(--color-brand-amber-solid)",
  offer: "var(--color-success)",
  rejected: "var(--color-danger)",
};

export default function Tracker() {
  const { session: me } = useSession();
  const [list, setList] = useState<App[] | null>(null);
  const [err, setErr] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; company: string; role: string } | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyNote, setBusyNote] = useState<string | null>(null);
  const [busyComp, setBusyComp] = useState<string | null>(null);
  const [busyStatusId, setBusyStatusId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null);
  const [variantDraft, setVariantDraft] = useState<{ id: string; value: string } | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [view, setView] = useState<"board" | "list" | "insights">("board");

  // add form
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("saved");
  const [jobUrl, setJobUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [targetMin, setTargetMin] = useState("");
  const [targetMax, setTargetMax] = useState("");
  const [offeredBase, setOfferedBase] = useState("");
  const [compCurrency, setCompCurrency] = useState("");
  const [variantLabel, setVariantLabel] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [editingNote, setEditingNote] = useState<{ id: string; notes: string } | null>(null);
  const [editingComp, setEditingComp] = useState<{ id: string; offeredBase: string; equityNote: string; currency: string } | null>(null);
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [autoAttempts, setAutoAttempts] = useState<AutoAttempt[]>([]);

  async function loadApps(cursor?: string) {
    try {
      const query = cursor ? `?limit=50&cursor=${encodeURIComponent(cursor)}` : "?limit=50";
      const response = await fetch(`/api/applications${query}`);
      if (!response.ok) throw new Error("applications_unavailable");
      const data = await response.json();
      const applications = Array.isArray(data.applications) ? data.applications : [];
      setList((current) => cursor ? [...(current ?? []), ...applications] : applications);
      setNextCursor(typeof data.nextCursor === "string" ? data.nextCursor : null);
      setLoadFailed(false);
    } catch {
      setErr("Could not load your applications. Your existing board has not been cleared; refresh to try again.");
      setList((current) => current ?? []);
      setLoadFailed(true);
    }
  }

  useEffect(() => {
    fetch("/api/resumes").then((r) => {
      if (!r.ok) throw new Error("resumes_unavailable");
      return r.json();
    }).then(setResumes).catch(() => setErr("Applications loaded, but resume choices are temporarily unavailable."));
    fetch("/api/application-attempts").then((r) => r.ok ? r.json() : { attempts: [] })
      .then((data) => setAutoAttempts(data.attempts ?? [])).catch(() => {});
    void loadApps();
  }, []);

  async function addApp() {
    setErr("");
    if (!company.trim() || !role.trim()) {
      setErr("Company and role are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          role: role.trim(),
          status,
          jobUrl: jobUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          targetSalaryMin: targetMin.trim() ? Number(targetMin) : undefined,
          targetSalaryMax: targetMax.trim() ? Number(targetMax) : undefined,
          offeredBase: offeredBase.trim() ? Number(offeredBase) : undefined,
          compCurrency: compCurrency.trim() ? compCurrency.trim().toUpperCase() : undefined,
          resumeVariantLabel: variantLabel.trim() || undefined,
          resumeId: resumeId || undefined,
        }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setErr(j.error === "duplicate_application"
          ? "That job is already on your tracker."
          : j.error === "resume_not_owned"
            ? "That resume is no longer available in your account. Choose another resume."
            : "Could not add application. Check the highlighted details and try again.");
        return;
      }
      setCompany("");
      setRole("");
      setStatus("saved");
      setJobUrl("");
      setNotes("");
      setResumeId("");
      setVariantLabel("");
      await loadApps();
      setShowAddForm(false);
    } catch {
      setErr("Network error while adding. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, next: string) {
    setErr("");
    setUpdateMessage("");
    setBusyStatusId(id);
    const previousStatus = list?.find((app) => app.id === id)?.status;
    setList((cur) => (cur || []).map((a) => (a.id === id ? { ...a, status: next } : a)));
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      setUpdateMessage(`Application moved to ${STATUSES.find((item) => item.key === next)?.label ?? next}.`);
    } catch {
      if (previousStatus !== undefined) {
        setList((current) => current?.map((app) => app.id === id ? { ...app, status: previousStatus } : app) ?? null);
      }
      setErr("Could not update status. Your previous tracker stage was restored.");
    } finally {
      setBusyStatusId(null);
    }
  }

  async function remove(id: string) {
    setErr("");
    const prev = list;
    setList((cur) => (cur || []).filter((a) => a.id !== id));
    try {
      const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setList(prev || []);
      setErr("Could not delete application. Try again.");
    }
  }

  async function setFollowUp(id: string, date: string) {
    setErr("");
    setUpdateMessage("");
    const response = await fetch(`/api/applications/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpAt: date ? `${date}T09:00:00.000Z` : null }),
    });
    if (!response.ok) { setErr("Could not update the follow-up date. The previous date is unchanged."); return; }
    setList((current) => (current ?? []).map((app) => app.id === id
      ? { ...app, follow_up_at: date ? `${date}T09:00:00.000Z` : null } : app));
    setUpdateMessage(date ? "Follow-up date saved." : "Follow-up date cleared.");
  }

  async function saveVariantLabel(id: string, raw: string) {
    setErr("");
    setUpdateMessage("");
    const value = raw.trim().slice(0, 60);
    const app = (list ?? []).find((a) => a.id === id);
    if (!app || (app.resume_variant_label ?? "") === value) return;
    setBusyVariantId(id);
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeVariantLabel: value || null }),
      });
      if (!response.ok) {
        setErr("Could not save the resume version tag. The previous tag is unchanged.");
        return;
      }
      setList((current) => (current ?? []).map((a) =>
        a.id === id ? { ...a, resume_variant_label: value || null } : a));
      setUpdateMessage(value ? "Resume version tag saved." : "Resume version tag cleared.");
    } finally {
      setBusyVariantId(null);
    }
  }

  if (me && !me.loggedIn) {
    return (
      <AuthRequiredState
        title="Log in to track your applications"
        description="One board for every job you're chasing — where it stands, the link, and your notes."
        actionLabel="Log in / Sign up"
        nextPath="/tracker"
      />
    );
  }

  const apps = list || [];
  const filteredApps = searchQuery.trim()
    ? apps.filter(
        (a) =>
          a.company.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          a.role.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          (a.notes || "").toLowerCase().includes(searchQuery.trim().toLowerCase()),
      )
    : apps;
  const byStatus = (k: string) => filteredApps.filter((a) => a.status === k);

  return (
    <WorkspaceShell
      title="Application tracker"
      description={<>Keep source links, resume versions, follow-up dates, notes, and actual status changes together. Tracker stages record your workflow; they do not infer employer outcomes.</>}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant={showAddForm ? "outline" : "primary"} size="sm" onClick={() => { setShowAddForm((v) => !v); if (view === "insights") setView("board"); }} leftIcon={<Plus size={15} />}>
            {showAddForm ? "Hide add form" : "Add application"}
          </Button>
          <Button as="a" href="/jobs" variant="outline" size="sm">Find jobs</Button>
        </div>
      }
    >
        <WorkflowPipelineBar currentHref="/tracker" />

        <div className="mb-6">
          <SegmentedControl
            label="Tracker view"
            value={view}
            onChange={setView}
            options={[
              { value: "board", label: "Board" },
              { value: "list", label: "List" },
              { value: "insights", label: "Variant insights" },
            ]}
          />
        </div>

        <datalist id="variant-label-options">
          {Array.from(new Set((list ?? []).map((a) => a.resume_variant_label).filter((v): v is string => Boolean(v)))).map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>

        {view === "insights" ? (
          <VariantInsights />
        ) : (
        <>
        {/* The form overlays the board instead of pushing the pipeline away. */}
        {showAddForm && (
        <AccessibleDialog label="Add application" onClose={() => { if (!busy) setShowAddForm(false); }}>
        <Card className="max-h-[85vh] w-[min(760px,calc(100vw-32px))] overflow-y-auto p-6">
          <div className="mb-4 flex justify-end"><Button variant="ghost" size="sm" disabled={busy} onClick={() => setShowAddForm(false)}>Close</Button></div>
          <h2 className="text-xl font-bold! font-[family-name:var(--font-display)]! text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
            Add application
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Data Analyst"
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="jobUrl">Job URL</Label>
              <Input
                id="jobUrl"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="targetMin">Target salary (min)</Label>
              <Input id="targetMin" inputMode="numeric" value={targetMin} onChange={(e) => setTargetMin(e.target.value.replace(/\D/g, ""))} placeholder="45000" />
            </div>
            <div>
              <Label htmlFor="targetMax">Target salary (max)</Label>
              <Input id="targetMax" inputMode="numeric" value={targetMax} onChange={(e) => setTargetMax(e.target.value.replace(/\D/g, ""))} placeholder="60000" />
            </div>
            <div>
              <Label htmlFor="offeredBase">Offered base</Label>
              <Input id="offeredBase" inputMode="numeric" value={offeredBase} onChange={(e) => setOfferedBase(e.target.value.replace(/\D/g, ""))} placeholder="only when the offer lands" />
            </div>
            <div>
              <Label htmlFor="compCurrency">Currency</Label>
              <Input id="compCurrency" value={compCurrency} onChange={(e) => setCompCurrency(e.target.value)} placeholder="USD / GBP / INR" maxLength={3} />
            </div>
            <div>
              <Label htmlFor="variantLabel">Resume version</Label>
              <Input id="variantLabel" value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)} placeholder="e.g. Resume A — skills-forward" maxLength={60} list="variant-label-options" />
            </div>
          </div>
          <div className="mb-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Recruiter name, referral, deadline, next step..."
            />
          </div>
          <div className="mb-4">
            <Label htmlFor="resumeId">Link resume (optional)</Label>
            <Select id="resumeId" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              <option value="">None</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.candidate_name || r.headline || "Resume"}
                  {r.ats_score ? ` (ATS ${r.ats_score})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={addApp} disabled={busy} isLoading={busy} leftIcon={<Plus size={16} />}>
            Add application
          </Button>
          {err && <ErrorMessage>{err}</ErrorMessage>}
        </Card>
        </AccessibleDialog>
        )}
        {!showAddForm && err && <ErrorMessage>{err}</ErrorMessage>}
        <p className="sr-only" role="status" aria-live="polite">{updateMessage}</p>
        <FollowupsPanel />

        {/* Funnel summary — own records, own stages, no employer-outcome claims */}
        {list && apps.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card padding="sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Total tracked</div>
              <div className="mt-1 text-2xl font-extrabold! tabular-nums text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{apps.length}</div>
            </Card>
            <Card padding="sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Interview stage</div>
              <div className="mt-1 text-2xl font-extrabold! tabular-nums text-[var(--color-primary)] dark:text-[var(--color-primary-hover)]">{byStatus("interview").length}</div>
            </Card>
            <Card padding="sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Offers recorded</div>
              <div className="mt-1 text-2xl font-extrabold! tabular-nums text-[var(--color-success)]">{byStatus("offer").length}</div>
            </Card>
            <Card padding="sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Moved past applied</div>
              <div className="mt-1 text-2xl font-extrabold! tabular-nums text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                {Math.round(((byStatus("interview").length + byStatus("offer").length + byStatus("rejected").length) / Math.max(1, apps.length)) * 100)}%
              </div>
            </Card>
          </div>
        )}

        {/* Loading */}
        {!list && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton variant="card" />
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {loadFailed && (
          <div role="alert">
          <Card className="mb-8 p-6">
            <h2 className="text-lg font-bold!">Your application board could not be refreshed</h2>
            <p className="mt-2 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              No existing applications were removed. Retry when the connection is available.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => void loadApps()}>
              Retry loading applications
            </Button>
          </Card>
          </div>
        )}

        {list && !loadFailed && apps.length === 0 && (
          <EmptyState
            icon={<Briefcase size={28} />}
            title="Add your first application"
            body="Save a role, set its stage, and add a follow-up date if you have one."
            action={
              <>
                <Button onClick={() => setShowAddForm(true)}>Add an application</Button>
                <Button as="a" href="/jobs" variant="outline">Browse jobs</Button>
              </>
            }
          />
        )}

        {/* Board */}
        {list && apps.length > 0 && (
          <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Company, role, or notes"
              aria-label="Filter applications"
              className="min-h-10 w-full max-w-sm rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-xs font-medium text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]"
            />
            <span className="text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Showing {filteredApps.length} of {apps.length} applications
            </span>
          </div>
          {view === "list" ? (
            filteredApps.length ? (
              <ApplicationList rows={filteredApps} onStageChange={changeStatus} busy={busyStatusId !== null} />
            ) : <p role="status" className="py-5 text-[var(--muted-fg)]">No applications match that filter.</p>
          ) : (
          <div className="flex flex-col gap-4 overflow-visible pb-2 items-stretch sm:flex-row sm:items-start sm:overflow-x-auto">
            {STATUSES.map((s) => {
              const col = byStatus(s.key);
              return (
                <div key={s.key} className="w-full min-w-0 sm:flex-shrink-0 sm:w-[280px] sm:min-w-[280px]">
                  <div
                    className="rounded-t-[var(--radius-lg)] border-t-4 px-1 pt-2.5"
                    style={{ borderTopColor: STATUS_ACCENT[s.key] ?? "var(--color-border)" }}
                    aria-hidden="true"
                  />
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h2 className="text-sm font-bold! font-[family-name:var(--font-display)]! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                      {s.label}
                    </h2>
                    <Badge variant="outline">{col.length}</Badge>
                  </div>
                  <div className="rs-stagger space-y-3">
                    {col.length === 0 && (
                      <p className="text-sm text-center text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] py-4">
                        No applications
                      </p>
                    )}
                    {col.map((a, index) => (
                      <Card key={a.id} padding="sm" className="flex flex-col gap-2" style={{ "--rs-stagger-i": index } as React.CSSProperties}>
                        <p className="text-[15px] font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                          {a.company}
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                          {a.role}
                        </p>
                        {a.job_url && (
                          <a
                            href={a.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
                          >
                            View job posting
                          </a>
                        )}
                        {(a.comp_target_min || a.comp_target_max || a.comp_offered_base || a.comp_equity_note) && (
                          <p className="m-0 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                            {a.comp_target_min || a.comp_target_max
                              ? <>Target {a.comp_currency ? `${a.comp_currency} ` : ""}{[a.comp_target_min, a.comp_target_max].filter(Boolean).join("–")} · </>
                              : ""}
                            {a.comp_offered_base
                              ? <strong className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Offered {a.comp_currency ? `${a.comp_currency} ` : ""}{a.comp_offered_base.toLocaleString()}</strong>
                              : ""}
                            {a.comp_equity_note ? <> · Equity: {a.comp_equity_note}</> : null}
                          </p>
                        )}
                        {editingNote?.id === a.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingNote.notes}
                              onChange={(e) => setEditingNote({ ...editingNote, notes: e.target.value })}
                              rows={2}
                              className="text-sm py-2 min-h-[72px]"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                isLoading={busyNote === a.id}
                                onClick={async () => {
                                  setBusyNote(a.id);
                                  try {
                                  const response = await fetch(`/api/applications/${a.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ notes: editingNote.notes }),
                                  });
                                  if (!response.ok) {
                                    setErr("Could not save the note. Your previous note is unchanged.");
                                    return;
                                  }
                                  setList((cur) =>
                                    (cur || []).map((app) =>
                                      app.id === a.id ? { ...app, notes: editingNote.notes } : app
                                    )
                                  );
                                  setEditingNote(null);
                                  setUpdateMessage("Application note saved.");
                                  } finally { setBusyNote(null); }
                                }}
                              >
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingNote(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : editingComp?.id === a.id ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <Input
                                value={editingComp.offeredBase}
                                onChange={(e) => setEditingComp({ ...editingComp, offeredBase: e.target.value.replace(/\D/g, "") })}
                                inputMode="numeric"
                                placeholder={`Offered base${editingComp.currency ? ` (${editingComp.currency})` : ""}`}
                                className="text-sm py-2"
                              />
                              <Input
                                value={editingComp.equityNote}
                                onChange={(e) => setEditingComp({ ...editingComp, equityNote: e.target.value })}
                                placeholder="Equity / bonus note"
                                className="text-sm py-2"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                isLoading={busyComp === a.id}
                                onClick={async () => {
                                  setBusyComp(a.id);
                                  try {
                                  const response = await fetch(`/api/applications/${a.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      offeredBase: editingComp.offeredBase ? Number(editingComp.offeredBase) : null,
                                      equityNote: editingComp.equityNote.trim() || null,
                                      compCurrency: editingComp.currency || null,
                                    }),
                                  });
                                  if (!response.ok) {
                                    setErr("Could not save the offer. Previous values unchanged.");
                                    return;
                                  }
                                  setList((cur) =>
                                    (cur || []).map((app) =>
                                      app.id === a.id
                                        ? { ...app, comp_offered_base: editingComp.offeredBase ? Number(editingComp.offeredBase) : null, comp_equity_note: editingComp.equityNote.trim() || null, comp_currency: editingComp.currency || null }
                                        : app
                                    )
                                  );
                                  setEditingComp(null);
                                  setUpdateMessage("Offer recorded.");
                                  } finally { setBusyComp(null); }
                                }}
                              >
                                Save offer
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingComp(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            {a.notes && (
                              <p className="flex-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] line-clamp-3">
                                {a.notes}
                              </p>
                            )}
                            {a.status === "offer" && editingComp?.id !== a.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingComp({ id: a.id, offeredBase: a.comp_offered_base ? String(a.comp_offered_base) : "", equityNote: a.comp_equity_note ?? "", currency: a.comp_currency ?? "" })}
                              >
                                {a.comp_offered_base ? "Edit offer" : "Record offer"}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingNote({ id: a.id, notes: a.notes || "" })}
                              aria-label={`Edit notes for ${a.company}`}
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Select
                            value={a.status}
                            onChange={(e) => changeStatus(a.id, e.target.value)}
                            aria-label={`Status for ${a.company}`}
                            disabled={busyStatusId === a.id}
                            className="flex-1 min-w-0 text-sm min-h-[36px] py-1.5"
                          >
                            {STATUSES.map((st) => (
                              <option key={st.key} value={st.key}>
                                {st.label}
                              </option>
                            ))}
                          </Select>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setPendingDelete({ id: a.id, company: a.company, role: a.role })}
                            aria-label={`Delete ${a.company} application`}
                            leftIcon={<Trash size={14} />}
                          >
                            Delete
                          </Button>
                        </div>
                        <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                          <span>Resume version</span>
                          <input
                            className="min-h-9 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]"
                            value={variantDraft?.id === a.id ? variantDraft.value : (a.resume_variant_label ?? "")}
                            onChange={(event) => setVariantDraft({ id: a.id, value: event.target.value })}
                            onBlur={(event) => { setVariantDraft(null); void saveVariantLabel(a.id, event.target.value); }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                const value = (event.target as HTMLInputElement).value;
                                setVariantDraft(null);
                                void saveVariantLabel(a.id, value);
                              }
                            }}
                            placeholder="e.g. Resume A — skills-forward"
                            maxLength={60}
                            list="variant-label-options"
                            disabled={busyVariantId === a.id}
                            aria-label={`Resume version sent for ${a.company}`}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                          {(() => {
                            const due = a.follow_up_at ? new Date(a.follow_up_at) : null;
                            const overdue = due && due.getTime() < Date.now() - 86400000;
                            return (
                              <>
                                <span className="flex items-center justify-between">
                                  Follow-up date
                                  {due && (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                        overdue
                                          ? "bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]"
                                          : "bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] text-[var(--color-success-hover)]"
                                      }`}
                                    >
                                      {overdue ? "due" : "scheduled"}
                                    </span>
                                  )}
                                </span>
                                <input
                                  type="date"
                                  className="min-h-9 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]"
                                  value={a.follow_up_at ? a.follow_up_at.slice(0, 10) : ""}
                                  onChange={(event) => void setFollowUp(a.id, event.target.value)}
                                />
                              </>
                            );
                          })()}
                        </label>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          )}
          {nextCursor && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => void loadApps(nextCursor)}>
                Load older applications
              </Button>
            </div>
          )}
          </div>
        )}
        {autoAttempts.length > 0 && (
          <section className="mt-10" aria-labelledby="email-ledger-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 id="email-ledger-heading" className="text-xl font-bold!">Application email ledger</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">Operational email states stay separate from your recruiting outcome above.</p></div>
              <Button as="a" href="/application-queue" variant="outline">Open application queue</Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {autoAttempts.map((attempt) => (
                <Card key={attempt.id} className="p-4">
                  <div className="flex flex-wrap justify-between gap-2"><strong>{attempt.subject}</strong><Badge variant="outline">{attempt.status.replaceAll("_", " ")}</Badge></div>
                  <p className="mt-2 break-all text-sm text-[var(--color-text-muted)]">{attempt.provider} → {attempt.recipient_record.email}</p>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">Immutable package {attempt.package_id}</p>
                  {attempt.status === "provider_accepted" && <p className="mt-2 text-sm font-semibold">Application email accepted by provider — delivery unverified</p>}
                  {attempt.status === "unknown" && <p className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-300">Outcome unknown. Automatic resend is disabled.</p>}
                  <a className="mt-2 inline-block text-sm font-bold text-[var(--color-primary)]" href={attempt.source_url}>Official application link</a>
                </Card>
              ))}
            </div>
          </section>
        )}
        </>
        )}
        {pendingDelete && (
          <ConfirmDialog
            title="Delete this application?"
            body={`${pendingDelete.role} at ${pendingDelete.company} will be removed from your tracker, along with its stage history and follow-up date. This cannot be undone.`}
            confirmLabel="Delete application"
            destructive
            onConfirm={async () => { const id = pendingDelete.id; setPendingDelete(null); await remove(id); }}
            onCancel={() => setPendingDelete(null)}
          />
        )}
    </WorkspaceShell>
  );
}
