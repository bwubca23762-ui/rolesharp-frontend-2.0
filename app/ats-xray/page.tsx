"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, ToolShell } from "@/components/ui/primitives";
import { FaqSection } from "@/app/seo-blocks";
import ResumeFileUpload from "@/components/tools/ResumeFileUpload";
import SavedResumePicker from "@/components/tools/SavedResumePicker";
import { useWorkspaceDraft } from "@/lib/workspace-context";
import { resumeSourceText } from "@/lib/resume-source-text";
import { analyzeAtsXrayAndFrequency, type AtsXrayReport, type ReadingOrderStatus } from "@/lib/ats-xray-parser";

const FAQS: [string, string][] = [
  ["What is an ATS parser actually reading?", "Applicant tracking systems flatten your resume into a text layer, then pattern-match lines into sections: contact, summary, experience, education, skills. The X-Ray table shows exactly which line lands in which section, and where the reading order breaks — a two-column layout that merged, a skills table read as one run-on string, a heading no parser recognizes."],
  ["What is TF-IDF cosine similarity?", "Term Frequency–Inverse Document Frequency weighs a keyword by how often it appears in the job description relative to how rare it is across both documents. The cosine score (0–100%) says how close your resume's keyword profile is to the posting's. It is a comparison, not a verdict — a 40% score with all five must-haves covered can beat a 70% score stuffed with the wrong terms."],
  ["Does this store my resume?", "No. Parsing, scoring, and the matrix all run in your browser on the text you paste or upload. The file upload extracts text and discards the file. Nothing reaches a server unless you save the draft into your own workspace."],
];

const SAMPLE_RESUME = `JORDAN AVERY
Senior Backend Engineer
jordan.avery@example.com | +1 415 555 0101 | San Francisco, CA

PROFESSIONAL SUMMARY
Backend engineer with eight years building payment systems at scale. Cut checkout latency 38% for 12 million monthly requests.

EXPERIENCE
2019 - 2022 | Senior Backend Engineer | Stripe
- Led the ledger migration, cutting reconciliation time 61%.
2022 - Present Staff Engineer, Plaid, led the payments platform team
- Led three teams across the public payments API.
- Automated deploys with Kubernetes and Terraform, cutting release time from 2 days to 2 hours.

TECHNICAL ARSENAL
Go | Python | Postgres | Kubernetes | Terraform

EDUCATION
BSc Computer Science, University of Washington, 2016`;

const SAMPLE_JD = `Staff Backend Engineer

Requirements:
- 8+ years building backend systems in Go or Python
- Deep experience with Kubernetes and Terraform in production
- Strong Postgres performance tuning skills
- Experience leading teams across API platforms
- Kubernetes, Kubernetes, Terraform, Terraform — we run on both

You will need a track record of shipping payment or ledger systems at scale.`;

const STATUS_STYLES: Record<ReadingOrderStatus, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  clean: { label: "Clean read", variant: "success" },
  multi_column_collision: { label: "Column collision", variant: "danger" },
  table_trap: { label: "Table trap", variant: "danger" },
  unparsed_header: { label: "Unknown header", variant: "warning" },
  date_warning: { label: "Detached date", variant: "warning" },
};

