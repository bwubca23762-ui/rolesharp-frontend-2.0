"use client";

import { useState } from "react";
import { Button, Card, ToolShell } from "@/components/ui/primitives";
import { FaqSection } from "@/app/seo-blocks";
import ResumeFileUpload from "@/components/tools/ResumeFileUpload";
import { useWorkspaceDraft } from "@/lib/workspace-context";

type ConversionPlan = {
  direction: string;
  removeSections: string[];
  addSections: string[];
  shortenAdvice: string[];
  keepSections: string[];
};

const FAQS: [string, string][] = [
  ["What's the difference between a CV and a resume?", "A CV (curriculum vitae) is a detailed academic document listing all publications, grants, and teaching experience — no page limit. A US resume is 1–2 pages, focused on impact bullets for a specific role. The same content is restructured, not translated."],
  ["Which direction do I need?", "Applying to a US company with an academic CV? Use CV → Resume. Applying to a university or international research role with a resume? Use Resume → CV."],
  ["Does this rewrite my document?", "No. It analyzes your structure and tells you what to move, cut, and expand — you make the changes. This is deliberate: your content stays yours."],
];

const SAMPLE_ACADEMIC_CV = `Dr. Maya Lin
Postdoctoral Research Fellow, Computational Biology
Email: maya.lin@example.edu | Boston, MA

EDUCATION
Ph.D. in Bioinformatics, Example University (2018 - 2023)
Dissertation: Graph Neural Networks for Single-Cell Transcriptomics

PUBLICATIONS (14 Peer-Reviewed Papers)
1. Lin M., et al. (2024) "Scalable scRNA-seq clustering in Python," Nature Methods.
2. Lin M., et al. (2022) "Bayesian batch correction across 1.2M cells," Bioinformatics.

GRANTS & FELLOWSHIPS
- NIH F32 Ruth L. Kirschstein Postdoctoral Fellowship ($210,000, 2023-2025)
- NSF Graduate Research Fellowship (2019-2022)

TEACHING EXPERIENCE
- Head Teaching Assistant, CS 205 Statistical Machine Learning (Spring 2021, 180 students)
- Guest Lecturer, Intro to Python & R for Biologists (Fall 2022)

RESEARCH EXPERIENCE
Postdoctoral Fellow | Example Institute | 2023 - Present
- Built distributed PyTorch and AWS Batch pipelines processing 4.5 TB of genomic sequencing data, reducing model training time by 62%.
- Mentored 5 graduate researchers on reproducible Docker and Nextflow workflows.

REFERENCES
Available upon request (3 faculty references listed).`;

