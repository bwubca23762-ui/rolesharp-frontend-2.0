"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, FieldError, Label, Select, Textarea } from "@/components/ui/primitives";
import type { GapStatus, SkillVerdict } from "@/lib/skill-gap";
import SavedResumePicker from "@/components/tools/SavedResumePicker";
import { resumeSourceText } from "@/lib/resume-source-text";
import { certificationsForSkills } from "@/lib/certifications-registry";
import { useWorkspaceDraft } from "@/lib/workspace-context";

type Role = { slug: string; title: string };
type Result = {
  targetTitle: string;
  currentTitle: string | null;
  verdicts: SkillVerdict[];
  coverage: number;
  steps: string[];
};

const REQUEST_TIMEOUT_MS = 20_000;

const SAMPLE_RESUME = `Alex Morgan
Data & Operations Analyst
Experience:
• Built automated SQL and Excel financial close trackers across 320 monthly vendor invoices, reducing reconciliation time from 6 hours to 2.
• Partnered with product and engineering leads to define KPI dashboards and weekly cohort retention reports.
• Presented quarterly variance analysis and forecasting models to senior leadership.`;

const GROUPS: { status: GapStatus; heading: string; blurb: string }[] = [
  {
    status: "undocumented",
    heading: "Already yours, missing from the page",
    blurb: "Your current role lists these and your resume does not mention them. This is the fastest work you can do tonight.",
  },
  {
    status: "unproven",
    heading: "Nothing in your history points at these",
    blurb: "Worth being straight with yourself about. Anything you have genuinely done belongs on the page; anything you have not is a plan.",
  },
  {
    status: "evidenced",
    heading: "Already evidenced",
    blurb: "Your resume says these. Nothing to do.",
  },
];

