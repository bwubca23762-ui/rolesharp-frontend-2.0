"use client";

import { useEffect, useState } from "react";
import { Linkedin, Target, Bolt } from "../icons";
import ScoreRing from "@/components/ui/ScoreRing";
import { useToast } from "@/components/ui/Toast";
import { FaqSection } from "../seo-blocks";
import { ToolShell, Button, Badge } from "@/components/ui/primitives";
import PreviewModal from "@/components/ui/PreviewModal";
import LinkedinSync from "@/components/linkedin/SyncPlan";
import { trackProductEvent } from "../product-analytics";
import { errorMessage } from "@/lib/error-message";
import { useWorkspaceDraft } from "@/lib/workspace-context";

const LINKEDIN_FAQS: [string, string][] = [
  ["What does the LinkedIn checker look for?", "It checks whether your LinkedIn profile has a clear headline, a strong first-person About section, real experience proof, searchable skills, and target-role keywords. It also flags vague phrases and weak positioning that make the profile feel generic."],
  ["Do I need my full LinkedIn URL to use it?", "No. Paste the text from your LinkedIn profile page or exported profile text. The checker reads the content itself, so it can score your headline, About, experience, and skills even without logging into LinkedIn."],
  ["What is a good LinkedIn score?", "A strong LinkedIn score is usually 80 or above. Below 60 often means the headline is generic, the About section is weak or missing, or there is not enough proof in experience. The checker tells you exactly which part is dragging the score down."],
  ["Will this help me get found by recruiters?", "Yes. Recruiters search LinkedIn by role terms, skills, and proof signals. The checker highlights missing keywords, weak headlines, and empty sections so your profile becomes easier to find and more convincing once opened."],
];

const SAMPLE_LINKEDIN_PROFILE = `Headline: Senior Product Manager | B2B SaaS, SQL, Funnel Analytics & Experimentation | Cut Churn 18%

About:
I build B2B payment and subscription workflows that reduce involuntary churn and speed up enterprise onboarding. Over the past 6 years across Fictional Payments and Example Systems, I have partnered with engineering, data science, and finance teams to ship self-serve billing recovery, usage-based pricing, and automated ledger reconciliation.
Core strengths: Product Strategy, SQL, Power BI, A/B Testing, Pricing & Packaging, Stakeholder Alignment.

Experience:
Senior Product Manager — Fictional Payments (2022 - Present)
• Launched automated dunning and smart-retry workflows across 140,000 customer accounts, reducing monthly churn by 18% and recovering $3.4M in ARR.
• Led cross-functional squad of 7 engineers and 2 designers to ship self-serve invoice dispute resolution, cutting billing support tickets by 34%.

Product Manager — Example Systems (2019 - 2022)
• Defined roadmap and SQL KPI dashboards for B2B checkout API, increasing trial-to-paid conversion from 11.2% to 15.8%.

Skills:
Product Management, SQL, Power BI, B2B SaaS, A/B Testing, Churn Reduction, Payments, Roadmap Strategy, Agile, Jira`;

type LinkedinResult = {
  score: number;
  grade: string;
  verdict: string;
  fixes: string[];
  quickWins: string[];
  strengths: string[];
  missingKeywords: string[];
  breakdown: { label: string; score: number; max: number; note: string }[];
  checks: { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }[];
  detected: Record<string, boolean | number | string>;
};

function normalizeLinkedinUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withProtocol = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProtocol);
    if (!/linkedin\.com$/i.test(u.hostname) && !/\.linkedin\.com$/i.test(u.hostname)) return null;
    if (!/^\/in\//i.test(u.pathname)) return null;
    return `https://www.linkedin.com${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

const CHECK_TIMEOUT_MS = 60_000;
const DRAFT_KEY = "rolesharp-linkedin-draft";

export default function LinkedinCheckerPage() {
  const { draft } = useWorkspaceDraft();
  const [profileUrl, setProfileUrl] = useState("");
  const [profileText, setProfileText] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [jdText, setJdText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<LinkedinResult | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const { toast } = useToast();

  const normalizedUrl = normalizeLinkedinUrl(profileUrl);
  const urlError = profileUrl.trim() && !normalizedUrl ? "That doesn't look like a linkedin.com/in/... profile URL." : "";

  function loadSample() {
    setProfileUrl("https://www.linkedin.com/in/alex-morgan-pm");
    setProfileText(SAMPLE_LINKEDIN_PROFILE);
    setTargetRole("Senior Product Manager");
    setTargetCompany("Fictional Payments");
    setErr("");
    toast("Sample LinkedIn profile loaded.", "info");
  }

  function fillFromResume() {
    if (!draft) return;
    if (draft.resumeText) setProfileText(draft.resumeText);
    if (draft.targetRole) setTargetRole(draft.targetRole);
    if (draft.targetCompany) setTargetCompany(draft.targetCompany);
    if (draft.jdText) setJdText(draft.jdText);
    toast("Imported text from your active resume draft.", "info");
  }

  function resetAll() {
    setProfileUrl("");
    setProfileText("");
    setTargetRole("");
    setTargetCompany("");
    setJdText("");
    setResult(null);
    setErr("");
  }

  async function check() {
    if (busy) return;
    setErr("");
    setResult(null);
    if (profileText.trim().length < 120) {
      trackProductEvent("tool_start_blocked", { context: "linkedin:profile_too_short" });
      setErr("Paste more LinkedIn profile text before checking.");
      return;
    }
    trackProductEvent("tool_meaningful_start", { context: "linkedin:check" });
    setBusy(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      const res = await fetch("/api/check-linkedin", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileText, targetRole, targetCompany, jdText }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setErr(json.error || "Too many checks right now. Please wait a moment.");
      } else if (!res.ok) {
        setErr(errorMessage(json.error, "Could not check this LinkedIn profile."));
      } else {
        setResult(json);
        trackProductEvent("first_value_view", { context: "linkedin:scored" });
        toast(`Scored ${json.score}/100`, "success");
      }
    } catch (e: any) {
      setErr(controller.signal.aborted ? "That took too long. Please try again." : e.message || "Check failed.");
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as
        | { profileText?: string; profileUrl?: string; targetRole?: string; targetCompany?: string; jdText?: string }
        | null;
      if (saved?.profileText) setProfileText(saved.profileText);
      if (saved?.profileUrl) setProfileUrl(saved.profileUrl);
      if (saved?.targetRole) setTargetRole(saved.targetRole);
      if (saved?.targetCompany) setTargetCompany(saved.targetCompany);
      if (saved?.jdText) setJdText(saved.jdText);
    } catch {}
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const timeout = setTimeout(() => {
      try {
        if (!profileText.trim()) localStorage.removeItem(DRAFT_KEY);
        else localStorage.setItem(DRAFT_KEY, JSON.stringify({ profileText, profileUrl, targetRole, targetCompany, jdText }));
      } catch {}
    }, 500);
    return () => clearTimeout(timeout);
  }, [draftLoaded, profileText, profileUrl, targetRole, targetCompany, jdText]);

  const wordCount = profileText.trim() ? profileText.trim().split(/\s+/).length : 0;
  const hasHeadlineSignal = /headline:|(\|)/i.test(profileText);
  const hasAboutSignal = /about:|summary:/i.test(profileText) || wordCount > 80;
  const hasMetricsSignal = /\d+%|\$\d+|\b\d+\b/.test(profileText);
  const hasSkillsSignal = /skills:/i.test(profileText) || (profileText.match(/,/g) ?? []).length >= 5;

  const linkedinRail = (
    <>
      {!result ? (
        <div className="card sticky-card">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <div>
              <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                Recruiter Search Readiness
              </span>
              <h2 className="m-0! mt-0.5 text-lg font-bold!">
                {wordCount > 40 ? "Live profile signal check" : "What recruiters scan first"}
              </h2>
            </div>
            <Badge variant={wordCount >= 120 ? "success" : "neutral"}>{wordCount} words</Badge>
          </div>

          <div className="mt-3 grid gap-2">
            {[
              ["Searchable Headline (Role | Skills | Proof)", hasHeadlineSignal],
              ["First-Person About Summary", hasAboutSignal],
              ["Quantified Experience Outcomes (%, $, #)", hasMetricsSignal],
              ["Indexed Skills List (10+ skills)", hasSkillsSignal],
              ["Custom /in/ Handle URL", Boolean(normalizedUrl)],
            ].map(([label, ok]) => (
              <div
                key={label as string}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs"
              >
                <span className="font-semibold text-[var(--fg)]">{label as string}</span>
                <span className={ok ? "font-bold text-[var(--color-success)]" : "text-[var(--muted-fg)]"}>
                  {ok ? "✓ Detected" : "Pending"}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-3">
            <Button type="button" variant="outline" size="sm" onClick={loadSample}>
              ⚡ Load Sample Profile
            </Button>
            <Button as="a" href="/linkedin-headline-generator" variant="outline" size="sm">
              ✨ Headline Generator →
            </Button>
            <Button as="a" href="/build" variant="ghost" size="sm">
              💼 Write LinkedIn About
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="card sticky-card">
            <div className="row between">
              <h2 className="text-lg font-bold" style={{ margin: 0 }}>
                LinkedIn score
              </h2>
              <ScoreRing score={result.score} />
            </div>
            <p className="text-[var(--muted-fg)]">
              <b>{result.grade}.</b> {result.verdict}
            </p>
            <h3>Top fixes</h3>
            {result.quickWins.map((fix) => (
              <p className="text-[13px] text-[var(--muted-fg)]" key={fix}>
                • {fix}
              </p>
            ))}
            {!!result.missingKeywords.length && (
              <p className="text-[13px] text-[var(--muted-fg)]">
                <b>Missing target keywords:</b> {result.missingKeywords.slice(0, 8).join(", ")}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button as="a" href="/linkedin-headline-generator" variant="outline" size="sm">
                ✨ Generate Headlines →
              </Button>
              <Button as="a" href="/build" size="sm">
                💼 Write LinkedIn About →
              </Button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-bold">Score breakdown</h2>
            {result.breakdown.map((item) => (
              <div key={item.label} className="mb-3 last:mb-0">
                <div className="score-row">
                  <span>{item.label}</span>
                  <b>
                    {item.score}/{item.max}
                  </b>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.round((item.score / item.max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 className="text-lg font-bold">Profile checks</h2>
            {result.checks.map((item) => (
              <div className="fix-sample" key={item.id}>
                <p className="text-[var(--muted-fg)]">
                  <b>{item.label}:</b> {item.status.toUpperCase()}
                </p>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );

  return (
    <ToolShell
      eyebrow="LinkedIn checker"
      title="Check your LinkedIn before recruiters do"
      subtitle="Paste your profile text and see what recruiters find weak: headline, About, keywords, proof."
      onLoadSample={loadSample}
      onReset={resetAll}
      helpHref="/linkedin-checker/help"
    >
      <div className={`checker-grid tool-workspace-grid ${result ? "has-result" : "is-onboarding"}`}>
        <section className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <div className="section-title m-0!">
              <Linkedin size={18} />
              <h2>1. Your LinkedIn profile</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="compact" onClick={loadSample}>
                ⚡ Load sample
              </Button>
              {draft?.resumeText && (
                <Button type="button" variant="outline" size="compact" onClick={fillFromResume}>
                  📄 Fill from active resume
                </Button>
              )}
              <Button type="button" variant="ghost" size="compact" onClick={resetAll}>
                🧹 Clear
              </Button>
            </div>
          </div>

          <label className="label">
            LinkedIn profile URL <span className="text-[13px] text-[var(--muted-fg)]">(optional)</span>
          </label>
          <div className="row" style={{ gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <input
              aria-label="LinkedIn profile URL"
              className={`field ${urlError ? "field-error" : ""}`}
              style={{ flex: "1 1 260px", margin: 0 }}
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/your-handle"
              inputMode="url"
              autoComplete="url"
            />
            {normalizedUrl ? (
              <Button
                as="a"
                variant="outline"
                href={normalizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open your LinkedIn profile in a new tab, then copy everything and paste it below"
              >
                Open profile ↗
              </Button>
            ) : null}
          </div>
          {urlError ? (
            <p className="err" role="alert" style={{ marginTop: 6 }}>
              {urlError}
            </p>
          ) : null}

          <div className="section-title" style={{ marginTop: 16 }}>
            <Target size={18} />
            <h2>Target</h2>
          </div>
          <div className="form-grid">
            <div>
              <label className="label">Target role</label>
              <input
                aria-label="Target role"
                className="field"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Product Manager, Data Analyst, Backend Engineer"
              />
            </div>
            <div>
              <label className="label">Target company</label>
              <input
                aria-label="Target company"
                className="field"
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                placeholder="Google, Deloitte, Microsoft"
              />
            </div>
            <div>
              <label className="label">Profile length</label>
              <div className="field readonly-field">{wordCount ? `${wordCount} words` : "No profile text pasted"}</div>
            </div>
          </div>

          <label className="label">LinkedIn profile text</label>
          <textarea
            aria-label="LinkedIn profile text"
            className="field checker-textarea"
            rows={7}
            value={profileText}
            onChange={(e) => setProfileText(e.target.value)}
            placeholder={`Paste your LinkedIn profile text here.\n\nTip: include your headline, About section, experience, skills, and any Featured content.`}
          />

          <label className="label">Job description (optional)</label>
          <textarea
            aria-label="Job description"
            className="field"
            rows={4}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Optional, but this helps the checker judge keyword and positioning match."
          />

          <Button fullWidth onClick={check} isLoading={busy} leftIcon={<Bolt size={16} />}>
            Check LinkedIn profile
          </Button>
          {err && <p className="err" role="alert">{err}</p>}
        </section>

        <aside className="preview-rail">{linkedinRail}</aside>
      </div>

      <PreviewModal
        visible={Boolean(result)}
        fabLabel="Open LinkedIn report"
        dialogLabel="LinkedIn report"
        title="LinkedIn report"
        closeLabel="Close report"
      >
        {() => linkedinRail}
      </PreviewModal>

      <LinkedinSync profileText={profileText} />

      <FaqSection heading="LinkedIn checker — common questions" faqs={LINKEDIN_FAQS} />
    </ToolShell>
  );
}
