"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  MetricCard,
  SectionHeader,
  SegmentedControl,
  WorkspaceShell,
} from "@/components/ui/primitives";
import ScoreRing from "@/components/ui/ScoreRing";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import OnboardingChecklist from "@/components/dashboard/OnboardingChecklist";
import MarketAlarm from "@/components/dashboard/MarketAlarm";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { Copy, FileText, Download, Lock, Pencil, Trash, Sparkles } from "../icons";
import { useSession } from "../session-context";
import { toolRunLabel, type ToolRun } from "@/lib/tool-runs";
import { DEFAULT_FREE_MONTHLY_LIMIT, DEFAULT_PREMIUM_MONTHLY_LIMIT, DEFAULT_STUDENT_MONTHLY_LIMIT } from "@/lib/limits";
import { planLabel } from "@/lib/plan-label";
import AuthRequiredState from "@/components/AuthRequiredState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import WorkspaceOverview from "./workspace-overview";
import SocialRewardsStrip from "@/components/SocialRewardsStrip";

type Resume = {
  id: string;
  candidate_name?: string;
  headline?: string;
  created_at: string;
  ats_score: number;
  premium_unlock?: boolean;
  company_name?: string;
  role_title?: string;
};

const PAGE_SIZE = 20;

export default function Dashboard() {
  const { session: me } = useSession();
  const [list, setList] = useState<Resume[] | null>(null);
  const [sort, setSort] = useState<"recent" | "score">("recent");
  const [loaded, setLoaded] = useState(PAGE_SIZE);
  // One slot, because only one of these can be open at a time. Holding the
  // resume identity here rather than in the row keeps the dialog mounted at the
  // page level, where it is not unmounted by the optimistic list update that
  // the confirmed action itself triggers.
  const [pending, setPending] = useState<{ kind: "delete" | "rename"; id: string; name: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/resumes").then((r) => (r.ok ? r.json() : [])).then(setList).catch(() => setList([]));
  }, []);

  // Tool-run history (Platform Premium). Only fetched when the tier carries
  // the feature — the 402 contract makes a blind fetch pure noise otherwise.
  const [toolRuns, setToolRuns] = useState<ToolRun[] | null>(null);
  const toolHistory = me?.features?.toolHistory ?? false;
  useEffect(() => {
    if (!toolHistory) return;
    fetch("/api/tool-runs")
      .then((r) => (r.ok ? r.json() : { runs: [] }))
      .then((j: { runs?: ToolRun[] }) => setToolRuns(j.runs ?? []))
      .catch(() => setToolRuns([]));
  }, [toolHistory]);

  const sorted = useMemo(() => {
    if (!list) return [];
    const copy = [...list];
    if (sort === "score") copy.sort((a, b) => (b.ats_score ?? 0) - (a.ats_score ?? 0));
    else copy.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return copy;
  }, [list, sort]);

  const visible = useMemo(() => sorted.slice(0, loaded), [sorted, loaded]);

  const stats = useMemo(() => {
    if (!list || list.length === 0) return { count: 0, avg: 0, best: 0 };
    const scores = list.map((r) => r.ats_score ?? 0);
    return {
      count: list.length,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      best: Math.max(...scores),
    };
  }, [list]);

  // Fallback mirrors lib/limits defaults: free 1, student 2, premium 5.
  // me.limit is present in every real session; this only covers the edge.
  const fallbackLimit = me?.premium
    ? (me?.premiumSource === "student" ? DEFAULT_STUDENT_MONTHLY_LIMIT : DEFAULT_PREMIUM_MONTHLY_LIMIT)
    : DEFAULT_FREE_MONTHLY_LIMIT;
  const quota = `${me?.remaining ?? 0}/${me?.limit ?? fallbackLimit}`;
  const credits = me?.credits ?? 0;

  async function deleteResume(id: string) {
    const prev = list;
    setList((cur) => (cur || []).filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/resume/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Resume deleted.");
    } catch {
      setList(prev || []);
      toast("Could not delete resume. Nothing was removed.", "error");
    }
  }

  async function renameResume(id: string, currentName: string, next: string) {
    if (!next || next === currentName) return;
    // Optimistic update; restore on failure so the label never lies.
    const prev = list;
    setList((cur) => (cur || []).map((r) => (r.id === id ? { ...r, candidate_name: next } : r)));
    try {
      const res = await fetch(`/api/resume/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) throw new Error();
      toast("Resume renamed.");
    } catch {
      setList(prev || []);
      toast("Could not rename resume. The previous name was kept.", "error");
    }
  }

  async function duplicateResume(id: string) {
    try {
      const res = await fetch(`/api/resume/${id}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) throw new Error();
      // Reload so the fork appears with its own timestamp next to the source.
      const fresh = await fetch("/api/resumes").then((r) => (r.ok ? r.json() : []));
      setList(fresh);
      toast("Duplicated. The copy is at the top of your list.");
    } catch {
      toast("Could not duplicate resume. Try again.", "error");
    }
  }

  /* Logged-out prompt */
  if (me && !me.loggedIn) {
    return (
      <AuthRequiredState
        title="Log in to open your workspace"
        description="See your resumes, applications, Daily Matches, review queue, account status, and support in one place."
        nextPath="/dashboard"
      />
    );
  }

  const statItems = [
    { label: "Saved resumes", value: <AnimatedCounter to={stats.count} />, detail: "In your library" },
    { label: "Average diagnostic score", value: <AnimatedCounter to={stats.avg} />, detail: "Across saved resumes" },
    { label: "Best diagnostic score", value: <AnimatedCounter to={stats.best} />, detail: "Highest RoleSharp estimate" },
    { label: "Rolling allowance", value: <span>{quota}</span>, detail: "Resumes remaining" },
    ...(!me?.premium ? [{ label: "Credits", value: <AnimatedCounter to={credits} />, detail: "Premium generations" }] : []),
  ];

  const workspaceMeta = me ? (
    <>
      <Badge variant={me.premium ? "premium" : "default"}>
        {me.premium
          ? `${planLabel(me)}${me.premiumUntil ? ` until ${new Date(me.premiumUntil).toLocaleDateString()}` : ""}`
          : "Free plan"}
      </Badge>
      {/* Ink & Signal: the 11-button pseudo-nav died here. The workspace tab
          bar (visible on every workspace page) plus the navbar cover these
          destinations; only the two actions with no tab-bar equivalent stay.
          Free users keep the upgrade CTA at the decision point. */}
      {!me.premium && <Button as="a" href="/pricing" size="sm" className="rsx-glow">Upgrade</Button>}
    </>
  ) : undefined;

  return (
    <WorkspaceShell
      title="My workspace"
      description="Pick up where you left off with your resumes and applications."
      actions={<Button as="a" href="/build">New resume</Button>}
      meta={workspaceMeta}
    >

        {me?.loggedIn && (
          <section className="desk-dashboard-grid mb-8" aria-labelledby="dashboard-next">
            <div>
              <h2 id="dashboard-next" className="text-2xl!">Pick up your work</h2>
              <ul className="m-0 mt-4 list-none p-0">
                {[
                  { title: "Saved resumes", description: "Compare versions or download a document.", href: "/resumes" },
                  { title: "Application tracker", description: "Check your stages and follow-ups.", href: "/tracker" },
                  { title: "Application queue", description: "Review the message and attachments before approving.", href: "/application-queue" },
                ].map(({ title, description, href }) => (
                  <li key={href} className="border-t border-[var(--border)] py-3">
                    <a className="desk-link min-h-9" href={href}>{title}</a>
                    <p className="m-0 text-sm text-[var(--muted-fg)]">{description}</p>
                  </li>
                ))}
              </ul>
            </div>
            <aside className="desk-dashboard-usage" aria-labelledby="dashboard-usage">
              <h2 id="dashboard-usage" className="text-xl!">Resume allowance</h2>
              <p className="my-3 text-4xl font-bold tabular-nums">{me.remaining ?? 0} left</p>
              <p className="text-sm text-[var(--muted-fg)]">Of {me.limit ?? 0} tailored resumes in the current rolling period.</p>
              <a className="desk-link" href="/settings?tab=billing">View usage and plan</a>
            </aside>
          </section>
        )}

        {/* The follow-us offer lives where members actually land — the
            homepage strip alone was invisible to anyone who logged in
            straight into the workspace (owner report 2026-10-16). */}
        {me?.loggedIn && !me.premium && (
          <div className="mb-5">
            <SocialRewardsStrip />
          </div>
        )}

        {me?.loggedIn && (
          <ScrollReveal variant="up">
            <MarketAlarm />
            <OnboardingChecklist />
            <WorkspaceOverview session={me} />
          </ScrollReveal>
        )}

        <ScrollReveal variant="up" delay={80}>
          <SectionHeader
            eyebrow="Resume library"
            title="Saved resumes"
            description="Compare diagnostic ATS scores and download the export you need. Scores are RoleSharp estimates, not employer decisions."
            actions={<Button as="a" href="/checker" variant="outline" size="sm">Check a resume</Button>}
            className="mb-5"
          />
        </ScrollReveal>

        {/* Stats strip */}
        {list && list.length > 0 && (
          <ScrollReveal variant="stagger" className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {statItems.map((item, index) => (
              <div key={item.label} style={{ "--rs-reveal-delay": index } as React.CSSProperties}>
                <div className="rsx-stat-accent">
                  <MetricCard label={item.label} value={item.value} detail={item.detail} />
                </div>
              </div>
            ))}
          </ScrollReveal>
        )}

        {/* Tool-run history (Platform Premium) */}
        {toolHistory && toolRuns && toolRuns.length > 0 && (
          <ScrollReveal variant="up" className="mb-8">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] shadow-[var(--shadow-sm)] p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Recent tool runs</h2>
                <span className="text-[13px] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Your Premium trail</span>
              </div>
              <div className="divide-y divide-[var(--hairline)]">
                {toolRuns.slice(0, 8).map((run, index) => (
                  <div key={`${run.created_at}-${run.tool}-${index}`} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{toolRunLabel(run.tool)}</span>
                    <span className="text-[13px] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                      {run.summary ? <>{run.summary} · </> : null}
                      {run.score != null ? <b className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{run.score}/100</b> : null}
                      {run.score != null ? " · " : ""}
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* Sort toolbar */}
        {list && list.length > 1 && (
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              {list.length} resumes
            </span>
            <SegmentedControl
              value={sort}
              onChange={setSort}
              label="Sort saved resumes"
              options={[
                { value: "recent", label: "Most recent" },
                { value: "score", label: "Highest score" },
              ]}
            />
          </div>
        )}

        {/* Skeleton loading state */}
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
        {list && list.length === 0 && (
          <EmptyState
            icon={<FileText size={28} />}
            title="Nothing here yet"
            body="Make your first tailored resume — or check one you already have. Whatever you build shows up here with its score and a download button."
            action={
              <>
                <Button as="a" href="/build">
                  Make resume
                </Button>
                <Button as="a" href="/checker" variant="outline">
                  Check resume
                </Button>
                <Button as="a" href="/tracker" variant="ghost">
                  Track applications
                </Button>
              </>
            }
          />
        )}

        {/* Resume card grid */}
        {list && list.length > 0 && (
          <div className="rs-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {visible.map((r, index) => {
              // Mirrors the /api/resume/[id]/docx rule exactly: DOCX is the
              // Platform Premium tier feature; a per-resume unlock covers FREE
              // accounts only — a student's own unlocked resumes stay
              // PDF-only (lib/tier-features.ts).
              const docxForResume = (me?.features?.docxExport ?? false) || (!me?.premium && r.premium_unlock);
              return (
                <SpotlightCard key={r.id} className="rsx-hover-lift rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] shadow-[var(--shadow-sm)] overflow-hidden flex flex-col justify-between" style={{ "--rs-stagger-i": index } as React.CSSProperties}>
                  <div className="p-6 flex items-start gap-4">
                    <ScoreRing score={r.ats_score} size={64} stroke={7} label="ATS" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold! truncate text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                        <a
                          href={`/resumes/${r.id}`}
                          className="hover:text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                        >
                          {r.candidate_name || "Resume"}
                        </a>
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] truncate">
                        {r.role_title || r.headline || "Tailored resume"}
                        {r.company_name ? ` — ${r.company_name}` : ""}
                      </p>
                      <p className="text-xs text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)] mt-0.5">
                        {new Date(r.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-[var(--color-border)] dark:border-[var(--color-dark-border)] flex flex-wrap items-center gap-2 bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)]">
                    {/* Before this, leaving /build meant a resume could never
                        be reopened in-app. */}
                    <Button as="a" href={`/resumes/${r.id}`} size="sm">
                      Open
                    </Button>
                    {/* The letter is built from this resume's own evidence, so
                        it needs no form: ?tool=cover generates it on arrival.
                        Secondary actions are icon+short-label to keep four
                        controls on one row at card width. */}
                    <Button
                      as="a"
                      href={`/build?resumeId=${r.id}`}
                      size="sm"
                      variant="outline"
                      leftIcon={<Pencil size={15} />}
                      title="Edit in AI Builder"
                    >
                      Edit
                    </Button>
                    <Button
                      as="a"
                      href={`/resumes/${r.id}?tool=cover`}
                      size="sm"
                      variant="outline"
                      leftIcon={<Sparkles size={15} />}
                      title="Generate a cover letter from this resume"
                    >
                      Cover
                    </Button>
                    <Button
                      as="a"
                      href={`/api/resume/${r.id}/pdf`}
                      size="sm"
                      variant="outline"
                      leftIcon={<Download size={15} />}
                      title="Download PDF"
                    >
                      PDF
                    </Button>
                    {docxForResume ? (
                      <Button
                        as="a"
                        href={`/api/resume/${r.id}/docx`}
                        variant="outline"
                        size="sm"
                        leftIcon={<FileText size={15} />}
                        title="Download DOCX"
                      >
                        DOCX
                      </Button>
                    ) : (
                      // A <span aria-disabled> is announced as plain text, not
                      // as a control. A real disabled button is. Same rule
                      // frontend-regression.test.ts enforces elsewhere.
                      <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text-muted)]"
                        title={me?.premiumSource === "student" ? "DOCX export comes with Platform Premium — your Student plan includes clean, watermark-free PDF" : "DOCX export requires Premium"}
                      >
                        <Lock size={15} /> DOCX{" "}
                        <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                          (Premium)
                        </span>
                      </button>
                    )}
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPending({ kind: "rename", id: r.id, name: r.candidate_name || "Resume" })}
                      aria-label={`Rename ${r.candidate_name || "Resume"}`}
                      title="Rename"
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void duplicateResume(r.id)}
                      aria-label={`Duplicate ${r.candidate_name || "Resume"}`}
                      title="Duplicate as a starting point for another job"
                    >
                      <Copy size={15} />
                    </Button>
                    {/* danger, not ghost: this sat as a third identical grey
                        icon beside Rename and Duplicate, so the only
                        irreversible control in the row looked exactly like the
                        two reversible ones next to it. */}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setPending({ kind: "delete", id: r.id, name: r.candidate_name || "Resume" })}
                      aria-label={`Delete ${r.candidate_name || "Resume"}`}
                    >
                      <Trash size={15} />
                    </Button>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        )}

        {/* Show more button */}
        {list && loaded < sorted.length && (
          <div className="text-center mt-8">
            <Button variant="outline" onClick={() => setLoaded((v) => v + PAGE_SIZE)}>
              Show more ({list.length - loaded} remaining)
            </Button>
          </div>
        )}
        {pending?.kind === "delete" && (
          <ConfirmDialog
            title="Delete this resume?"
            body={`"${pending.name}" and its saved score will be removed. This cannot be undone.`}
            confirmLabel="Delete resume"
            destructive
            onConfirm={async () => { const id = pending.id; setPending(null); await deleteResume(id); }}
            onCancel={() => setPending(null)}
          />
        )}
        {pending?.kind === "rename" && (
          <ConfirmDialog
            title="Rename resume"
            confirmLabel="Save name"
            defaultValue={pending.name}
            inputLabel="Resume name"
            onConfirm={async (value) => { const target = pending; setPending(null); await renameResume(target.id, target.name, value); }}
            onCancel={() => setPending(null)}
          />
        )}
    </WorkspaceShell>
  );
}
