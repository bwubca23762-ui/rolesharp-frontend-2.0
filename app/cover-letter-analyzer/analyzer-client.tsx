"use client";

import { useState } from "react";
import { Button, Card, Input, Label, Notice, Textarea, Badge } from "@/components/ui/primitives";
import { useSession } from "@/app/session-context";

type LetterCheck = {
  score: number;
  grade: string;
  checks: Array<{ label: string; pass: boolean; detail: string }>;
  hookScore?: number;
  specificityScore?: number;
  metricDensityScore?: number;
  clicheFreeScore?: number;
  nonDuplicationScore?: number;
  repairedOpeningParagraph?: string;
};

const REQUEST_TIMEOUT_MS = 20_000;

const SAMPLE_LETTER = `Dear Ms. Chen,

I am applying for the Senior Data Analyst role at Fictional Payments. In my current role at Example Systems, I rebuilt the subscription reconciliation pipeline in SQL and Python, cutting failed monthly renewals by 18% across 140,000 active accounts and reducing month-end close from 6 hours to 2.

Your posting highlights multi-currency settlement reporting and automated anomaly detection — areas where I have shipped production Power BI dashboards and dbt models used daily by 18 finance and operations stakeholders.

I would welcome the opportunity to discuss how this experience can support Fictional Payments' Q4 ledger automation roadmap. Thank you for your time and consideration.

Sincerely,
Alex Morgan`;

