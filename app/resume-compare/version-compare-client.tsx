"use client";

import { useState } from "react";
import { Button, Card, ToolShell } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/error-message";
import ResumeFileUpload from "@/components/tools/ResumeFileUpload";
import { resumeSourceText } from "@/lib/resume-source-text";
import SavedResumePicker from "@/components/tools/SavedResumePicker";

type MatchResult = {
  fitScore: number;
  grade: string;
  matched: string[];
  missing: string[];
};

type CompareResult = {
  a: MatchResult;
  b: MatchResult;
  winner: "a" | "b" | "tie";
  delta: number;
  onlyInA: string[];
  onlyInB: string[];
  missingFromBoth: string[];
};

type Faq = [string, string];

const SAMPLE_A = `Alex Morgan — Software Engineer (Generalist Version)
Skills: JavaScript, TypeScript, React, Node.js, SQL, Git
Experience:
• Built full-stack web features in React and Node.js for customer billing portal.
• Maintained SQL database tables and improved query performance across reporting pages.
• Collaborated with product managers and designers to ship bi-weekly releases.`;

const SAMPLE_B = `Alex Morgan — Senior Backend Engineer (Tailored Version)
Skills: TypeScript, Node.js, PostgreSQL, Redis, Kafka, Docker, AWS, Kubernetes, CI/CD
Experience:
• Architected high-throughput payment settlement services in TypeScript, Node.js, PostgreSQL, and Kafka handling $42M/mo with 99.98% uptime.
• Deployed containerized workloads on AWS Kubernetes (EKS) with Redis caching, cutting p95 latency by 64%.
• Automated GitHub Actions CI/CD pipelines and integration suites, reducing rollback incidents by 44%.`;

const SAMPLE_JD = `Senior Backend Engineer — Payments Infrastructure
Requirements:
- 5+ years with TypeScript, Node.js, PostgreSQL, Redis, and Kafka
- Production AWS, Docker, Kubernetes, and CI/CD pipeline experience
- Track record scaling payment settlement or financial ledger systems with high reliability`;