export default function ConverterPage() {
  const { draft } = useWorkspaceDraft();
  const [docText, setDocText] = useState("");
  const [direction, setDirection] = useState<"cv-to-resume" | "resume-to-cv">("cv-to-resume");
  const [plan, setPlan] = useState<ConversionPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  function loadSample() {
    setPlan(null);
    setDirection("cv-to-resume");
    setDocText(SAMPLE_ACADEMIC_CV);
    setErr("");
  }

  function resetAll() {
    setDocText("");
    setPlan(null);
    setErr("");
  }

  async function analyze() {
    if (busy || docText.trim().length < 50) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/tools/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "convert", docText: docText.trim(), direction }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      setPlan(j.plan ?? null);
    } catch {
      setErr("Could not analyze the document.");
    } finally {
      setBusy(false);
    }
  }

  function copyPlan() {
    if (!plan) return;
    const lines = [
      `Direction: ${direction === "cv-to-resume" ? "Academic CV → Industry Resume" : "Resume → Academic CV"}`,
      plan.removeSections.length ? `\nRemove or compress:\n- ${plan.removeSections.join("\n- ")}` : "",
      plan.addSections.length ? `\nAdd sections:\n- ${plan.addSections.join("\n- ")}` : "",
      plan.shortenAdvice.length ? `\nRestructuring advice:\n- ${plan.shortenAdvice.join("\n- ")}` : "",
      plan.keepSections.length ? `\nKeep:\n- ${plan.keepSections.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard?.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <ToolShell
      eyebrow="Free — no account"
      title="CV ↔ Resume conversion planner"
      subtitle="Paste your academic CV or industry resume. Get a structured conversion plan showing which sections to remove, add, and compress."
      workspaceSize="large"
      onLoadSample={loadSample}
      onReset={resetAll}
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT 6 COLS: INPUTS */}
        <Card className="lg:col-span-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <div className="flex flex-wrap gap-1.5">
              {([["cv-to-resume", "Academic CV → Industry Resume"], ["resume-to-cv", "Industry Resume → Academic CV"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDirection(val)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    direction === val
                      ? "bg-[var(--primary)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-fg)] hover:text-[var(--fg)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="compact" onClick={loadSample}>
                ⚡ Sample CV
              </Button>
              {draft?.resumeText && (
                <Button type="button" variant="outline" size="compact" onClick={() => setDocText(draft.resumeText ?? "")}>
                  📄 Active resume
                </Button>
              )}
              <Button type="button" variant="ghost" size="compact" onClick={resetAll}>
                🧹 Clear
              </Button>
            </div>
          </div>

          <ResumeFileUpload onText={(text) => setDocText((current) => current || text)} label="Drag & drop or click — extract text from your PDF, DOCX, or TXT" />
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-bold text-[var(--fg)]">
              Paste or edit your document text ({direction === "cv-to-resume" ? "Academic CV" : "Industry Resume"})
            </span>
            <textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              rows={11}
              maxLength={30_000}
              placeholder="Paste the entire text here — include section headings so they can be identified…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button onClick={() => void analyze()} isLoading={busy} disabled={docText.trim().length < 50}>
              🔄 Build my conversion plan
            </Button>
            <span className="text-xs text-[var(--muted-fg)]">
              {docText.trim() ? `${docText.trim().split(/\s+/).length} words` : "Min 50 characters"}
            </span>
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-[var(--color-danger)]" role="alert">{err}</p>}
        </Card>

        {/* RIGHT 6 COLS: STICKY CONVERSION PLAN OR COMPARISON GUIDE */}
        <Card className="lg:col-span-6 lg:sticky lg:top-24">
          {!plan ? (
            <div>
              <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                What changes during conversion
              </span>
              <h2 className="mt-1.5 text-lg font-extrabold! text-[var(--fg)]">
                {direction === "cv-to-resume" ? "Academic CV → 1–2 Page Industry Resume" : "Industry Resume → Comprehensive Academic CV"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-fg)]">
                Paste your document on the left (or click <strong>⚡ Sample CV</strong>) to get a section-by-section conversion checklist.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-danger)]">
                    {direction === "cv-to-resume" ? "Cut or compress" : "Expand in detail"}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--muted-fg)]">
                    <li>• Full publication bibliographies → Top 2–3 selected papers or link to Google Scholar</li>
                    <li>• Course-by-course teaching lists → 1 line summarizing cohort size &amp; scope</li>
                    <li>• References section → Omit (&ldquo;Available upon request&rdquo; is implied)</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-success)]">
                    {direction === "cv-to-resume" ? "Highlight up front" : "Add academic proof"}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--muted-fg)]">
                    <li>• 3-line industry summary focused on technical &amp; business outcomes</li>
                    <li>• Quantified impact bullets (speedups, dataset scale, cost saved)</li>
                    <li>• Core tools &amp; production skills grouped by category</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={loadSample}>
                  ⚡ Test with Sample Academic CV
                </Button>
                <Button as="a" href="/resume-translator" variant="outline" size="sm">
                  🌍 Country Resume Translator →
                </Button>
                <Button as="a" href="/resume-maker" variant="ghost" size="sm">
                  🛠 Open Manual Maker
                </Button>
              </div>
            </div>
          ) : (
            <div role="status">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
                <h2 className="text-lg font-extrabold! text-[var(--fg)]">Your conversion plan</h2>
                <Button type="button" variant="outline" size="compact" onClick={copyPlan}>
                  {copied ? "✓ Copied" : "📋 Copy plan"}
                </Button>
              </div>

              {plan.removeSections.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--color-danger)]">Remove or compress</h3>
                  <ul className="mt-1.5 grid gap-1 text-sm text-[var(--fg)]">
                    {plan.removeSections.map((s) => (
                      <li key={s}>✗ {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.addSections.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--color-success)]">Add these sections</h3>
                  <ul className="mt-1.5 grid gap-1 text-sm text-[var(--fg)]">
                    {plan.addSections.map((s) => (
                      <li key={s}>+ {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.shortenAdvice.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Restructuring advice</h3>
                  <ul className="mt-1.5 grid gap-1.5 text-sm leading-6 text-[var(--muted-fg)]">
                    {plan.shortenAdvice.map((a, i) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.keepSections.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">Keep these</h3>
                  <p className="mt-1 text-sm text-[var(--muted-fg)]">{plan.keepSections.join(" — ")}</p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-4">
                <Button as="a" href="/resume-maker" size="sm">
                  🛠 Rebuild in Resume Maker →
                </Button>
                <Button as="a" href="/build" variant="outline" size="sm">
                  ✨ Tailor to a Job in AI Builder →
                </Button>
                <Button as="a" href="/checker" variant="ghost" size="sm">
                  📊 Score ATS Readiness
                </Button>
              </div>
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
