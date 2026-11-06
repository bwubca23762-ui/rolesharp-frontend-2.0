"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, FileText, Target, Bolt } from "../icons";
import { FaqSection } from "../seo-blocks";
import { extractLinkedinUrl } from "@/lib/contact-links";
import { Badge, Button, ToolShell } from "@/components/ui/primitives";
import { MethodologyCallout, RelatedWorkflow } from "@/components/marketing";
import PreviewModal from "@/components/ui/PreviewModal";
import CountryPicker from "@/components/ui/CountryPicker";
import { savedCountry } from "@/lib/saved-country";
import { trackProductEvent } from "../product-analytics";
import SavedResumePicker from "@/components/tools/SavedResumePicker";
import { resumeSourceText } from "@/lib/resume-source-text";
import { errorMessage } from "@/lib/error-message";
import { useWorkspaceDraft } from "@/lib/workspace-context";

const CHECK_TIMEOUT_MS = 60_000;

type CheckResult = {
  score: number;
  grade: string;
  verdict: string;
  fixes: string[];
  quickWins: string[];
  missingKeywords: string[];
  detected: { linkedin?: boolean };
  breakdown: { label: string; score: number; max: number; note: string }[];
  checks: { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }[];
};

const SAMPLE_WEAK_RESUME = `Jordan Taylor
jordan.taylor@example.com | +1 (312) 555-0192 | Chicago, IL

EXPERIENCE
Operations & Data Coordinator | Example Retail Group | 2021 - Present
- Responsible for managing weekly inventory spreadsheets and vendor order tracking.
- Worked on improving the monthly financial reconciliation process with accounting.
- Helped onboard new warehouse coordinators and answered daily support tickets.
- Assisted with SQL reporting queries for regional store managers.

EDUCATION
B.B.A. in Supply Chain Management | State University | 2017 - 2021

SKILLS
Excel, SQL, Inventory Management, Vendor Relations, Reporting`;

function weakBulletSamples(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => /^(responsible for|worked on|helped|assisted|managed|handled|did|made|created|built|developed|supported)/i.test(line))
    .filter((line) => !/\d|%|\$|₹|users|customers|clients|tickets|projects|hours|days|revenue|accuracy|saved|reduced|increased/i.test(line))
    .slice(0, 6);
}