export default function VersionCompareClient({ faqs }: { faqs: Faq[] }) {
  const [resumeA, setResumeA] = useState("");
  const [resumeB, setResumeB] = useState("");
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function loadSample() {
    setResult(null);
    setResumeA(SAMPLE_A);
    setResumeB(SAMPLE_B);
    setJdText(SAMPLE_JD);
    setErr("");
  }

  function swapVersions() {
    setResumeA(resumeB);
    setResumeB(resumeA);
    setResult(null);
  }

  function resetAll() {
    setResumeA("");
    setResumeB("");
    setJdText("");
    setResult(null);
    setErr("");
  }

  async function loadSavedResume(resumeId: string, slot: "a" | "b") {
    setErr("");
    try {
      const r = await fetch(`/api/resume/${resumeId}`, { signal: AbortSignal.timeout(15_000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errorMessage(j?.error, "Could not load that resume."));
      const text = resumeSourceText(j.content);
      if (slot === "a") setResumeA(text);
      else setResumeB(text);
    } catch (e: any) {
      setErr(e?.message || "Could not load that resume.");
    }
  }

  async function compare() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/resume-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeA: resumeA.trim(), resumeB: resumeB.trim(), jdText: jdText.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errorMessage(j.error, "Could not compare."));
      setResult(j as CompareResult);
    } catch (e: any) {
      setErr(e?.name === "TimeoutError" ? "That took too long. Try again." : errorMessage(e?.message, "Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const ready = resumeA.trim().length >= 80 && resumeB.trim().length >= 80 && jdText.trim().length >= 80;

  function versionCard(label: string, data: MatchResult, isWinner: boolean) {
    return (
      <div
        className={`flex-1 rounded-xl border p-4 ${
          isWinner ? "border-[var(--color-success)] bg-[var(--surface-2)] ring-2 ring-[var(--color-success)]/40" : "border-[var(--border)] bg-[var(--surface)]"
        }`}
      >
        {isWinner && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--color-success)]">✓ Winning version</p>}
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[var(--muted-fg)]">{label}</p>
        <div className="mt-1 text-4xl font-extrabold! tabular-nums text-[var(--fg)]">{data.fitScore}</div>
        <p className="mt-0.5 text-sm font-semibold text-[var(--fg)]">{data.grade}</p>
        <p className="mt-1 text-xs text-[var(--muted-fg)]">
          {data.matched.length} covered · {data.missing.length} missing
        </p>
      </div>
    );
  }

  return (
    <ToolShell
      eyebrow="Free — no account"
      title="Which version fits better?"
      subtitle="Paste two resume versions and the target job description. See which scores higher and what each covers that the other misses."
      workspaceSize="large"
      onLoadSample={loadSample}
      onReset={resetAll}
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT 7 COLS: VERSION A, VERSION B & JD */}
        <Card className="lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              1. Compare Version A vs. Version B
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="compact" onClick={loadSample}>
                ⚡ Load sample A/B
              </Button>
              <Button type="button" variant="outline" size="compact" onClick={swapVersions}>
                🔄 Swap A ↔ B
              </Button>
              <Button type="button" variant="ghost" size="compact" onClick={resetAll}>
                🧹 Clear
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className="mb-1 block text-sm font-bold text-[var(--fg)]">Version A</span>
              <SavedResumePicker label="Load Version A" onSelect={(id) => void loadSavedResume(id, "a")} />
              <div className="mb-2">
                <ResumeFileUpload onText={(text) => setResumeA((current) => current || text)} />
              </div>
              <textarea
                value={resumeA}
                onChange={(e) => setResumeA(e.target.value)}
                rows={7}
                maxLength={30_000}
                placeholder="Paste the first version…"
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
            <div>
              <span className="mb-1 block text-sm font-bold text-[var(--fg)]">Version B</span>
              <SavedResumePicker label="Load Version B" onSelect={(id) => void loadSavedResume(id, "b")} />
              <div className="mb-2">
                <ResumeFileUpload onText={(text) => setResumeB((current) => current || text)} />
              </div>
              <textarea
                value={resumeB}
                onChange={(e) => setResumeB(e.target.value)}
                rows={7}
                maxLength={30_000}
                placeholder="Paste the second version…"
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
          </div>

          <label className="mt-3.5 block">
            <span className="mb-1 block text-sm font-bold text-[var(--fg)]">Target job description</span>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={5}
              maxLength={30_000}
              placeholder="Paste the job description both versions target…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button size="lg" onClick={() => void compare()} isLoading={busy} disabled={!ready}>
              ⚖️ Compare versions
            </Button>
            {!ready && <span className="text-xs text-[var(--muted-fg)]">Paste A, B, and JD (or click ⚡ Load sample A/B).</span>}
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-[var(--color-danger)]" role="alert">{err}</p>}
        </Card>

        {/* RIGHT 5 COLS: STICKY WINNER & DIFF */}
        <Card className="lg:col-span-5 lg:sticky lg:top-24">
          {!result ? (
            <div>
              <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                2. Side-by-side diff &amp; winner
              </span>
              <h2 className="mt-1.5 text-lg font-extrabold! text-[var(--fg)]">Verify your edits improved the score</h2>
              <p className="mt-1 text-sm text-[var(--muted-fg)]">
                Click <strong>⚡ Load sample A/B</strong> and run the comparison to see:
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--muted-fg)]">
                <li>• Exact score delta between Version A and Version B</li>
                <li>• Keywords covered uniquely by Version A vs. Version B</li>
                <li>• Shared gaps still missing from both drafts</li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-4">
                <Button type="button" variant="outline" size="sm" onClick={loadSample}>
                  ⚡ Load Sample A/B Resumes
                </Button>
                <Button as="a" href="/resume-match" variant="outline" size="sm">
                  🎯 Single Resume Match →
                </Button>
              </div>
            </div>
          ) : (
            <div role="status">
              <div className="grid gap-3 sm:grid-cols-2">
                {versionCard("Version A", result.a, result.winner === "a")}
                {versionCard("Version B", result.b, result.winner === "b")}
              </div>

              {result.delta > 0 && (
                <p className="mt-3 text-center text-sm font-semibold text-[var(--fg)]">
                  Version <b>{result.winner.toUpperCase()}</b> fits better by <b className="tabular-nums text-[var(--primary)]">+{result.delta} points</b>.
                </p>
              )}

              {result.onlyInA.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">Only Version A covers</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.onlyInA.map((t) => (
                      <span key={t} className="rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-success)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.onlyInB.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">Only Version B covers</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.onlyInB.map((t) => (
                      <span key={t} className="rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-success)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.missingFromBoth.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--color-danger)]">Missing from BOTH — add these</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.missingFromBoth.map((t) => (
                      <span key={t} className="rounded-full border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-danger)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-4">
                <Button as="a" href="/build" size="sm">
                  ✨ Build the Best Version in AI Builder →
                </Button>
                <Button as="a" href="/resume-maker" variant="outline" size="sm">
                  🛠 Open Manual Maker
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8 border-t border-[var(--hairline)] pt-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">Version compare questions</h2>
        <div className="grid gap-3 md:grid-cols-3">
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