export default function SkillGapTool({ roles }: { roles: Role[] }) {
  const { draft, loaded, updateDraft } = useWorkspaceDraft();
  const [resumeText, setResumeText] = useState("");
  const [currentSlug, setCurrentSlug] = useState("");
  const [targetSlug, setTargetSlug] = useState(() => roles[0]?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedSkill, setCopiedSkill] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const restoredWorkspace = useRef(false);
  useEffect(() => {
    if (!loaded || restoredWorkspace.current) return;
    restoredWorkspace.current = true;
    if (draft?.resumeText) setResumeText((current) => current || draft.resumeText || "");
  }, [loaded, draft]);

  function loadSample() {
    setResumeText(SAMPLE_RESUME);
    setResult(null);
    if (!targetSlug && roles.length > 0) setTargetSlug(roles[0].slug);
    if (!currentSlug && roles.length > 1) setCurrentSlug(roles[1].slug);
    setError("");
  }

  function clearAll() {
    setResumeText("");
    setResult(null);
    setError("");
  }

  async function loadSavedResume(resumeId: string) {
    setError("");
    try {
      const r = await fetch(`/api/resume/${resumeId}`, { signal: AbortSignal.timeout(15_000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error === "login_required" ? "Please log in again to load that resume." : "Could not load that resume.");
      setResumeText(resumeSourceText(j.content));
    } catch {
      setError("Could not load that resume. Paste the text instead.");
    }
  }

  async function run() {
    if (busy) return;
    setError("");
    setResult(null);
    if (resumeText.trim().length < 80) {
      setError("Paste a bit more of your resume — at least a few lines of experience.");
      return;
    }
    if (!targetSlug) {
      setError("Pick the role you are aiming at.");
      return;
    }
    updateDraft({ resumeText: resumeText }, "skill-gap");
    setBusy(true);
    try {
      const res = await fetch("/api/skill-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, targetSlug, currentSlug: currentSlug || undefined }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          res.status === 429
            ? "Too many checks for now. Try again shortly."
            : body?.error
              ? "That did not work. Check the role and try again."
              : "That did not work. Try again.",
        );
        return;
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error && err.name === "TimeoutError" ? "That took too long. Try again." : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-12 lg:items-start">
      {/* LEFT 5 COLS: INPUTS */}
      <Card padding="lg" className="lg:col-span-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
          <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
            1. Role &amp; resume
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="compact" onClick={loadSample}>
              ⚡ Sample
            </Button>
            <Button type="button" variant="ghost" size="compact" onClick={clearAll}>
              🧹 Clear
            </Button>
          </div>
        </div>

        <div className="grid gap-3.5">
          <div>
            <Label htmlFor="sg-target">The role you are aiming at *</Label>
            <Select id="sg-target" value={targetSlug} onChange={(e) => setTargetSlug(e.target.value)}>
              <option value="">Choose a role</option>
              {roles.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.title}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="sg-current">
              The role you do now <span className="font-normal text-[var(--muted-fg)]">(optional)</span>
            </Label>
            <Select id="sg-current" value={currentSlug} onChange={(e) => setCurrentSlug(e.target.value)} aria-describedby="sg-current-hint">
              <option value="">Not sure / not listed</option>
              {roles.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.title}
                </option>
              ))}
            </Select>
            <p id="sg-current-hint" className="mt-1 text-xs text-[var(--muted-fg)]">
              Separates skills you likely have but forgot to write down from skills you haven&apos;t used yet.
            </p>
          </div>
        </div>

        <div className="mt-3">
          <SavedResumePicker onSelect={(id) => void loadSavedResume(id)} />
        </div>
        <div className="mt-3">
          <Label htmlFor="sg-resume">Your resume text</Label>
          <Textarea
            id="sg-resume"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={8}
            placeholder="Paste your resume. Nothing is stored — it is analysed in the request and thrown away."
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={busy} isLoading={busy}>
            {busy ? "Checking..." : "📊 Show me the gap"}
          </Button>
          <FieldError>{error}</FieldError>
        </div>
      </Card>

      {/* RIGHT 7 COLS: STICKY GAP REPORT */}
      <div className="space-y-4 lg:col-span-7">
        {!result ? (
          <Card padding="lg">
            <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              2. Three-bucket skill audit
            </span>
            <h2 className="mt-1.5 text-lg font-extrabold! text-[var(--fg)]">
              Separate undocumented skills from real learning gaps
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-fg)]">
              Select your target role and paste your resume (or click <strong>⚡ Sample</strong>) to see:
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {GROUPS.map((g) => (
                <div key={g.status} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                  <p className="text-xs font-bold text-[var(--fg)]">{g.heading}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">{g.blurb}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-4">
              <Button type="button" variant="outline" size="sm" onClick={loadSample}>
                ⚡ Load Sample Resume
              </Button>
              <Button as="a" href="/career-map" variant="outline" size="sm">
                🗺 Explore Career Mobility Map →
              </Button>
              <Button as="a" href="/free-certifications" variant="ghost" size="sm">
                🎓 Free Certifications
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card padding="lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--muted-fg)]">
                    Against <strong className="text-[var(--fg)]">{result.targetTitle}</strong>
                    {result.currentTitle ? (
                      <>
                        , coming from <strong className="text-[var(--fg)]">{result.currentTitle}</strong>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-3xl font-extrabold text-[var(--fg)]">{result.coverage}% evidenced</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button as="a" href="/build" size="sm">
                    ✨ Tailor Resume in AI Builder →
                  </Button>
                  <Button as="a" href="/free-certifications" variant="outline" size="sm">
                    🎓 Free Credentials
                  </Button>
                </div>
              </div>
              <ul className="mt-4 space-y-1.5 border-t border-[var(--hairline)] pt-3">
                {result.steps.map((step) => (
                  <li key={step} className="flex gap-2.5 text-sm leading-relaxed text-[var(--fg)]">
                    <span aria-hidden="true" className="text-[var(--primary)]">
                      →
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {GROUPS.map((group) => {
              const items = result.verdicts.filter((v) => v.status === group.status);
              if (!items.length) return null;
              return (
                <Card key={group.status} padding="lg">
                  <h3 className="text-base font-bold! text-[var(--fg)]">
                    {group.heading} <span className="text-[var(--muted-fg)]">({items.length})</span>
                  </h3>
                  <p className="mt-1 mb-3 text-xs leading-5 text-[var(--muted-fg)]">{group.blurb}</p>
                  <ul className="space-y-3">
                    {items.map((v) => (
                      <li key={v.skill} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[var(--fg)]">{v.skill}</p>
                          {v.resumeBulletSuggestion && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(v.resumeBulletSuggestion!).then(() => {
                                  setCopiedSkill(v.skill);
                                  setTimeout(() => setCopiedSkill(null), 2000);
                                }).catch(() => {});
                              }}
                              className="text-xs font-bold text-[var(--primary)] hover:underline"
                            >
                              {copiedSkill === v.skill ? "✓ Copied bullet" : "📋 Copy bullet template"}
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">{v.note}</p>

                        {v.resumeBulletSuggestion && (
                          <p className="mt-2 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-[var(--fg)]">
                            {v.resumeBulletSuggestion}
                          </p>
                        )}
                        {v.proofProjectIdea && (
                          <p className="mt-1.5 text-xs text-[var(--muted-fg)]">
                            <strong className="text-[var(--fg)]">Weekend proof idea:</strong> {v.proofProjectIdea}
                          </p>
                        )}

                        {v.status === "unproven" && certificationsForSkills([v.skill], 2).length > 0 ? (
                          <div className="mt-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
                            <p className="text-xs font-semibold text-[var(--fg)]">Free learning for {v.skill}</p>
                            <ul className="mt-1 space-y-1">
                              {certificationsForSkills([v.skill], 2).map((course) => (
                                <li key={course.id}>
                                  <a
                                    href={course.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium text-[var(--primary)] underline underline-offset-2"
                                  >
                                    {course.title} · {course.provider} ↗
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
