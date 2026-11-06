"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, ToolShell } from "@/components/ui/primitives";
import { FaqSection } from "@/app/seo-blocks";
import ResumeFileUpload from "@/components/tools/ResumeFileUpload";
import { useWorkspaceDraft } from "@/lib/workspace-context";
import { terms } from "@/lib/ats-score";
import type { HumanAuthenticity, HumanizeCounts } from "@/lib/ai-humanizer";

type DiffEntry = { before: string; after: string; notes: string[] };

type HumanizeResponse = {
  before: HumanAuthenticity;
  after: HumanAuthenticity;
  result: { text: string; counts: HumanizeCounts };
  diff: DiffEntry[];
};

const FAQS: [string, string][] = [
  ["Does this prove my resume was written by a human?", "No. It checks wording patterns and proposes edits. It cannot verify authorship, identify every AI-written sentence, or guarantee a detector result. Review the diff before using the revised text."],
  ["What is a burstiness index?", "The standard deviation of line lengths in words. It describes variation in this text; it does not establish who wrote it or how an employer will assess it."],
  ["Can I review changes to numbers and keywords?", "Yes. Review the line-by-line diff and keyword-preservation indicator before using the result. Keep only edits that preserve the facts and meaning of your original resume."],
];

const SAMPLE_AI_RESUME = `Alex Rivera — Senior Marketing Manager
alex.rivera@example.com | +1 646 555 0199 | New York, NY

SUMMARY
Dynamic and results-driven marketing leader passionate about leveraging cutting-edge strategies.

EXPERIENCE
Senior Marketing Manager | Northwind Retail | 2021 - Present
- Spearheaded the holistic rebranding initiative, ensuring seamless cross-channel alignment.
- Utilized data-driven insights to meticulously orchestrate campaigns, driving significant engagement growth of 38%.
- Leveraged state-of-the-art automation tools, fostering a culture of experimentation.
Marketing Manager | Brightline Media | 2018 - 2021
- Led the paid media team, cutting cost per acquisition 27%.
- Led the affiliate program relaunch across 12 markets.`;