function rewriteHint(line: string) {
  const clean = line.replace(/^(responsible for|worked on|helped with|assisted with|helped|assisted|did|made)\s+/i, "").replace(/\.$/, "");
  const action = /^(built|created|developed|managed|handled|supported|improved|reduced|increased|delivered|led)/i.test(clean)
    ? clean
    : `Delivered ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
  return `${action} for [scope], improving [result] by [X%].`;
}

export default function ResumeFixer() {
  const { draft, loaded, updateDraft } = useWorkspaceDraft();
  const draftInitialized = useRef(false);
  const [resumeText, setResumeText] = useState("");
  const [country, setCountry] = useState("United States");
  const [countryCode, setCountryCode] = useState("US");

  useEffect(() => {
    const saved = savedCountry();
    if (saved?.code && saved.code !== countryCode) {
      setCountryCode(saved.code);
      if (saved.name) setCountry(saved.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded || draftInitialized.current) return;
    draftInitialized.current = true;
    if (draft?.resumeText) setResumeText((current) => current || draft.resumeText || "");
  }, [loaded, draft]);

  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const samples = useMemo(() => weakBulletSamples(resumeText || SAMPLE_WEAK_RESUME), [resumeText]);

  function loadSample() {
    setResumeText(SAMPLE_WEAK_RESUME);
    setRole("Senior Operations Analyst");
    setCompany("Fictional Logistics");
    setJdText("Seeking a Senior Operations Analyst experienced in SQL, Power BI, vendor SLA tracking, process automation, and month-end reconciliation.");
    setErr("");
  }

  function resetAll() {
    setResumeText("");
    setRole("");
    setCompany("");
    setJdText("");
    setResult(null);
    setErr("");
  }

  function applySuggestedRewrite(originalBullet: string, replacement: string) {
    setResumeText((current) => {
      const base = current.trim() ? current : SAMPLE_WEAK_RESUME;
      return base.replace(originalBullet, replacement);
    });
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

  async function upload(file?: File | null) {
    if (!file) return;
    setErr("");
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/check-resume/upload", { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS), method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not read that file.");
      setResumeText(json.text);
    } catch (e: any) {
      setErr(e?.name === "TimeoutError" ? "That took too long. Please try again." : e.message || "Upload failed.");
    } finally {
      setBusy("");
    }
  }

  async function check() {
    if (busy) return;
    setErr("");
    setResult(null);
    if (resumeText.trim().length < 80) {
      trackProductEvent("tool_start_blocked", { context: "fixer:resume_too_short" });
      setErr("Upload or paste more resume text before fixing.");
      return;
    }
    trackProductEvent("tool_meaningful_start", { context: "fixer:check" });
    setBusy("check");
    try {
      updateDraft({ resumeText, jdText, targetCompany: company, targetRole: role }, "fixer");
      const res = await fetch("/api/check-resume", {
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, country, targetCompany: company, targetRole: role, jdText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(errorMessage(json.error, "Could not check this resume."));
      setResult(json);
      trackProductEvent("first_value_view", { context: "fixer:scored" });
    } catch (e: any) {
      setErr(e?.name === "TimeoutError" ? "That took too long. Please try again." : errorMessage(e?.message, "Check failed."));
    } finally {
      setBusy("");
    }
  }

  function openMaker() {
    try {
      localStorage.setItem(
        "rolesharp-fixer-source",
        JSON.stringify({ resumeText, role, company, jdText, country, linkedin: extractLinkedinUrl(resumeText) }),
      );
    } catch {}
    window.location.href = "/resume-maker";
  }

  const projectedScore = result ? Math.min(96, result.score + Math.max(8, samples.length * 4)) : null;

  const fixerRail = (
    <>
      <div className="card sticky-card">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-3">
          <div>
            <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              Live Repair Plan
            </span>
            <h2 className="m-0! mt-0.5 text-lg font-bold!">
              {result ? "Ranked fixes & score delta" : "Weak-bullet scanner active"}
            </h2>
          </div>
          {result && (
            <div className="flex items-center gap-1.5">
              <Badge variant={result.score >= 75 ? "success" : "warning"}>{result.score}/100</Badge>
              {projectedScore && <Badge variant="primary">→ ~{projectedScore} after fixes</Badge>}
            </div>
          )}
        </div>

        {!result ? (
          <div className="mt-3">
            <p className="text-sm text-[var(--muted-fg)]">
              {resumeText.trim().length > 80
                ? `Detected ${samples.length} duty-style bullets without metrics. Click "Find fixes" on the left for your full score and keyword plan.`
                : "Upload or paste your old resume on the left (or click ⚡ Sample) to scan weak bullets and missing keywords."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={loadSample}>
                ⚡ Load Sample Weak Resume
              </Button>
              <Button as="a" href="/checker" variant="ghost" size="sm">
                📊 Full ATS Checker
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-[var(--muted-fg)]">
              <b>{result.grade}.</b> {result.verdict}
            </p>
            <h3>Top fixes</h3>
            {result.quickWins.map((fix) => (
              <p className="text-[13px] text-[var(--muted-fg)]" key={fix}>
                • {fix}
              </p>
            ))}
            {!result.detected.linkedin && (
              <p className="text-[13px] text-[var(--muted-fg)]">
                <b>LinkedIn:</b> Add a real `linkedin.com/in/...` profile if yours is current.
              </p>
            )}
            {!!result.missingKeywords.length && (
              <p className="text-[13px] text-[var(--muted-fg)]">
                <b>Missing keywords:</b> {result.missingKeywords.slice(0, 10).join(", ")}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={openMaker} leftIcon={<FileText size={16} />} className="flex-1">
                🛠 Rebuild in Maker
              </Button>
              <Button as="a" href="/build" variant="outline">
                ✨ Tailor in AI Builder
              </Button>
            </div>
          </div>
        )}
      </div>

      {!!samples.length && (
        <div className="card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0! text-base font-bold!">
              Bullet repairs {resumeText.trim().length <= 80 ? "(Sample preview)" : `(${samples.length})`}
            </h2>
            <span className="text-xs text-[var(--muted-fg)]">Fill `[X%]` with your real metric</span>
          </div>
          {samples.map((sample) => {
            const suggested = rewriteHint(sample);
            return (
              <div className="mt-3 grid gap-2" key={sample}>
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-fg)]">Was</div>
                  <p className="mt-1 text-sm text-[var(--muted-fg)]">{sample}</p>
                </div>
                <div className="rounded-md border border-[var(--primary)]/40 bg-[var(--color-primary-50)] dark:bg-[var(--primary)]/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Suggested impact template</span>
                    <button
                      type="button"
                      onClick={() => applySuggestedRewrite(sample, suggested)}
                      className="text-xs font-bold text-[var(--primary)] hover:underline"
                    >
                      ✓ Apply to resume text
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-[var(--fg)]">{suggested}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result && (
        <div className="card">
          <h2 className="text-lg font-bold">Score breakdown</h2>
          {result.breakdown.map((b) => (
            <div className="score-row" key={b.label}>
              <span>{b.label}</span>
              <b>
                {b.score}/{b.max}
              </b>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <ToolShell
      eyebrow="Resume fixer"
      title="Fix your old resume"
      subtitle="Upload it, see what's hurting the score, repair passive bullets, and send starter content to the maker."
      onLoadSample={loadSample}
      onReset={resetAll}
      helpHref="/resume-fixer/help"
    >
      <div className={`checker-grid tool-workspace-grid ${result ? "has-result" : "is-onboarding"}`}>
        <section className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <div className="section-title m-0!">
              <Upload size={18} />
              <h2>1. Old resume &amp; target</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="compact" onClick={loadSample}>
                ⚡ Load sample weak resume
              </Button>
              <Button type="button" variant="ghost" size="compact" onClick={resetAll}>
                🧹 Clear
              </Button>
            </div>
          </div>

          <label
            className="upload-box"
            onDrop={(e) => {
              e.preventDefault();
              upload(e.dataTransfer.files?.[0]);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              className="file-input-hidden"
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <Upload size={22} />
            <span className="upload-box-copy">
              <b>{busy === "upload" ? "Reading..." : "Upload PDF, DOCX, or TXT"}</b>
              <span className="mt-0.5 block text-[12px] leading-[1.4] text-[var(--muted-fg)]">Or pick a saved resume / paste text below.</span>
            </span>
          </label>

          <SavedResumePicker onSelect={(id) => void loadSavedResume(id)} />
          <label className="label">Resume text</label>
          <textarea
            aria-label="Resume text"
            className="field tall"
            rows={7}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your old resume text here..."
          />

          <div className="section-title">
            <Target size={18} />
            <h2>Target</h2>
          </div>
          <div className="form-grid">
            <div>
              <label className="label" htmlFor="fixer-country">Country</label>
              <CountryPicker
                id="fixer-country"
                value={countryCode}
                onChange={(code, name) => {
                  setCountryCode(code);
                  setCountry(name);
                }}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <input aria-label="Target role" className="field" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Software Engineer" />
            </div>
            <div>
              <label className="label">Company</label>
              <input aria-label="Target company" className="field" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Google, TCS, Deloitte..." />
            </div>
          </div>
          <label className="label">Job description</label>
          <textarea
            aria-label="Job description"
            className="field"
            rows={4}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Optional, but it makes keyword fixes much sharper."
          />
          <Button fullWidth onClick={check} isLoading={busy === "check"} disabled={!!busy} leftIcon={<Bolt size={16} />}>
            {busy === "check" ? "Checking..." : "Find fixes"}
          </Button>
          {err && <p className="err" role="alert">{err}</p>}
        </section>

        <aside className="preview-rail">{fixerRail}</aside>
      </div>

      <PreviewModal
        visible={Boolean(result)}
        fabLabel="Open fix plan"
        dialogLabel="Fix plan"
        title="Fix plan"
        closeLabel="Close fix plan"
      >
        {() => fixerRail}
      </PreviewModal>

      <div className="mt-10">
        <MethodologyCallout
          title="Repairs should strengthen supplied evidence, not manufacture it."
          description="The fixer ranks parseability, job-term, section, and bullet-quality issues. A suggested metric placeholder is a prompt to add a real result—not permission to invent one."
          points={[
            "Original resume evidence remains the factual boundary",
            "Job-description terms are relevant only when supportable",
            "Score movement is diagnostic rather than predictive",
            "Every rebuilt bullet remains editable before export",
          ]}
          href="/about#evidence-policy"
        />
      </div>

      <RelatedWorkflow
        title="Rebuild only the parts that need changing."
        description="Carry the extracted evidence and ranked fixes into the resume maker, then review the document before exporting it for a real application."
        href="/resume-maker"
        cta="Rebuild in the resume maker"
        secondary={{ href: "/resume-fixer/help", label: "Read the fixer guide" }}
      />

      <FaqSection
        heading="Resume fixer — common questions"
        faqs={[
          ["Can I fix my old resume without rewriting it from scratch?", "Yes. Upload your existing resume and the fixer shows exactly what is lowering the score: missing keywords, bullets without measurable results, weak sections, and format risks. You fix only what matters instead of starting over."],
          ["Why is my old resume getting rejected by ATS?", "Most old resumes fail on keyword mismatch with the job post, unquantified duty-style bullets, and layouts ATS parsers cannot read. The fixer scores all three and ranks the highest-impact repairs first."],
          ["What file types can I upload?", "PDF, DOCX, or plain pasted text. The checker reads the content itself, so even an export from an old builder or LinkedIn works."],
          ["Is the resume fixer free?", "Yes. Checking an old resume and seeing the score, missing keywords, and fix list is free. Rebuilding with the AI builder uses your free monthly resume allowance."],
        ]}
      />
    </ToolShell>
  );
}
