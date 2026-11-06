"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Target, Bolt } from "../icons";
import ScoreRing from "@/components/ui/ScoreRing";
import { useToast } from "@/components/ui/Toast";
import { useWorkspaceDraft, WORKSPACE_STORAGE_KEY } from "@/lib/workspace-context";
import CheckerCountryCta from "./checker-country-cta";
import { FaqSection } from "../seo-blocks";
import { COMPANY_GUIDANCE, COMPANY_TYPE_KEYS, type CompanyType } from "@/lib/resume-guidance";
import { Badge, Button, ToolShell } from "@/components/ui/primitives";
import { MethodologyCallout, RelatedWorkflow } from "@/components/marketing";
import PreviewModal from "@/components/ui/PreviewModal";
import { useAutocomplete } from "@/app/build/use-autocomplete";
import CountryPicker from "@/components/ui/CountryPicker";
import { fallbackCountries } from "@/lib/country-codes";
import { savedCountry } from "@/lib/saved-country";
import { trackProductEvent } from "../product-analytics";
import { errorMessage } from "@/lib/error-message";
import { resumeSourceText } from "@/lib/resume-source-text";
import SavedResumePicker from "@/components/tools/SavedResumePicker";
import { CompactResumeSourceCard } from "@/components/tools/CompactResumeSourceCard";
import { evaluateAtsVendorCompatibility } from "@/lib/ats-score";
import { scoreHumanAuthenticity } from "@/lib/ai-humanizer";

const CHECKER_FAQS: [string, string][] = [
  ["How does an ATS resume checker work?", "An ATS resume checker scans your resume the way applicant tracking software does: it extracts your text, matches it against the job's keywords, and checks formatting that machines can read. RoleSharp scores keyword match, section structure, and bullet quality, then lists exactly what to fix."],
  ["What is a good ATS score?", "A good ATS score is 80 or above. Below 60 usually means missing keywords or a layout the parser can't read; 60-79 means you're close but should add role-specific terms and quantified bullets. RoleSharp shows your score and the precise gaps so you know what to change."],
  ["Is the RoleSharp resume checker free?", "Yes. You can check a resume and see your ATS score, keyword gaps, and bullet-level feedback for free, with no watermark. Building a new tailored resume uses your free monthly allowance or a credit; the checker itself is free to use."],
  ["Why did my resume fail the ATS?", "Most resumes fail the ATS for three reasons: missing keywords from the job description, formatting the parser can't read like tables, columns, or images, or vague bullets with no metrics. The checker flags each of these and tells you the specific fix."],
  ["Does the checker work for any country?", "Yes. RoleSharp adapts to local hiring norms — US one-page no-photo resumes, Indian resumes with academic details, German CVs, and more. Pick your country and the checker scores against the right format for that market."],
  ["Which keywords am I missing?", "Paste the job description and the checker extracts the keywords that matter, then shows which already appear in your resume and which are still missing — so you can add the exact terms recruiters and the ATS are scanning for."],
];

const SAMPLE_CHECKER_RESUME = `Alex Morgan
alex.morgan@example.com | +1 (415) 555-0148 | San Francisco, CA | linkedin.com/in/alexmorgan

SUMMARY
Senior Backend Engineer with 6+ years building high-throughput payment and ledger services in TypeScript, Node.js, PostgreSQL, and AWS.

EXPERIENCE
Senior Software Engineer | Fictional Payments | 2022 - Present
• Architected subscription billing retry service in TypeScript and PostgreSQL, reducing involuntary churn by 18% across 140,000 active accounts.
• Optimized checkout API endpoints and Redis cache layers, cutting p95 latency from 420ms to 150ms.
• Responsible for managing weekly on-call rotations and production deployments.
• Worked on improving developer onboarding documentation for backend services.

Software Engineer | Example Systems | 2019 - 2022
• Built automated settlement pipelines in Node.js and Kafka processing $42M in monthly volume with 99.98% uptime.

EDUCATION
B.S. in Computer Science | University of California | 2015 - 2019

SKILLS
TypeScript, Node.js, PostgreSQL, Redis, Kafka, Docker, AWS, REST APIs, Git`;