export default function CoverLetterAnalyzerClient() {
  const { session, loading } = useSession();
  const [letter, setLetter] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [copiedOpener, setCopiedOpener] = useState(false);
  const [result, setResult] = useState<LetterCheck | null>(null);

  function loadSample() {
    setTargetCompany("Fictional Payments");
    setTargetRole("Senior Data Analyst");
    setLetter(SAMPLE_LETTER);
    setError("");
  }

  function clearAll() {
    setTargetCompany("");
    setTargetRole("");
    setLetter("");
    setResult(null);
    setError("");
  }

  async function run() {
    if (busy || letter.trim().length < 80) return;
    setBusy(true);
    setError("");
    setResult(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/cover-letter-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letter, targetCompany, targetRole }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (response.status === 402) {
        setNeedsUpgrade(true);
        return;
      }
      if (!response.ok) {
        setError(data?.error || `Could not analyze (HTTP ${response.status}).`);
        return;
      }
      setResult(data as LetterCheck);
    } catch {
      setError(controller.signal.aborted ? "That took too long. Try again." : "Network error — nothing was analyzed.");
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  if (!loading && needsLogin) {
    return (
      <Card className="text-center">
        <h2 className="text-lg font-bold text-[var(--fg)]">Log in to analyze your letter</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-fg)]">
          The analyzer is included with Premium. Log in first so your checks stay tied to your account.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button as="a" href="/login">Log in</Button>
          <Button as="a" href="/pricing" variant="outline">See Premium plans</Button>
        </div>
      </Card>
    );
  }

  const subScores = result
    ? [
        { label: "Opening hook", val: result.hookScore },
        { label: "Company & role specificity", val: result.specificityScore },
        { label: "Quantified proof density", val: result.metricDensityScore },
        { label: "Cliché-free language", val: result.clicheFreeScore },
        { label: "Non-duplication", val: result.nonDuplicationScore },
      ].filter((item): item is { label: string; val: number } => typeof item.val === "number")
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
      {/* LEFT 6 COLS: INPUTS */}
      <Card className="lg:col-span-6">
        {needsUpgrade && (
          <Notice variant="info" title="The Cover Letter Analyzer is a Premium feature" className="mb-4">
            Paste your letter to see exactly what it scores — length, named addressee, quantified proof, cliché
            density and more. Premium is a one-time pass that never auto-renews.{" "}
            <a href="/pricing" className="font-semibold underline underline-offset-2">See Premium plans</a>
          </Notice>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
          <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
            1. Cover letter &amp; target
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {!loading && session?.premium && <Badge variant="premium">Premium active</Badge>}
            <Button type="button" variant="outline" size="compact" onClick={loadSample}>
              ⚡ Load sample
            </Button>
            <Button type="button" variant="ghost" size="compact" onClick={clearAll}>
              🧹 Clear
            </Button>
          </div>
        </div>

        <div className="mb-3.5 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cla-company">Target company</Label>
            <Input id="cla-company" value={targetCompany} onChange={(e) => setTargetCompany(e.target.value)} maxLength={120} placeholder="Fictional Payments" />
          </div>
          <div>
            <Label htmlFor="cla-role">Target role</Label>
            <Input id="cla-role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} maxLength={120} placeholder="Senior Data Analyst" />
          </div>
        </div>

        <Label htmlFor="cla-letter">Paste your cover letter</Label>
        <Textarea
          id="cla-letter"
          rows={11}
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          placeholder="Dear Ms Chen, I am applying for the Senior Data Analyst role at Fictional Payments, where my work cutting failed renewals by 18%…"
          aria-describedby="cla-hint"
        />
        <p id="cla-hint" className="mt-1.5 text-xs leading-5 text-[var(--muted-fg)]">
          Nothing is stored or sent to any model — this is a deterministic check of the words on the page.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button onClick={run} disabled={busy || letter.trim().length < 80} aria-busy={busy} isLoading={busy}>
            {busy ? "Analyzing…" : "🔍 Analyze my letter"}
          </Button>
          <span className="text-xs font-semibold text-[var(--muted-fg)]">
            {letter.trim().split(/\s+/).filter(Boolean).length} words (ideal: 180–380)
          </span>
        </div>

        {error && <Notice variant="danger" role="alert" className="mt-4">{error}</Notice>}
      </Card>

      {/* RIGHT 6 COLS: STICKY SCORE & 8-CHECK BREAKDOWN */}
      <Card className="lg:col-span-6 lg:sticky lg:top-24">
        {!result ? (
          <div>
            <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              2. Eight recruiter checks
            </span>
            <h2 className="mt-1.5 text-lg font-extrabold! text-[var(--fg)]">What the analyzer scores</h2>
            <p className="mt-1 text-sm text-[var(--muted-fg)]">
              Paste your draft on the left (or click <strong>⚡ Load sample</strong>) to score it across 8 hiring-team checks and 5 sub-scores.
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {[
                ["1. Word count (180–380w)", "Long enough for proof, short enough to read in 30 seconds."],
                ["2. Named addressee", "Flags generic 'To Whom It May Concern' or 'Dear Hiring Manager'."],
                ["3. Quantified proof", "Checks for at least one real number, %, or $ outcome."],
                ["4. Company & role match", "Verifies your letter names the exact company and role."],
                ["5. Opening hook", "Flags weak 'I am writing to apply' openings and drafts a repair."],
                ["6. Cliché & buzzword audit", "Catches 'passionate team player', 'hard worker', and filler."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <p className="text-xs font-bold text-[var(--fg)]">{t}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-4">
              <Button type="button" variant="outline" size="sm" onClick={loadSample}>
                ⚡ Load Sample Cover Letter
              </Button>
              <Button as="a" href="/cover-letter-generator" variant="outline" size="sm">
                ✉️ Cover Letter Generator →
              </Button>
              <Button as="a" href="/cover-letter-templates" variant="ghost" size="sm">
                📋 6 Cover Letter Structures
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-4 border-b border-[var(--hairline)] pb-4">
              <div
                className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2"
                style={{ borderColor: result.score >= 70 ? "#047857" : result.score >= 45 ? "#B45309" : "#B91C1C" }}
                role="img"
                aria-label={`Score ${result.score} out of 100`}
              >
                <span className="text-xl font-extrabold text-[var(--fg)]">{result.score}</span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--muted-fg)]">/100</span>
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--fg)]">{result.grade}</p>
                <p className="text-sm text-[var(--muted-fg)]">
                  {result.checks.filter((check) => check.pass).length} of {result.checks.length} checks passed.
                </p>
              </div>
            </div>

            {subScores.length > 0 && (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {subScores.map((s) => (
                  <div key={s.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--fg)]">
                      <span>{s.label}</span>
                      <span className="font-[family-name:var(--font-mono)]">{s.val}/100</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface)]">
                      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.min(100, Math.max(0, s.val))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.repairedOpeningParagraph && (
              <div className="mt-4 rounded-xl border border-[var(--primary)]/40 bg-[var(--surface-2)] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                    Suggested opening hook repair
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(result.repairedOpeningParagraph!).then(() => {
                        setCopiedOpener(true);
                        setTimeout(() => setCopiedOpener(false), 2000);
                      }).catch(() => {});
                    }}
                    className="text-xs font-bold text-[var(--primary)] hover:underline"
                  >
                    {copiedOpener ? "✓ Copied" : "📋 Copy opener"}
                  </button>
                </div>
                <p className="mt-1.5 text-sm leading-6 text-[var(--fg)]">{result.repairedOpeningParagraph}</p>
              </div>
            )}

            <ul className="mt-4 space-y-2">
              {result.checks.map((check) => (
                <li
                  key={check.label}
                  className="flex items-start rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5"
                >
                  <span
                    aria-hidden="true"
                    className={`mr-3 mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${check.pass ? "bg-[#047857]" : "bg-[#B45309]"}`}
                  />
                  <span>
                    <strong className="text-sm font-semibold text-[var(--fg)]">{check.label}</strong>{" "}
                    <span className="block text-xs leading-5 text-[var(--muted-fg)]">{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-4">
              <Button as="a" href="/cover-letter-generator" size="sm">
                ✉️ Generate Tailored Cover Letter →
              </Button>
              <Button as="a" href="/build" variant="outline" size="sm">
                ✨ Tailor Resume in AI Builder
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
