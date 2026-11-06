"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, ToolShell } from "@/components/ui/primitives";
import ResumeFileUpload from "@/components/tools/ResumeFileUpload";
import SavedResumePicker from "@/components/tools/SavedResumePicker";
import { resumeSourceText } from "@/lib/resume-source-text";
import { errorMessage } from "@/lib/error-message";
import type { MatchResult, MatchedTerm } from "@/lib/match-engine";
import { useWorkspaceDraft } from "@/lib/workspace-context";

type Faq = [string, string];

const PLACEHOLDER_RESUME = `Paste your resume here — plain text from any PDF or DOCX works.
Include your experience bullets: they are what gets matched.`;

const PLACEHOLDER_JD = `Paste the full job description here.
The requirements section carries the keywords that get matched.`;

const SAMPLE_RESUME = `Alex Morgan — Senior Backend Engineer
Skills: TypeScript, Node.js, PostgreSQL, Redis, Docker, K8s, AWS, REST, GraphQL
Experience:
• Architected high-throughput payment settlement microservices in TypeScript, Node.js, and PostgreSQL handling $42M in monthly volume with 99.98% uptime.
•Deployed containerized services on AWS EKS (K8s) with Redis caching, cutting p95 API latency from 410ms to 135ms.
• Built automated CI/CD pipelines and integration test suites, reducing production rollback incidents by 44%.`;

const SAMPLE_JD = `Senior Backend Engineer — Payments Platform
Requirements / Must Have:
- 5+ years building production backend services in TypeScript or Node.js
- Strong experience with PostgreSQL, Redis, and Kafka event streaming
- Production experience with Kubernetes, Docker, and AWS cloud infrastructure
- Experience with GraphQL, REST APIs, and CI/CD pipelines
Preferred / Nice to Have:
- Experience with Terraform, Datadog, and Go (Golang)`;

function verdictTone(verdict: MatchedTerm["verdict"]): string {
  return verdict === "strong"
    ? "text-[var(--color-success)]"
    : "text-[var(--muted-fg)]";
}

function ScoreDial({ score }: { score: number }) {
  const tone = score >= 75 ? "var(--color-success)" : score >= 55 ? "var(--color-primary)" : score >= 35 ? "#d97706" : "var(--color-danger)";
  return (
    <div
      className="relative mx-auto grid h-32 w-32 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${tone} ${score * 3.6}deg, var(--surface-2) 0deg)` }}
      role="img"
      aria-label={`Match score ${score} out of 100`}
    >
      <div className="grid h-[84%] w-[84%] place-items-center rounded-full bg-[var(--surface)]">
        <div className="text-center">
          <div className="text-3xl font-extrabold! tabular-nums text-[var(--fg)]">{score}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted-fg)]">out of 100</div>
        </div>
      </div>
    </div>
  );
}