const SAMPLE_CHECKER_JD = `Senior Backend Engineer — Payments Infrastructure
Requirements:
- 5+ years of experience with TypeScript, Node.js, PostgreSQL, Redis, and Kafka
- Strong experience with Kubernetes, Docker, AWS, and CI/CD pipelines
- Proven track record of improving API latency, payment settlement reliability, and distributed systems observability`;

type Company = { slug: string; name: string; country_code?: string };
type Role = { slug: string; title: string };

function unquantifiedLines(text: string): string[] {
  const hasNumber = (s: string) => /\d/.test(s) || /\b(increased|reduced|grew|saved|doubled|tripled|cut)\b/i.test(s);
  return text
    .split("\n")
    .map((l) => l.replace(/^[\s\-•*▪◦—]+/, "").trim())
    .filter((l) => l.length >= 25 && l.length <= 200 && /\s/.test(l))
    .filter((l) =>
      /^(led|built|managed|developed|created|designed|worked|handled|made|did|sold|wrote|ran|helped|supported|delivered|drove|improved|implemented|coordinated|analy|prepared|processed|answered|cared|gave|maintained|assisted|achieved|responsible)/i.test(l),
    )
    .filter((l) => !hasNumber(l));
}

const CHECK_TIMEOUT_MS = 60_000;