export default function AtsXrayPage() {
  const { draft } = useWorkspaceDraft();
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [report, setReport] = useState<AtsXrayReport | null>(null);
  const [tab, setTab] = useState<"parser" | "matrix">("parser");
  const [copiedTerm, setCopiedTerm] = useState("");
  const [err, setErr] = useState("");

  function loadSample() {
    setResumeText(SAMPLE_RESUME);
    setJdText(SAMPLE_JD);
    setReport(null);
    setErr("");
  }

  function resetAll() {
    setResumeText("");
    setJdText("");
    setReport(null);
    setErr("");
  }

  async function loadSavedResume(resumeId: string) {
    setErr("");
    try {
      const r = await fetch(`/api/resume/${resumeId}`, { signal: AbortSignal.timeout(15_000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Could not load that resume.");
      setResumeText(resumeSourceText(j.content));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not load that resume.");
    }
  }

  function run() {
    if (resumeText.trim().length < 80) {
      setErr("Paste at least a few lines of resume text (80+ characters) so the parser has something to read.");
      return;
    }
    setErr("");
    setReport(analyzeAtsXrayAndFrequency(resumeText, jdText.trim() || undefined));
    setTab("parser");
  }

  function copyTemplate(term: string, template: string) {
    navigator.clipboard?.writeText(template).then(() => {
      setCopiedTerm(term);
      setTimeout(() => setCopiedTerm(""), 2000);
    }).catch(() => {});
  }

  const wordCount = useMemo(
    () => (resumeText.trim() ? (resumeText.match(/[A-Za-z0-9][A-Za-z0-9+#.%$'-]*/g) ?? []).length : 0),
    [resumeText],
  );
  const flagged = report ? report.lines.filter((l) => l.readingOrderStatus !== "clean").length : 0;

  return (
    <ToolShell
      eyebrow="Free — no account"
      title="ATS Parser X-Ray & Keyword Frequency Matrix"
      subtitle="See the exact table an ATS parser extracts from your resume — line by line — then count every keyword against the job description. Everything runs in your browser."
      workspaceSize="large"
      onLoadSample={loadSample}
      onReset={resetAll}
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT 6 COLS: WORKBENCH */}
        <Card className="lg:col-span-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              Resume source
            </span>
            <div className="flex flex-wrap gap-1.5">
              {draft?.resumeText && (
                <Button type="button" variant="outline" size="compact" onClick={() => setResumeText(draft.resumeText ?? "")}>
                  📄 Active draft
                </Button>
              )}
              <Button type="button" variant="ghost" size="compact" onClick={resetAll}>
                🧹 Clear
              </Button>
            </div>
          </div>

          <ResumeFileUpload onText={(text) => setResumeText((current) => current || text)} label="Drag & drop or click — extract text from your PDF, DOCX, or TXT" />
          <div className="mt-2">
            <SavedResumePicker onSelect={(id) => void loadSavedResume(id)} />
          </div>

          <label className="mt-3 block" htmlFor="xr-resume-text">
            <span className="mb-1 block text-sm font-bold text-[var(--fg)]">
              Paste or edit your resume text ({wordCount ? `${wordCount} words` : "min 80 characters"})
            </span>
            <textarea
              id="xr-resume-text"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              rows={11}
              maxLength={80_000}
              placeholder="Paste the entire resume text — keep section headings and dates exactly as they appear in your file…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 font-[family-name:var(--font-mono)] text-[13px] leading-6 text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>

          <label className="mt-3 block" htmlFor="xr-jd-text">
            <span className="mb-1 block text-sm font-bold text-[var(--fg)]">
              Job description <span className="font-normal text-[var(--muted-fg)]">(optional — unlocks the frequency matrix)</span>
            </span>
            <textarea
              id="xr-jd-text"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={5}
              maxLength={20_000}
              placeholder="Paste the posting. The matrix counts how many times each keyword appears there versus in your resume…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button onClick={run} disabled={resumeText.trim().length < 80}>
              🔍 Run ATS Parser X-Ray & Frequency Matrix
            </Button>
            <span className="text-xs text-[var(--muted-fg)]">
              {jdText.trim() ? "Parser table + JD matrix" : "Parser table only — add a JD for the matrix"}
            </span>
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-[var(--color-danger)]" role="alert">{err}</p>}
        </Card>

        {/* RIGHT 6 COLS: STICKY INSPECTOR */}
        <Card className="lg:col-span-6 lg:sticky lg:top-24">
          {!report ? (
            <div>
              <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                What the inspector shows
              </span>
              <h2 className="mt-1.5 text-lg font-extrabold! text-[var(--fg)]">The table the machine reads, not the page you see</h2>
              <p className="mt-1 text-sm text-[var(--muted-fg)]">
                An ATS never sees your layout — it sees a flattened text layer. Paste your resume on the left (or click <strong>⚡ Load sample</strong>, which includes a deliberate table trap and a column collision) and the inspector answers two questions:
              </p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Tab 1 — OpenResume-style parser table</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--muted-fg)]">
                    <li>• Every line classified: Contact, Summary, Experience, Education, Skills</li>
                    <li>• Reading-order flags: column collisions, table traps, unknown headers, detached dates</li>
                    <li>• Pass/warn badges for Workday, Greenhouse, Lever, Taleo & iCIMS</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Tab 2 — Resume-Matcher-style frequency matrix</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--muted-fg)]">
                    <li>• Exact counts: e.g. Kubernetes — 4 in the JD / 0 in your resume (missing)</li>
                    <li>• TF-IDF cosine similarity between resume and posting</li>
                    <li>• One-click copyable bullet template for every missing term</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button as="a" href="/checker" variant="outline" size="sm">
                  📊 Full ATS Checker →
                </Button>
                <Button as="a" href="/resume-match" variant="ghost" size="sm">
                  🎯 JD Match & Compare →
                </Button>
              </div>
            </div>
          ) : (
            <div role="status">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
                <h2 className="text-lg font-extrabold! text-[var(--fg)]">Inspector</h2>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant={tab === "parser" ? "primary" : "outline"}
                    size="compact"
                    onClick={() => setTab("parser")}
                  >
                    1. Parser table
                  </Button>
                  <Button
                    type="button"
                    variant={tab === "matrix" ? "primary" : "outline"}
                    size="compact"
                    onClick={() => setTab("matrix")}
                    disabled={!report.matrix.length}
                    title={report.matrix.length ? "" : "Paste a job description on the left to unlock the matrix"}
                  >
                    2. Frequency matrix
                  </Button>
                </div>
              </div>

              {tab === "parser" && (
                <div className="mt-3">
                  {/* Section extraction summary */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {report.sections.map((s) => (
                      <div key={s.section} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-[var(--fg)]">{s.section}</p>
                          <Badge variant={s.found ? "success" : "warning"}>{s.found ? `${s.lineCount}` : "not found"}</Badge>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-[var(--muted-fg)]" title={s.firstLine ?? ""}>
                          {s.firstLine ?? "No line was classified into this section."}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Vendor badges */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {report.vendors.vendors.map((v) => (
                      <Badge key={v.vendor} variant={v.verdict === "pass" ? "success" : "warning"} title={v.notes.join(" ")}>
                        {v.vendor}: {v.verdict.toUpperCase()}
                      </Badge>
                    ))}
                  </div>

                  <p className="mt-3 text-xs font-semibold text-[var(--muted-fg)]">
                    {report.lines.length} lines parsed · {flagged} flagged for reading order · {report.stats.resumeWords} words
                  </p>

                  {/* The parser table */}
                  <div className="mt-2 max-h-[420px] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-[var(--surface-2)]">
                        <tr>
                          <th className="px-2 py-1.5 font-bold text-[var(--fg)]">#</th>
                          <th className="px-2 py-1.5 font-bold text-[var(--fg)]">Section</th>
                          <th className="px-2 py-1.5 font-bold text-[var(--fg)]">Extracted text</th>
                          <th className="px-2 py-1.5 font-bold text-[var(--fg)]">Reading order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.lines.map((line) => {
                          const style = STATUS_STYLES[line.readingOrderStatus];
                          return (
                            <tr key={line.lineNumber} className="border-t border-[var(--hairline)] align-top">
                              <td className="px-2 py-1.5 font-[family-name:var(--font-mono)] text-[var(--muted-fg)]">{line.lineNumber}</td>
                              <td className="px-2 py-1.5 text-[var(--fg)]">{line.detectedSection}</td>
                              <td className="max-w-[240px] px-2 py-1.5 text-[var(--fg)]">
                                <span className="line-clamp-2" title={line.parserNote || line.extractedText}>{line.extractedText}</span>
                              </td>
                              <td className="px-2 py-1.5">
                                <Badge variant={style.variant}>{style.label}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-3">
                    <Button as="a" href="/resume-fixer" variant="outline" size="sm">
                      🔧 Fix flagged bullets →
                    </Button>
                    <Button as="a" href="/build" size="sm">
                      ✨ Rebuild cleanly in the AI Builder →
                    </Button>
                  </div>
                </div>
              )}

              {tab === "matrix" && (
                <div className="mt-3">
                  {report.similarity && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">TF-IDF cosine similarity</p>
                        <p className="text-2xl font-extrabold! text-[var(--fg)]">{report.similarity.score}%</p>
                        <p className="text-[11px] text-[var(--muted-fg)]">How close your keyword profile is to the posting — a comparison, not a verdict.</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="success">Matched {report.stats.matched}</Badge>
                        <Badge variant="warning">Under-indexed {report.stats.underIndexed}</Badge>
                        <Badge variant="danger">Missing {report.stats.missing}</Badge>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 max-h-[440px] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-[var(--surface-2)]">
                        <tr>
                          <th className="px-2 py-1.5 font-bold text-[var(--fg)]">Term</th>
                          <th className="px-2 py-1.5 font-bold text-[var(--fg)]">Category</th>
                          <th className="px-2 py-1.5 font-bold text-[var(--fg)]">JD count</th>
                          <th className="px-2 py-1.5 font-bold text-[var(--fg)]">Resume count</th>
                          <th className="px-2 py-1.5 font-bold text-[var(--fg)]">Status</th>
                          <th className="px-2 py-1.5 font-bold text-[var(--fg)]">Template</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.matrix.map((row) => (
                          <tr key={row.term} className="border-t border-[var(--hairline)] align-top">
                            <td className="px-2 py-1.5 font-semibold text-[var(--fg)]">{row.term}</td>
                            <td className="px-2 py-1.5 text-[var(--muted-fg)]">
                              {row.category === "must_have" ? "Must-have" : row.category === "technical" ? "Technical" : "Domain"}
                            </td>
                            <td className="px-2 py-1.5 font-[family-name:var(--font-mono)] text-[var(--fg)]">{row.jdFrequencyCount}</td>
                            <td className="px-2 py-1.5 font-[family-name:var(--font-mono)] text-[var(--fg)]">{row.resumeFrequencyCount}</td>
                            <td className="px-2 py-1.5">
                              <Badge variant={row.status === "matched" ? "success" : row.status === "under_indexed" ? "warning" : "danger"}>
                                {row.status === "matched" ? "Matched" : row.status === "under_indexed" ? "Under-indexed" : "Missing"}
                              </Badge>
                            </td>
                            <td className="px-2 py-1.5">
                              {row.suggestedBulletTemplate ? (
                                <button
                                  type="button"
                                  onClick={() => copyTemplate(row.term, row.suggestedBulletTemplate ?? "")}
                                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-bold text-[var(--primary)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
                                >
                                  {copiedTerm === row.term ? "✓ Copied" : "📋 Copy template"}
                                </button>
                              ) : (
                                <span className="text-[var(--muted-fg)]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-[var(--muted-fg)]">
                    Counts use the same tokenizer as the ATS score. Templates carry a <strong>[X%]</strong> slot for your real number — RoleSharp never invents the metric.
                  </p>
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