export default function AiHumanizerPage() {
  const { draft, loaded, updateDraft } = useWorkspaceDraft();
  const [text, setText] = useState("");
  const [out, setOut] = useState<HumanizeResponse | null>(null);
  const [tab, setTab] = useState<"certificate" | "diff">("certificate");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [err, setErr] = useState("");

  const wordCount = useMemo(
    () => (text.trim() ? (text.match(/[A-Za-z0-9][A-Za-z0-9+#.%$'-]*/g) ?? []).length : 0),
    [text],
  );

  const keywordPreserved = useMemo(() => {
    if (!out) return null;
    const before = new Set(terms(text));
    const after = new Set(terms(out.result.text));
    if (!before.size) return 100;
    let kept = 0;
    for (const t of before) if (after.has(t)) kept += 1;
    return Math.round((kept / before.size) * 100);
  }, [out, text]);

  const restoredWorkspace = useRef(false);
  useEffect(() => {
    if (!loaded || restoredWorkspace.current) return;
    restoredWorkspace.current = true;
    if (draft?.resumeText) setText((current) => current || draft.resumeText || "");
  }, [loaded, draft]);

  function loadSample() {
    setText(SAMPLE_AI_RESUME);
    setOut(null);
    setErr("");
  }

  function resetAll() {
    setText("");
    setOut(null);
    setErr("");
  }

  async function run() {
    if (busy || text.trim().length < 40) {
      if (!busy) setErr("Paste at least a few lines of resume text (40+ characters).");
      return;
    }
    updateDraft({ resumeText: text }, "ai-humanizer");
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/tools/humanize-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "The pass failed. Try again.");
      setOut(j as HumanizeResponse);
      setTab("certificate");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "The pass failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function copyText() {
    if (!out) return;
    navigator.clipboard?.writeText(out.result.text).then(() => {
      setCopied("text");
      setTimeout(() => setCopied(""), 2000);
    }).catch(() => {});
  }

  function downloadText() {
    if (!out) return;
    const blob = new Blob([out.result.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume-humanized.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function pushToMaker() {
    if (!out) return;
    const bullets = out.result.text
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*[-•*·]\s+/, "").trim())
      .filter((l) => l && !/^[A-Z][A-Z\s]+$/.test(l) && !/@/.test(l))
      .slice(0, 24);
    try {
      sessionStorage.setItem("rolesharp-maker-import", JSON.stringify({ tool: "bullets", bullets }));
    } catch {}
    window.location.href = "/resume-maker";
  }

  function pushToChecker() {
    if (!out) return;
    updateDraft({ resumeText: out.result.text, resumeFileName: "humanized-resume.txt", origin: "ai-humanizer" }, "ai-humanizer");
    window.location.href = "/checker";
  }

  return (
    <ToolShell
      eyebrow="Free — no account"
      title="Polish your resume language"
      subtitle="Review clichés, repeated openings, and hidden characters. Compare each proposed edit with your original text; style checks do not verify authorship."
      workspaceSize="large"
      onLoadSample={loadSample}
      onReset={resetAll}
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT: WORKBENCH */}
        <Card className="lg:col-span-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              Resume text
            </span>
            <div className="flex flex-wrap gap-1.5">
              {draft?.resumeText && (
                <Button type="button" variant="outline" size="compact" onClick={() => setText(draft.resumeText ?? "")}>
                  📄 Active draft
                </Button>
              )}
              <Button type="button" variant="ghost" size="compact" onClick={resetAll}>
                🧹 Clear
              </Button>
            </div>
          </div>

          <ResumeFileUpload onText={(value) => setText((current) => current || value)} label="Drag & drop or click — extract text from your PDF, DOCX, or TXT" />
          <label className="mt-3 block" htmlFor="hz-text">
            <span className="mb-1 block text-sm font-bold text-[var(--fg)]">
              Paste or edit the text ({wordCount ? `${wordCount} words` : "min 40 characters"})
            </span>
            <textarea
              id="hz-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              maxLength={40_000}
              placeholder="Paste AI-generated or hand-written resume text. Nothing is stored — the pass is deterministic and runs per request…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button onClick={() => void run()} isLoading={busy} disabled={text.trim().length < 40}>
              Review language
            </Button>
            <span className="text-xs text-[var(--muted-fg)]">Watermarks · clichés · tails · cadence · score</span>
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-[var(--color-danger)]" role="alert">{err}</p>}
        </Card>

        {/* RIGHT: STICKY CERTIFICATE + DIFF */}
        <Card className="lg:col-span-6 lg:sticky lg:top-24">
          {!out ? (
            <div>
              <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                Language review
              </span>
              <h2 className="mt-1.5 text-lg font-extrabold! text-[var(--fg)]">The five passes, and what each one removes</h2>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-fg)]">
                <li><strong className="text-[var(--fg)]">1. Watermark scrubber</strong> — zero-width spaces, directional marks, BOM, non-breaking spaces, excessive em-dashes.</li>
                <li><strong className="text-[var(--fg)]">2. Cliché rewriter</strong> — 45+ giveaway phrases (spearheaded, leveraged, seamlessly…) become plain verbs.</li>
                <li><strong className="text-[var(--fg)]">3. Tail trimmer</strong> — trailing &ldquo;, ensuring…&rdquo; clauses: fluff removed, quantified ones kept.</li>
                <li><strong className="text-[var(--fg)]">4. Cadence diversifier</strong> — repeated opening verbs rotated; burstiness reported, never faked.</li>
                <li><strong className="text-[var(--fg)]">5. Style report</strong> — wording indicators, line-length variation, and a diff of proposed changes.</li>
              </ol>
              <p className="mt-3 text-sm text-[var(--muted-fg)]">
                Click <strong>Load sample</strong> to try a draft with common wording problems, or paste your own.
              </p>
            </div>
          ) : (
            <div role="status">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
                <h2 className="text-lg font-extrabold! text-[var(--fg)]">Style review</h2>
                <div className="flex gap-1.5">
                  <Button type="button" variant={tab === "certificate" ? "primary" : "outline"} size="compact" onClick={() => setTab("certificate")}>
                    Style report
                  </Button>
                  <Button type="button" variant={tab === "diff" ? "primary" : "outline"} size="compact" onClick={() => setTab("diff")}>
                    Diff ({out.diff.length})
                  </Button>
                </div>
              </div>

              {tab === "certificate" && (
                <div className="mt-3">
                  {/* Heuristic wording report */}
                  <div className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/30 bg-[var(--color-success)]/[0.06] p-4">
                    <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-success)]">
                      Wording patterns
                    </p>
                    <p className="mt-1 text-2xl font-extrabold! text-[var(--fg)]">Style indicator: {out.after.humanScore}/100</p>
                    <p className="text-xs text-[var(--muted-fg)]">
                      A wording heuristic, not proof of human authorship or an employer assessment.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                      <div className="rounded-lg bg-[var(--surface)] p-2">
                        <p className="font-bold text-[var(--fg)]">{out.result.counts.watermarks === 0 && out.after.watermarks === 0 ? "0" : out.after.watermarks}</p>
                        <p className="text-[var(--muted-fg)]">Hidden characters</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface)] p-2">
                        <p className="font-bold text-[var(--fg)]">{out.after.cliches}</p>
                        <p className="text-[var(--muted-fg)]">LLM clichés left</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface)] p-2">
                        <p className="font-bold text-[var(--fg)]">{out.after.tails}</p>
                        <p className="text-[var(--muted-fg)]">Robotic tails left</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface)] p-2">
                        <p className="font-bold text-[var(--fg)]">{out.after.burstiness}</p>
                        <p className="text-[var(--muted-fg)]">Burstiness index</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface)] p-2">
                        <p className="font-bold text-[var(--fg)]">{keywordPreserved}%</p>
                        <p className="text-[var(--muted-fg)]">ATS keywords preserved</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface)] p-2">
                        <p className="font-bold text-[var(--fg)]">{out.after.aiRisk}%</p>
                        <p className="text-[var(--muted-fg)]">AI-risk signal</p>
                      </div>
                    </div>
                  </div>

                  {/* Before/after telemetry */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs">
                    <div>
                      <p className="font-bold uppercase tracking-wide text-[var(--muted-fg)]">Removed this run</p>
                      <p className="mt-1 text-[var(--fg)]">
                        {out.result.counts.watermarks} watermark{out.result.counts.watermarks === 1 ? "" : "s"} ·{" "}
                        {out.result.counts.cliches} cliché{out.result.counts.cliches === 1 ? "" : "s"} ·{" "}
                        {out.result.counts.tails} tail{out.result.counts.tails === 1 ? "" : "s"} ·{" "}
                        {out.result.counts.rotatedOpenings} rotated opening{out.result.counts.rotatedOpenings === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="default">Style before: {out.before.humanScore}/100</Badge>
                      <Badge variant={out.after.humanScore >= out.before.humanScore ? "success" : "warning"}>Style after: {out.after.humanScore}/100</Badge>
                    </div>
                  </div>

                  {/* The cleaned text */}
                  <label className="mt-3 block" htmlFor="hz-out">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">Cleaned text</span>
                    <textarea
                      id="hz-out"
                      readOnly
                      value={out.result.text}
                      rows={8}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-[13px] leading-6 text-[var(--fg)]"
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="compact" onClick={copyText}>
                      {copied === "text" ? "✓ Copied" : "📋 Copy text"}
                    </Button>
                    <Button type="button" variant="outline" size="compact" onClick={downloadText}>
                      ⬇ Download .txt
                    </Button>
                    <Button type="button" size="compact" onClick={pushToChecker}>
                      📊 Rescore in Checker →
                    </Button>
                    <Button type="button" variant="ghost" size="compact" onClick={pushToMaker}>
                      🛠 Open in Maker
                    </Button>
                  </div>
                </div>
              )}

              {tab === "diff" && (
                <div className="mt-3 space-y-2">
                  {out.diff.length === 0 && (
                    <p className="text-sm text-[var(--muted-fg)]">Nothing changed — this text already reads clean.</p>
                  )}
                  {out.diff.map((entry, i) => (
                    <div key={i} className="rounded-[var(--radius-md)] border border-[var(--border)] p-2.5">
                      <p className="text-[13px] leading-5 text-[var(--color-danger)] line-through decoration-1">{entry.before}</p>
                      <p className="text-[13px] leading-5 text-[var(--color-success)]">{entry.after}</p>
                      <ul className="mt-1.5 space-y-0.5 text-[11px] leading-4 text-[var(--muted-fg)]">
                        {entry.notes.map((note, ni) => (
                          <li key={ni}>• {note}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <FaqSection visible heading="Common questions" faqs={FAQS} />
      </div>
    </ToolShell>
  );
}