export default function ResumeMatchClient({ faqs }: { faqs: Faq[] }) {
  const { draft, loaded, updateDraft } = useWorkspaceDraft();
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedMissing, setCopiedMissing] = useState(false);
  const [err, setErr] = useState("");

  const restoredWorkspace = useRef(false);
  useEffect(() => {
    if (!loaded || restoredWorkspace.current) return;
    restoredWorkspace.current = true;
    if (draft?.resumeText) setResumeText((current) => current || draft.resumeText || "");
    if (draft?.jdText) setJdText((current) => current || draft.jdText || "");
  }, [loaded, draft]);

  function loadSample() {
    setResumeText(SAMPLE_RESUME);
    setJdText(SAMPLE_JD);
    setResult(null);
    setErr("");
  }

  function resetAll() {
    setResumeText("");
    setJdText("");
    setResult(null);
    setErr("");
  }

  async function loadSavedResume(resumeId: string) {
    setErr("");
    try {
      const r = await fetch(`/api/resume/${resumeId}`, { signal: AbortSignal.timeout(15_000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errorMessage(j?.error, "Could not load that resume."));
      setResumeText(resumeSourceText(j.content));
    } catch (e: any) {
      setErr(e?.message || "Could not load that resume.");
    }
  }

  async function analyze() {
    if (busy) return;
    updateDraft({ resumeText: resumeText, jdText }, "resume-match");
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/resume-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: resumeText.trim(), jdText: jdText.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not run the match.");
      setResult(j as MatchResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell
      eyebrow="Free — no account"
      title="Does your resume match this job?"
      subtitle="Paste your resume and the job description. Get a weighted fit score out of 100, must-have vs. nice-to-have gaps, and synonym matches in seconds."
      workspaceSize="large"
      onLoadSample={loadSample}
      onReset={resetAll}
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT 6 COLS: RESUME & JD INPUTS */}
        <Card className="lg:col-span-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              1. Resume &amp; job description
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="compact" onClick={loadSample}>
                ⚡ Load sample
              </Button>
              <Button type="button" variant="ghost" size="compact" onClick={resetAll}>
                🧹 Clear
              </Button>
            </div>
          </div>

          <div>
            <span className="mb-1 block text-sm font-bold text-[var(--fg)]">Your resume</span>
            <SavedResumePicker onSelect={(id) => void loadSavedResume(id)} />
            <div className="mb-2">
              <ResumeFileUpload onText={(text) => setResumeText((current) => current || text)} />
            </div>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder={PLACEHOLDER_RESUME}
              rows={7}
              maxLength={30_000}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <label className="mt-3.5 block">
            <span className="mb-1 block text-sm font-bold text-[var(--fg)]">Job description</span>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder={PLACEHOLDER_JD}
              rows={7}
              maxLength={30_000}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              size="lg"
              onClick={() => void analyze()}
              isLoading={busy}
              disabled={resumeText.trim().length < 80 || jdText.trim().length < 80}
            >
              🎯 Check my match — free
            </Button>
            {resumeText.trim().length < 80 || jdText.trim().length < 80 ? (
              <span className="text-xs text-[var(--muted-fg)]">Paste both texts (or click ⚡ Load sample).</span>
            ) : null}
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-[var(--color-danger)]" role="alert">{err}</p>}
        </Card>

        {/* RIGHT 6 COLS: STICKY MATCH SCORE & KEYWORD TABLE */}
        <Card className="lg:col-span-6 lg:sticky lg:top-24">
          {!result ? (
            <div>
              <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                2. Section-weighted keyword &amp; synonym match
              </span>
              <h2 className="mt-1.5 text-lg font-extrabold! text-[var(--fg)]">
                See what you cover and what you&rsquo;re missing
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-fg)]">
                Paste your resume and target posting on the left (or click <strong>⚡ Load sample</strong>) to inspect:
              </p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <p className="text-xs font-bold text-[var(--fg)]">Must-Have vs. Nice-to-Have</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">
                    Requirements in core qualification sections carry 2× weight compared to preferred bonus skills.
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <p className="text-xs font-bold text-[var(--fg)]">Canonical Synonym Graph</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">
                    Recognizes K8s ↔ Kubernetes, Postgres ↔ PostgreSQL, JS ↔ JavaScript, and 300+ short technical tokens.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-4">
                <Button type="button" variant="outline" size="sm" onClick={loadSample}>
                  ⚡ Run With Sample Resume + JD
                </Button>
                <Button as="a" href="/resume-compare" variant="outline" size="sm">
                  ⚖️ Compare Two Resume Versions →
                </Button>
                <Button as="a" href="/build" variant="ghost" size="sm">
                  ✨ Tailor in AI Builder
                </Button>
              </div>
            </div>
          ) : (
            <div role="status" aria-live="polite">
              <div className="flex flex-col items-center gap-4 border-b border-[var(--hairline)] pb-4 sm:flex-row">
                <ScoreDial score={result.fitScore} />
                <div>
                  <h2 className="text-xl font-extrabold! tracking-tight text-[var(--fg)]">{result.grade} match</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted-fg)]">
                    Your resume covers <b>{result.counts.matched}</b> of <b>{result.counts.jdTerms}</b> requirements this posting repeats.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button as="a" href="/build" size="sm">
                      ✨ Tailor Resume for This Job →
                    </Button>
                    {result.missing.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard?.writeText(result.missing.join(", ")).then(() => {
                            setCopiedMissing(true);
                            setTimeout(() => setCopiedMissing(false), 2000);
                          }).catch(() => {});
                        }}
                      >
                        {copiedMissing ? "✓ Copied gaps" : "📋 Copy missing keywords"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {result.mustHaveMissing && result.mustHaveMissing.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--color-danger)]">
                    Must-have gaps ({result.mustHaveMissing.length})
                  </h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.mustHaveMissing.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-danger)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.niceToHaveMissing && result.niceToHaveMissing.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">
                    Preferred / nice-to-have gaps ({result.niceToHaveMissing.length})
                  </h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.niceToHaveMissing.map((t) => (
                      <span key={t} className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted-fg)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.synonymMatches && result.synonymMatches.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--color-success)]">
                    Verified synonym matches
                  </h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.synonymMatches.map((m) => (
                      <span
                        key={`${m.jdTerm}-${m.resumeTerm}`}
                        className="rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-success)]"
                      >
                        {m.jdTerm} ↔ {m.resumeTerm}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">Requirement coverage</h3>
                <div className="mt-2 grid max-h-64 gap-x-6 overflow-y-auto pr-1 sm:grid-cols-2">
                  {result.terms.map((t) => (
                    <div key={t.term} className="flex items-center justify-between gap-2 border-b border-[var(--hairline)] py-2">
                      <span className="min-w-0 truncate text-xs font-medium text-[var(--fg)]">{t.term}</span>
                      <span className={`shrink-0 text-[11px] font-bold uppercase tracking-wide ${verdictTone(t.verdict)}`}>
                        {t.verdict === "strong" ? "✓ covered" : "missing"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8 border-t border-[var(--hairline)] pt-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">Match checker questions</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {faqs.map(([question, answer]) => (
            <div key={question} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="text-sm font-bold text-[var(--fg)]">{question}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-[var(--muted-fg)]">{answer}</p>
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}