function FlaggedBullets({ bullets }: { bullets: string[] }) {
  const [rewrites, setRewrites] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const { toast } = useToast();

  async function fix(index: number, bullet: string) {
    if (busy !== null) return;
    setBusy(index);
    setErr("");
    try {
      const response = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullet, idempotencyKey: crypto.randomUUID() }),
      });
      const data = (await response.json().catch(() => ({}))) as { improved?: string; error?: string };
      if (response.status === 401 || data.error === "login_required") {
        toast("Log in to use the AI bullet fixer — free.", "info");
        return;
      }
      if (response.status === 402) {
        toast("Out of free fixes for this month — add a credit or a pass.", "info");
        return;
      }
      if (!response.ok || !data.improved) {
        setErr("Could not rewrite that bullet right now. Try again.");
        return;
      }
      setRewrites((prev) => ({ ...prev, [index]: data.improved! }));
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h3>Flagged bullets — fix them with AI</h3>
      <ul className="m-0 list-none space-y-3 p-0">
        {bullets.map((bullet, index) => (
          <li key={index} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <p className="m-0 text-sm leading-6 text-[var(--fg)]">{bullet}</p>
            {rewrites[index] ? (
              <div className="mt-2 border-l-2 border-[var(--primary)] pl-3">
                <p className="m-0 text-sm font-semibold leading-6 text-[var(--fg)]">{rewrites[index]}</p>
                <button
                  type="button"
                  className="link-btn mt-1"
                  onClick={() => {
                    void navigator.clipboard?.writeText(rewrites[index]);
                    toast("Copied — paste it into your resume.", "success");
                  }}
                >
                  Copy rewrite
                </button>
              </div>
            ) : (
              <Button size="compact" variant="outline" className="mt-2" onClick={() => void fix(index, bullet)} disabled={busy !== null} isLoading={busy === index}>
                {busy === index ? "Rewriting…" : "✨ Fix with AI"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {err && <p className="text-sm text-[var(--color-danger)]" role="alert">{err}</p>}
      <p className="mt-2 mb-0 text-xs text-[var(--muted-fg)]">Rewrites are suggestions built from your bullet. Never keep a number you cannot defend.</p>
    </div>
  );
}

export default function Checker() {
  const [resumeText, setResumeText] = useState("");
  const [country, setCountry] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [companyType, setCompanyType] = useState<CompanyType>("general");
  const [companyQ, setCompanyQ] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [roleQ, setRoleQ] = useState("");
  const [roleOpen, setRoleOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [inspectorTab, setInspectorTab] = useState<"overview" | "bullets" | "xray">("overview");
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [companyActive, setCompanyActive] = useState(-1);
  const [roleActive, setRoleActive] = useState(-1);
  const [cardCopied, setCardCopied] = useState(false);
  const { toast } = useToast();

  const { results: companies, setResults: setCompanies } = useAutocomplete<Company>({
    query: companyQ,
    url: `/api/companies/search?q=${encodeURIComponent(companyQ.trim())}`,
    minimumLength: 2,
    enabled: !(company && companyQ === company.name),
  });
  const { results: roles, setResults: setRoles } = useAutocomplete<Role>({
    query: roleQ,
    url: `/api/roles?q=${encodeURIComponent(roleQ.trim())}`,
    enabled: !(role && roleQ === role.title),
  });

  useEffect(() => {
    const nameFor = (code: string) => fallbackCountries().find((entry) => entry.code === code)?.name;
    const apply = (code?: string) => {
      const name = code ? nameFor(code) : undefined;
      if (!code || !name) return false;
      setCountryCode(code);
      setCountry(name);
      return true;
    };
    (async () => {
      const saved = savedCountry();
      if (saved && apply(saved.code)) return;
      try {
        const j = await (await fetch("/api/geo")).json();
        if (j?.detected && apply(j.code)) return;
      } catch {}
      try {
        const region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).region;
        apply(region);
      } catch {}
    })();
  }, []);

  const { draft, updateDraft } = useWorkspaceDraft();
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY) || "null") as
        | { resumeText?: string; jdText?: string; targetCompany?: string; targetRole?: string }
        | null;
      if (saved?.resumeText) setResumeText(saved.resumeText);
      if (saved?.jdText) setJdText(saved.jdText);
      if (saved?.targetCompany) setCompanyQ(saved.targetCompany);
      if (saved?.targetRole) setRoleQ(saved.targetRole);
    } catch {}
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const timeout = setTimeout(() => {
      updateDraft({ resumeText, jdText, targetCompany: companyQ, targetRole: roleQ }, "checker");
    }, 500);
    return () => clearTimeout(timeout);
  }, [draftLoaded, resumeText, jdText, companyQ, roleQ, updateDraft]);

  function loadSample() {
    setResumeText(SAMPLE_CHECKER_RESUME);
    setJdText(SAMPLE_CHECKER_JD);
    setRoleQ("Senior Backend Engineer");
    setCompanyQ("Fictional Payments");
    setErr("");
    toast("Sample resume and job description loaded.", "info");
  }

  function resetAll() {
    setResumeText("");
    setJdText("");
    setRoleQ("");
    setCompanyQ("");
    setCompany(null);
    setRole(null);
    setResult(null);
    setUploadedName("");
    setErr("");
  }

  async function check() {
    if (busy) return;
    setErr("");
    setResult(null);
    if (resumeText.trim().length < 80) {
      trackProductEvent("tool_start_blocked", { context: "checker:resume_too_short" });
      setErr("Paste more resume text before checking.");
      return;
    }
    trackProductEvent("tool_meaningful_start", { context: "checker:check" });
    setBusy(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      const r = await fetch("/api/check-resume", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          country,
          targetCompany: company?.name || companyQ,
          targetRole: role?.title || roleQ,
          roleSlug: role?.slug,
          jdText,
          companyType,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        setErr("Please log in to run the checker.");
        toast("Log in to score your resume.", "info");
        setTimeout(() => {
          window.location.href = "/login?next=/checker";
        }, 1100);
        return;
      }
      if (r.status === 429) {
        setErr(j.error || "Too many checks right now. Please wait a moment and try again.");
        toast("Too many checks. Please wait a moment.", "error");
        return;
      }
      if (!r.ok) setErr(errorMessage(j.error, "Could not check this resume."));
      else {
        setResult(j);
        setInspectorTab("overview");
        trackProductEvent("first_value_view", { context: "checker:scored" });
        toast(`Scored ${j.score}/100`, "success");
      }
    } catch (e: any) {
      setErr(controller.signal.aborted ? "That took too long. Please try again." : e.message);
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  async function uploadResume(file?: File | null) {
    if (!file) return;
    setErr("");
    setResult(null);
    setUploadedName("");
    setUploadBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/check-resume/upload", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Could not read this resume file.");
        toast(j.error || "Could not read that file.", "error");
        return;
      }
      setResumeText(j.text);
      setUploadedName(`${j.filename} — ${j.wordCount} words`);
      toast("Resume text extracted.", "success");
    } catch (e: any) {
      setErr(e.message || "Upload failed.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function loadSavedResume(resumeId: string) {
    setErr("");
    try {
      const r = await fetch(`/api/resume/${resumeId}`, { signal: AbortSignal.timeout(15_000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errorMessage(j?.error, "Could not load that resume."));
      setResumeText(resumeSourceText(j.content));
      setUploadedName(`${j.candidateName || "Saved resume"} — loaded from My Resumes`);
      toast("Resume loaded from your saved resumes.", "success");
    } catch (e: any) {
      setErr(e?.message || "Could not load that resume.");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadResume(file);
  }

  const vendorReport = useMemo(
    () => evaluateAtsVendorCompatibility(resumeText || SAMPLE_CHECKER_RESUME),
    [resumeText],
  );
  const humanCheck = useMemo(
    () => scoreHumanAuthenticity(resumeText || ""),
    [resumeText],
  );
  const wordCount = useMemo(
    () => (resumeText.trim() ? (resumeText.match(/[A-Za-z0-9][A-Za-z0-9+#.%$-]*/g) ?? []).length : 0),
    [resumeText],
  );
  const weakLines = useMemo(() => unquantifiedLines(resumeText), [resumeText]);

  const checkerRail = (
    <>
      {!result ? (
        <div className="card sticky-card">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <div>
              <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                Live ATS Pre-Flight &amp; 5-Vendor X-Ray
              </span>
              <h2 className="mt-1 text-lg font-bold text-[var(--fg)]">
                {resumeText.trim().length > 80 ? "Pre-flight telemetry active" : "Ready to scan your resume"}
              </h2>
            </div>
            <Badge variant={vendorReport.overall === "pass" ? "success" : "warning"}>
              {vendorReport.overall === "pass" ? "5/5 Parsers Ready" : "Parser Warnings"}
            </Badge>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
              <div className="text-lg font-extrabold text-[var(--fg)]">{wordCount}</div>
              <div className="text-[11px] font-semibold uppercase text-[var(--muted-fg)]">Words</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
              <div className="text-lg font-extrabold text-[var(--fg)]">{weakLines.length}</div>
              <div className="text-[11px] font-semibold uppercase text-[var(--muted-fg)]">Unquantified</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
              <div className="text-lg font-extrabold text-[var(--fg)]">{jdText.trim() ? "Yes" : "No"}</div>
              <div className="text-[11px] font-semibold uppercase text-[var(--muted-fg)]">JD Attached</div>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-fg)]">
              5-Vendor ATS Parser Simulation {resumeText.trim().length <= 80 ? "(Sample Preview)" : ""}
            </h3>
            <div className="mt-2 grid gap-2">
              {vendorReport.vendors.map((v) => (
                <div
                  key={v.vendor}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-bold text-[var(--fg)]">{v.vendor}</p>
                    <p className="text-[11px] leading-4 text-[var(--muted-fg)]">
                      {v.notes[0] ?? "Clean single-column text stream."}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      v.verdict === "pass"
                        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                        : v.verdict === "warn"
                          ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                          : "bg-red-500/15 text-red-800 dark:text-red-300"
                    }`}
                  >
                    {v.verdict}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-3">
            <Button type="button" variant="outline" size="sm" onClick={loadSample}>
              ⚡ Load Sample Resume + JD
            </Button>
            <Button as="a" href="/resume-fixer" variant="outline" size="sm">
              🔧 Old Resume Fixer
            </Button>
            <Button as="a" href="/build" variant="ghost" size="sm">
              ✨ AI Builder →
            </Button>
          </div>
        </div>
      ) : (
        <div className="card checker-result">
          <div className="score-hero">
            <ScoreRing score={result.score} size={108} label="ATS" />
            <div>
              <h2>{result.grade}</h2>
              <p className="m-0! text-[var(--muted-fg)]">{result.verdict}</p>
              <div className="row" style={{ marginTop: 8 }}>
                <Badge variant="premium">Confidence {result.confidence}</Badge>
                {humanCheck.humanScore >= 85 && (
                  <Badge variant="success" title={`Human score ${humanCheck.humanScore}% · burstiness ${humanCheck.burstiness} · 0 known AI fingerprints`}>
                    🛡 Bot-Stealth & Human Verified
                  </Badge>
                )}
                {typeof result.percentile === "number" && (
                  <Badge variant="default">Higher than {result.percentile}% of resumes scored here</Badge>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--muted-fg)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  onClick={() => {
                    const params = new URLSearchParams({ s: String(result.score) });
                    (result.breakdown ?? []).slice(0, 3).forEach((b: { label: string; score: number; max: number }, i: number) => {
                      params.set(`c${i + 1}`, `${b.label}-${Math.round((b.score / b.max) * 100)}`);
                    });
                    const url = `${window.location.origin}/score-card?${params.toString()}`;
                    navigator.clipboard
                      ?.writeText(url)
                      .then(() => {
                        setCardCopied(true);
                        setTimeout(() => setCardCopied(false), 2500);
                      })
                      .catch(() => {
                        window.open(url, "_blank");
                      });
                  }}
                >
                  {cardCopied ? "✓ Link copied" : "📋 Copy shareable card link"}
                </button>
              </div>
            </div>
          </div>

          {/* 3-Tab Inspector Switcher */}
          <div role="tablist" aria-label="ATS Report Tabs" className="my-4 flex gap-1 rounded-lg bg-[var(--surface-2)] p-1 text-xs font-semibold">
            {([
              ["overview", "1. Overview & Gaps"],
              ["bullets", `2. Bullet Fixer (${(result.flaggedBullets?.length || weakLines.length) ?? 0})`],
              ["xray", "3. 5-Vendor ATS X-Ray"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={inspectorTab === key}
                onClick={() => setInspectorTab(key)}
                className={`flex-1 rounded-md px-2.5 py-1.5 transition-colors ${
                  inspectorTab === key ? "bg-[var(--surface)] text-[var(--fg)] shadow-sm" : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {inspectorTab === "overview" && (
            <>
              <div className="score-bars">
                {result.breakdown.map((b: any) => (
                  <div key={b.label}>
                    <div className="score-line">
                      <b>{b.label}</b>
                      <span>
                        {b.score}/{b.max}
                      </span>
                    </div>
                    <div className="mini-bar">
                      <span style={{ width: `${(b.score / b.max) * 100}%` }} />
                    </div>
                    <p className="text-[13px] text-[var(--muted-fg)]">{b.note}</p>
                  </div>
                ))}
              </div>
              {!!result.recruiter && (
                <div className="quick-win recruiter-read">
                  <h3>Recruiter read</h3>
                  <p className="recruiter-impression">{result.recruiter.firstImpression}</p>
                  {(["strength", "concern", "question"] as const).map((kind) => {
                    const group = (result.recruiter.notes ?? []).filter((n: any) => n.kind === kind);
                    if (!group.length) return null;
                    const heading =
                      kind === "strength"
                        ? "What made me keep reading"
                        : kind === "concern"
                          ? "What made me hesitate"
                          : "What I would ask you on a call";
                    return (
                      <div key={kind} className="recruiter-group">
                        <h4>{heading}</h4>
                        {group.map((note: any, i: number) => (
                          <div key={i} className={`recruiter-note ${kind}`}>
                            {note.quote && <blockquote className="recruiter-quote">{note.quote}</blockquote>}
                            <p>{note.point}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
              {!!result.quickWins?.length && (
                <div className="quick-win">
                  <h3>Highest-impact fixes</h3>
                  <ol>
                    {result.quickWins.map((w: string) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ol>
                </div>
              )}
              {!!result.missingKeywords?.length && (
                <div>
                  <h3>Missing keywords</h3>
                  <div className="chip-row">
                    {result.missingKeywords.map((k: string) => (
                      <span className="mk-chip" key={k}>
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="checker-columns">
                <div>
                  <h3>Strengths</h3>
                  <ul>
                    {result.strengths.map((s: string) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Fixes</h3>
                  <ul>
                    {result.fixes.map((f: string) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {inspectorTab === "bullets" && (
            <div>
              {!!result.flaggedBullets?.length ? (
                <FlaggedBullets bullets={result.flaggedBullets} />
              ) : weakLines.length > 0 ? (
                <FlaggedBullets bullets={weakLines.slice(0, 6)} />
              ) : (
                <p className="text-sm text-[var(--muted-fg)]">All detected experience bullets already contain measurable impact signals.</p>
              )}
            </div>
          )}

          {inspectorTab === "xray" && (
            <div className="space-y-3">
              <h3>5-Vendor ATS Parser Compatibility</h3>
              <p className="text-[13px] leading-5 text-[var(--muted-fg)]">
                This tab is the summary. The full <a href="/ats-xray" className="font-semibold text-[var(--primary)] underline underline-offset-2">ATS Parser X-Ray</a> studio shows the line-by-line table the parser extracts — every section, reading-order failure, and the JD keyword frequency matrix.
              </p>
              <div className="grid gap-2">
                {vendorReport.vendors.map((v) => (
                  <div key={v.vendor} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--fg)]">{v.vendor}</p>
                      <p className="text-xs text-[var(--muted-fg)]">{v.notes[0] ?? "Parses cleanly with zero structural collisions."}</p>
                    </div>
                    <Badge variant={v.verdict === "pass" ? "success" : "warning"}>{v.verdict.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
              {!!result.checks?.length && (
                <div>
                  <h3 className="mt-4">Detailed structure checks</h3>
                  <div className="checks-grid">
                    {result.checks.map((c: any) => (
                      <div key={c.id} className={`check-row ${c.status}`}>
                        <span>{c.status === "pass" ? "Pass" : c.status === "warn" ? "Check" : "Fix"}</span>
                        <div>
                          <b>{c.label}</b>
                          <p>{c.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <CheckerCountryCta />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button as="a" href="/build" className="flex-1">
              ✨ Tailor in AI Builder →
            </Button>
            <Button as="a" href="/resume-maker" variant="outline">
              🛠 Open in Maker
            </Button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <ToolShell
      eyebrow="ATS resume checker"
      title="Check your resume"
      subtitle="Upload PDF, DOCX, or TXT and see your ATS score, 5-vendor parser readiness, keyword gaps, and AI bullet fixes."
      onLoadSample={loadSample}
      onReset={resetAll}
      helpHref="/checker/help"
      pipelineContext={
        resumeText.trim() ? (
          <span>
            📄 {wordCount} words {roleQ ? `· 🎯 ${roleQ}` : ""}
          </span>
        ) : undefined
      }
    >
      <div className={`checker-grid tool-workspace-grid ${result ? "has-result" : "is-onboarding"}`}>
        <section className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <div className="section-title m-0!">
              <Target size={18} />
              <h2>Resume and application target</h2>
            </div>
          </div>

          <div className="mb-4">
            <CompactResumeSourceCard
              draft={{ ...(draft ?? { resumeText: "", jdText: "", targetCompany: "", targetRole: "", updatedAt: 0 }), resumeText, resumeFileName: uploadedName }}
              onText={(t) => setResumeText(t)}
              renderSavedPicker={() => <SavedResumePicker onSelect={(id) => void loadSavedResume(id)} />}
              renderUpload={() => (
                <label
                  className={`upload-box ${uploadBusy ? "busy" : ""} ${dragOver ? "drag-over" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <input
                    className="file-input-hidden"
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={(e) => uploadResume(e.target.files?.[0])}
                    disabled={uploadBusy}
                  />
                  <span className="upload-icon">
                    <FileText size={18} />
                  </span>
                  <span>
                    <b>{uploadBusy ? "Reading resume..." : uploadedName || (dragOver ? "Drop your file to upload" : "Drag & drop or click — PDF, DOCX, or TXT")}</b>
                    <small>{uploadedName ? "Text extracted. You can edit it in Paste tab." : "Max 5 MB. Extracted in memory for scoring."}</small>
                  </span>
                </label>
              )}
            />
          </div>

          <div className="form-grid">
            <div>
              <label className="label" htmlFor="ck-country">Country</label>
              <CountryPicker
                id="ck-country"
                value={countryCode}
                onChange={(code, name) => {
                  setCountryCode(code);
                  setCountry(name);
                }}
              />
            </div>
            <div style={{ position: "relative" }}>
              <label className="label" htmlFor="ck-company">Company</label>
              {(() => {
                const open = companyOpen && companies.length > 0 && !company;
                const pick = (c: Company) => {
                  setCompany(c);
                  setCompanyQ(c.name);
                  setCompanies([]);
                  setCompanyOpen(false);
                  setCompanyActive(-1);
                };
                return (
                  <>
                    <input
                      id="ck-company"
                      className="field"
                      placeholder="Any company"
                      role="combobox"
                      aria-expanded={open}
                      aria-controls="ck-company-listbox"
                      aria-autocomplete="list"
                      aria-activedescendant={open && companyActive >= 0 ? `ck-company-opt-${companyActive}` : undefined}
                      value={companyQ}
                      onFocus={() => setCompanyOpen(true)}
                      onBlur={() => setTimeout(() => setCompanyOpen(false), 140)}
                      onChange={(e) => {
                        setCompanyQ(e.target.value);
                        setCompany(null);
                        setCompanyOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setCompanyOpen(true);
                          setCompanyActive((i) => Math.min(i + 1, companies.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setCompanyActive((i) => Math.max(i - 1, 0));
                        } else if (e.key === "Enter") {
                          if (open && companyActive >= 0 && companies[companyActive]) {
                            e.preventDefault();
                            pick(companies[companyActive]);
                          }
                        } else if (e.key === "Escape") {
                          setCompanyOpen(false);
                          setCompanyActive(-1);
                        }
                      }}
                    />
                    {open && (
                      <div className="dropdown" role="listbox" id="ck-company-listbox">
                        {companies.map((c, idx) => (
                          <div
                            key={c.slug}
                            role="option"
                            id={`ck-company-opt-${idx}`}
                            aria-selected={companyActive === idx}
                            className={companyActive === idx ? "active" : undefined}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pick(c)}
                          >
                            {c.name} <span className="ml-1 text-[12px] text-[var(--text-faint)]">{c.country_code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div style={{ position: "relative" }}>
              <label className="label" htmlFor="ck-role">Role</label>
              {(() => {
                const open = roleOpen && roles.length > 0 && !role;
                const pick = (r: Role) => {
                  setRole(r);
                  setRoleQ(r.title);
                  setRoles([]);
                  setRoleOpen(false);
                  setRoleActive(-1);
                };
                return (
                  <>
                    <input
                      id="ck-role"
                      className="field"
                      placeholder="Accountant, Data Analyst, Developer"
                      role="combobox"
                      aria-expanded={open}
                      aria-controls="ck-role-listbox"
                      aria-autocomplete="list"
                      aria-activedescendant={open && roleActive >= 0 ? `ck-role-opt-${roleActive}` : undefined}
                      value={roleQ}
                      onFocus={() => setRoleOpen(true)}
                      onBlur={() => setTimeout(() => setRoleOpen(false), 140)}
                      onChange={(e) => {
                        setRoleQ(e.target.value);
                        setRole(null);
                        setRoleOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setRoleOpen(true);
                          setRoleActive((i) => Math.min(i + 1, roles.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setRoleActive((i) => Math.max(i - 1, 0));
                        } else if (e.key === "Enter") {
                          if (open && roleActive >= 0 && roles[roleActive]) {
                            e.preventDefault();
                            pick(roles[roleActive]);
                          }
                        } else if (e.key === "Escape") {
                          setRoleOpen(false);
                          setRoleActive(-1);
                        }
                      }}
                    />
                    {open && (
                      <div className="dropdown" role="listbox" id="ck-role-listbox">
                        {roles.map((r, idx) => (
                          <div
                            key={r.slug}
                            role="option"
                            id={`ck-role-opt-${idx}`}
                            aria-selected={roleActive === idx}
                            className={roleActive === idx ? "active" : undefined}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pick(r)}
                          >
                            {r.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div>
              <label className="label" htmlFor="ck-company-type">Company type</label>
              <select id="ck-company-type" className="field" value={companyType} onChange={(e) => setCompanyType(e.target.value as CompanyType)}>
                {COMPANY_TYPE_KEYS.map((key) => (
                  <option value={key} key={key}>
                    {COMPANY_GUIDANCE[key].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="label" htmlFor="ck-resume-text">Resume text ({wordCount ? `${wordCount} words` : "paste or upload above"})</label>
          <textarea
            id="ck-resume-text"
            className="field checker-textarea"
            rows={6}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your full resume text here."
          />

          <label className="label" htmlFor="ck-jd">Job description (optional — sharpens keyword &amp; role scoring)</label>
          <textarea
            id="ck-jd"
            className="field"
            rows={5}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the target job description here."
          />

          <Button fullWidth onClick={check} isLoading={busy} leftIcon={<Bolt size={16} />}>
            Check resume
          </Button>
          {err && <p className="err" role="alert">{err}</p>}
        </section>

        <aside className="preview-rail">{checkerRail}</aside>
      </div>

      <PreviewModal
        visible={Boolean(result)}
        fabLabel="Open ATS report"
        dialogLabel="ATS report"
        title="ATS report"
        closeLabel="Close report"
      >
        {() => checkerRail}
      </PreviewModal>

      <div className="mt-10">
        <MethodologyCallout
          title="The score is a diagnostic estimate, not an employer decision."
          description="RoleSharp checks extractable text, standard structure, job-term coverage, and evidence quality. Employer systems use different parsers, weights, screening rules, and recruiter judgment."
          points={[
            "Paste one real job description for role-specific feedback",
            "Missing terms should be added only when the resume supports them",
            "Country guidance can be reviewed and overridden",
            "A higher score does not guarantee ranking or an interview",
          ]}
          href="/about#ats-method"
        />
      </div>

      <RelatedWorkflow
        title="Turn the ranked gaps into a reviewable tailored draft."
        description="Send the same resume evidence and job description into the builder. Review each proposed change and keep unsupported requirements out of the final document."
        href="/build"
        cta="Build the tailored draft"
        secondary={{ href: "/checker/help", label: "How the checker works" }}
      />

      <FaqSection heading="ATS resume checker, grader, and keyword scan — common questions" faqs={CHECKER_FAQS} />
    </ToolShell>
  );
}
