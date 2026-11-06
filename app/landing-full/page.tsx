"use client";

import React, { useState } from "react";

/* =========================================================================
   STANDALONE LIMITS & HELPERS (Mirrors @/lib/limits for Canvas preview)
   ========================================================================= */
const DEFAULT_FREE_MONTHLY_LIMIT = 1;
const DEFAULT_STUDENT_MONTHLY_LIMIT = 2;
const DEFAULT_PREMIUM_MONTHLY_LIMIT = 15;

function tailoredResumes(count: number): string {
  return `${count} tailored ${count === 1 ? "resume" : "resumes"}`;
}

/* =========================================================================
   INLINE ICONS (Self-contained, zero missing dependency risk, a11y safe)
   ========================================================================= */
function CheckIcon({ className = "w-4 h-4 text-emerald-500", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className = "w-4 h-4 text-rose-500", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SparklesIcon({ className = "w-4 h-4", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function ShieldIcon({ className = "w-4 h-4", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ArrowRightIcon({ className = "w-4 h-4", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function BriefcaseIcon({ className = "w-4 h-4", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function MicIcon({ className = "w-4 h-4", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function GraduationCapIcon({ className = "w-4 h-4", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* =========================================================================
   DATA PRESETS FOR INTERACTIVE EVIDENCE AUDIT & DEMO STAGE
   ========================================================================= */
const AUDIT_PRESETS = [
  {
    id: "infra",
    label: "Cloud & Infra Eng",
    file: "evidence_grounding_audit.diff",
    rawSource: "Moved services from AWS EC2 to Kubernetes cluster (8 microservices total). Cut p99 deploy times from 42 mins to 6 mins during Q3.",
    hallucinated: '- "Spearheaded enterprise cloud migration, driving 340% revenue growth across 12 countries in 3 months."',
    hallucinatedReason: "Fabricated metric and inflated business scope. Causes immediate rejection during recruiter reference checks.",
    grounded: '+ "Migrated 8 microservices from EC2 to Kubernetes, cutting p99 deploy times from 42m to 6m and zeroing downtime during Q3 releases."',
    groundedReason: "Strictly verified against your uploaded project commits and team size. ATS keywords matched with zero hallucination.",
    keywords: ["Kubernetes", "EC2", "Microservices", "CI/CD", "Zero-Downtime"],
  },
  {
    id: "pm",
    label: "Product Manager",
    file: "pm_funnel_evidence.diff",
    rawSource: "Led checkout flow redesign with 3 engineers. Reduced 3-step form to 1-page express checkout; cart drop-off fell from 64% to 46% over 140k monthly sessions.",
    hallucinated: '- "Directed global monetization strategy across 45M users, unlocking $18.4M in net-new ARR within 60 days."',
    hallucinatedReason: "Invented ARR dollar figure and 45M user count not present anywhere in source resume.",
    grounded: '+ "Redesigned 3-step checkout into a single-page express flow with a 3-engineer squad, reducing cart abandonment from 64% to 46% across 140k monthly sessions."',
    groundedReason: "Preserves exact 140k session denominator and 18-percentage-point drop-off improvement while surfacing PM keywords.",
    keywords: ["Conversion Funnel", "Checkout Optimization", "Cross-Functional Leadership", "A/B Metrics"],
  },
  {
    id: "ml",
    label: "AI / Data Engineer",
    file: "rag_pipeline_audit.diff",
    rawSource: "Built hybrid BM25 + dense vector retrieval over 50,000 internal support docs using pgvector. Citation accuracy improved from 85.8% to 98.9%.",
    hallucinated: '- "Architected proprietary foundation LLM from scratch, outperforming GPT-4 by 28% across enterprise benchmarks."',
    hallucinatedReason: "Falsely claims pre-training a foundation model instead of building a RAG retrieval pipeline.",
    grounded: '+ "Engineered hybrid BM25 and pgvector retrieval pipeline across 50,000 support documents, raising grounded citation accuracy from 85.8% to 98.9%."',
    groundedReason: "Highlights high-demand RAG, pgvector, and hybrid search skills using your exact verified benchmark numbers.",
    keywords: ["RAG", "pgvector", "Hybrid Search", "BM25", "Citation Grounding"],
  },
] as const;

const DAILY_MATCH_ROLES = [
  {
    id: "stripe",
    title: "Staff Infrastructure Eng",
    company: "Stripe",
    location: "Remote (US)",
    match: 94,
    salary: "$210k - $260k",
    remote: true,
    bullets: [
      "Kubernetes & Terraform confirmed",
      "High-scale distributed systems evidence",
    ],
    tailoredPreview: "Re-ranked 3 Kubernetes & Terraform reliability bullets to top of Experience; aligned p99 latency metrics with Stripe Core Infrastructure rubric.",
  },
  {
    id: "linear",
    title: "Senior Backend Engineer",
    company: "Linear",
    location: "San Francisco / Remote",
    match: 91,
    salary: "$190k - $235k",
    remote: true,
    bullets: [
      "Node.js, TypeScript & GraphQL verified",
      "Sync engine architectural experience",
    ],
    tailoredPreview: "Highlighted real-time state synchronization and TypeScript schema design bullets; formatted in single-column ATS hierarchy.",
  },
  {
    id: "vercel",
    title: "Full-Stack Platform Eng",
    company: "Vercel",
    location: "Remote (Worldwide)",
    match: 89,
    salary: "$180k - $220k",
    remote: true,
    bullets: [
      "Next.js App Router & Edge Runtime",
      "Postgres query optimization",
    ],
    tailoredPreview: "Elevated Next.js App Router migration and PostgreSQL indexing metrics to match Vercel DX Platform requirements.",
  },
] as const;

const INTERVIEW_QUESTIONS = [
  {
    id: "q1",
    category: "Technical Deep-Dive",
    question: '"I noticed on your resume you led a database migration reducing latency by 45%. What was your rollback plan if the replication lag exceeded SLA?"',
    rubric: [
      { label: "Situation & Context", score: "96%" },
      { label: "Technical Trade-offs", score: "94%" },
      { label: "Quantified Outcome", score: "92%" },
    ],
    coaching: "RoleSharp analyzes your voice answer for clarity, STAR format, and technical grounding — verifying your spoken claims match your written resume bullets.",
  },
  {
    id: "q2",
    category: "System Architecture",
    question: '"You documented cutting Kubernetes p99 deploy times from 42m to 6m. Which bottleneck dominated the original 42-minute pipeline?"',
    rubric: [
      { label: "Root-Cause Specificity", score: "95%" },
      { label: "CI/CD Mechanics", score: "93%" },
      { label: "Concise Delivery", score: "91%" },
    ],
    coaching: "Flags vague hand-waving and prompts you to cite concrete container layer caching, readiness probes, and canary rollout stages.",
  },
  {
    id: "q3",
    category: "Behavioral & Ownership",
    question: '"Tell me about a time you pushed back on an unrealistic engineering deadline when production stability was at risk."',
    rubric: [
      { label: "STAR Structure", score: "94%" },
      { label: "Stakeholder Empathy", score: "90%" },
      { label: "Zero Filler Words", score: "98%" },
    ],
    coaching: "Tracks pacing, filler words, and measurable risk mitigation so your leadership examples sound grounded and executive-ready.",
  },
] as const;

const SALARY_BANDS = {
  mid: { label: "L4 • Mid-Level", p25: "$128,000", median: "$154,000", p90: "$185,000", sample: "14,200+ verified postings" },
  senior: { label: "L5 • Senior", p25: "$145,000", median: "$178,000", p90: "$225,000", sample: "28,400+ verified postings" },
  staff: { label: "L6 • Staff / Lead", p25: "$185,000", median: "$224,000", p90: "$278,000", sample: "9,100+ verified postings" },
} as const;

/* =========================================================================
   MAIN COMPONENT: INTERACTIVE LANDING PAGE PREVIEW
   ========================================================================= */
export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [showMatrix, setShowMatrix] = useState(false);
  const [activeDemoTab, setActiveDemoTab] = useState<"dailyMatches" | "ats" | "interview" | "match" | "tailor" | "salary">("dailyMatches");
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  // Interactive states
  const [selectedAuditPreset, setSelectedAuditPreset] = useState<number>(0);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("stripe");
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState<number>(0);
  const [selectedSalaryLevel, setSelectedSalaryLevel] = useState<"mid" | "senior" | "staff">("senior");
  const [activeModal, setActiveModal] = useState<{ title: string; route: string; description: string } | null>(null);

  const priceMonthly = "$12";
  const priceYearly = "$79";
  const savingsPercent = 45;

  const currentAudit = AUDIT_PRESETS[selectedAuditPreset];
  const currentQuestion = INTERVIEW_QUESTIONS[selectedQuestionIdx];
  const currentSalary = SALARY_BANDS[selectedSalaryLevel];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const openRouteAction = (route: string, title: string, description: string) => {
    if (route === "/daily-matches") {
      setActiveDemoTab("dailyMatches");
      scrollToSection("interactive-demo");
      return;
    }
    if (route === "/checker") {
      setActiveDemoTab("ats");
      scrollToSection("interactive-demo");
      return;
    }
    if (route === "/interview-prep") {
      setActiveDemoTab("interview");
      scrollToSection("interactive-demo");
      return;
    }
    if (route === "/salaries") {
      setActiveDemoTab("salary");
      scrollToSection("interactive-demo");
      return;
    }
    if (route === "/pricing") {
      scrollToSection("plans");
      return;
    }
    if (route === "/students") {
      scrollToSection("student-access");
      setActiveModal({ title, route, description });
      return;
    }
    setActiveModal({ title, route, description });
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white dark:bg-[#0c0d0e] dark:text-zinc-100 dark:selection:bg-white dark:selection:text-zinc-900">
        
        {/* -------------------------------------------------------------
            ACT 0: SMART TOP ANNOUNCEMENT BAR
            ------------------------------------------------------------- */}
        <aside aria-label="Announcements and offers" className="border-b border-zinc-200 bg-zinc-50/90 px-4 py-2.5 text-xs backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                NEW
              </span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                <strong>Daily Matches &amp; Evidence-Backed Discovery</strong> is live in Premium — curated job suggestions matched directly to your verified resume bullets.
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => scrollToSection("student-access")}
                className="flex items-center gap-1.5 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <GraduationCapIcon size={14} />
                <span>Students: Free 6-Month Pass</span>
              </button>
              <span className="hidden text-zinc-300 sm:inline dark:text-zinc-700">•</span>
              <button
                type="button"
                onClick={() => scrollToSection("plans")}
                className="text-zinc-900 underline underline-offset-2 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-300"
              >
                Zero-Subscription Passes →
              </button>
            </div>
          </div>
        </aside>

        {/* -------------------------------------------------------------
            STICKY NAVIGATION HEADER
            ------------------------------------------------------------- */}
        <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#0c0d0e]/85">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="flex items-center gap-2.5 text-base font-black tracking-tight text-zinc-900 dark:text-white"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                  <ShieldIcon size={15} />
                </span>
                <span>RoleSharp</span>
                <span className="hidden rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-600 sm:inline-block dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  TRUTH ENGINE
                </span>
              </button>

              <nav aria-label="Primary page sections" className="hidden items-center gap-5 text-xs font-semibold text-zinc-600 md:flex dark:text-zinc-400">
                <button type="button" onClick={() => scrollToSection("evidence-audit")} className="transition-colors hover:text-zinc-900 dark:hover:text-white">Evidence Audit</button>
                <button type="button" onClick={() => scrollToSection("interactive-demo")} className="transition-colors hover:text-zinc-900 dark:hover:text-white">Live Demo</button>
                <button type="button" onClick={() => scrollToSection("suite")} className="transition-colors hover:text-zinc-900 dark:hover:text-white">Platform Suite</button>
                <button type="button" onClick={() => scrollToSection("plans")} className="transition-colors hover:text-zinc-900 dark:hover:text-white">Fixed-Term Passes</button>
                <button type="button" onClick={() => scrollToSection("student-access")} className="transition-colors hover:text-zinc-900 dark:hover:text-white">Students ($0)</button>
                <button type="button" onClick={() => scrollToSection("faq")} className="transition-colors hover:text-zinc-900 dark:hover:text-white">FAQ</button>
              </nav>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {darkMode ? "☀ Light" : "☾ Dark"}
              </button>
              <button
                type="button"
                onClick={() => openRouteAction("/resume-fixer", "Upload & Fix Resume Free", "Upload your PDF or DOCX resume to run RoleSharp's deterministic ATS parser and anti-hallucination evidence audit.")}
                className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                Fix Resume Free →
              </button>
            </div>
          </div>
        </header>

        <main>
          {/* -------------------------------------------------------------
              ACT 1: HERO & EVIDENCE INSPECTOR
              ------------------------------------------------------------- */}
          <section className="relative overflow-hidden border-b border-zinc-200 py-16 sm:py-24 md:py-28 dark:border-zinc-800">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100 via-transparent to-transparent opacity-70 dark:from-zinc-900 dark:opacity-40" />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3.5 py-1 text-xs font-semibold text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-200">
                  <ShieldIcon size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Anti-Hallucination Career Infrastructure</span>
                </div>

                <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl dark:text-white">
                  Stop getting screened out by invented metrics.
                </h1>

                <p className="mt-6 text-lg leading-8 text-zinc-600 sm:text-xl dark:text-zinc-400">
                  RoleSharp aligns your real career evidence with employer ATS requirements — without inventing bullets, faking credentials, or locking you into recurring subscriptions.
                </p>

                {/* Main Action CTAs */}
                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openRouteAction("/resume-fixer", "Upload & Fix Resume Free", "Upload your existing PDF or DOCX resume to receive a deterministic ATS parse score and line-by-line evidence fixes.")}
                    className="w-full rounded-full bg-zinc-900 px-7 py-3.5 text-center text-sm font-bold text-white shadow-md transition-all hover:bg-zinc-800 sm:w-auto dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                  >
                    Upload &amp; Fix Resume Free
                  </button>
                  <button
                    type="button"
                    onClick={() => openRouteAction("/daily-matches", "Daily Matches", "Jumping to Daily Matches interactive showcase.")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-7 py-3.5 text-sm font-bold text-zinc-900 shadow-sm transition-all hover:bg-zinc-50 sm:w-auto dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                  >
                    <SparklesIcon size={15} className="text-amber-500" />
                    <span>Explore Daily Matches</span>
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-amber-700 dark:text-amber-400">
                      PREMIUM
                    </span>
                  </button>
                </div>

                {/* Trust Reassurance */}
                <p className="mt-4 text-xs font-medium text-zinc-500 dark:text-zinc-500">
                  No credit card required for free diagnostic • Safe ATS exports • 0 AI hallucinations
                </p>
              </div>

              {/* Evidence Inspector Interactive Diff */}
              <div id="evidence-audit" className="mt-14 scroll-mt-24 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-100/70 px-6 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/80">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-rose-500/80" />
                    <span className="inline-block h-3 w-3 rounded-full bg-amber-500/80" />
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-3 font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {currentAudit.file}
                    </span>
                  </div>

                  {/* Role Preset Switcher */}
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Select career audit example">
                    {AUDIT_PRESETS.map((preset, idx) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedAuditPreset(idx)}
                        aria-pressed={selectedAuditPreset === idx}
                        className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                          selectedAuditPreset === idx
                            ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                            : "bg-white/80 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <span className="ml-1 hidden rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 sm:inline-block dark:text-emerald-400">
                      100% Truth Grounded
                    </span>
                  </div>
                </div>

                {/* Source Context Strip */}
                <div className="border-b border-zinc-200/80 bg-white/70 px-6 py-3 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/40">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Uploaded Source Evidence:{" "}
                  </span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    &ldquo;{currentAudit.rawSource}&rdquo;
                  </span>
                </div>

                <div className="grid divide-y divide-zinc-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0 dark:divide-zinc-800">
                  {/* Left Column: What We Refuse */}
                  <div className="p-6 sm:p-8">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      <XIcon size={15} />
                      <span>What Generic AI &amp; Resume Builders Invent</span>
                    </div>
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/50 p-4 font-mono text-xs leading-relaxed text-rose-900 dark:border-rose-950 dark:bg-rose-950/20 dark:text-rose-300">
                      <p className="line-through opacity-75">
                        {currentAudit.hallucinated}
                      </p>
                      <p className="mt-2 font-sans text-[11px] font-medium text-rose-700 dark:text-rose-400">
                        ⚠️ <strong>Audit Result:</strong> {currentAudit.hallucinatedReason}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: RoleSharp Grounded Edit */}
                  <div className="p-6 sm:p-8">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <CheckIcon size={15} />
                      <span>How RoleSharp Grounds Your Real Evidence</span>
                    </div>
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 font-mono text-xs leading-relaxed text-emerald-950 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-300">
                      <p>
                        {currentAudit.grounded}
                      </p>
                      <p className="mt-2 font-sans text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        ✓ <strong>Audit Result:</strong> {currentAudit.groundedReason}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-zinc-500">Matched ATS Signals:</span>
                      {currentAudit.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Access Tools Dock */}
              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <button
                  type="button"
                  onClick={() => openRouteAction("/resume-fixer", "Resume Fixer", "Upload your existing resume to rank and apply grounded fixes.")}
                  className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">Resume Fixer</span>
                    <ArrowRightIcon size={13} className="text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:group-hover:text-white" />
                  </div>
                  <span className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Upload &amp; rank fixes</span>
                </button>

                <button
                  type="button"
                  onClick={() => openRouteAction("/daily-matches", "Daily Matches", "Viewing curated role suggestions.")}
                  className="group relative flex flex-col rounded-xl border border-amber-300 bg-amber-50/40 p-4 text-left transition-all hover:border-amber-400 hover:shadow-sm dark:border-amber-900/70 dark:bg-amber-950/20"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">Daily Matches</span>
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-700 dark:text-amber-400">
                      PREMIUM
                    </span>
                  </div>
                  <span className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">Direct role suggestions</span>
                </button>

                <button
                  type="button"
                  onClick={() => openRouteAction("/checker", "ATS Diagnostic", "Viewing ATS score and keyword gaps.")}
                  className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">ATS Diagnostic</span>
                    <ArrowRightIcon size={13} className="text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:group-hover:text-white" />
                  </div>
                  <span className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Score &amp; keyword gaps</span>
                </button>

                <button
                  type="button"
                  onClick={() => openRouteAction("/interview-prep", "Live Mock Interview", "Starting voice practice and feedback.")}
                  className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">Live Mock Interview</span>
                    <ArrowRightIcon size={13} className="text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:group-hover:text-white" />
                  </div>
                  <span className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Voice practice &amp; feedback</span>
                </button>

                <button
                  type="button"
                  onClick={() => openRouteAction("/salaries", "Salary Estimator", "Viewing real-time market compensation bands.")}
                  className="group col-span-2 flex flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-400 hover:shadow-sm sm:col-span-1 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">Salary Estimator</span>
                    <ArrowRightIcon size={13} className="text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:group-hover:text-white" />
                  </div>
                  <span className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Real-time market bands</span>
                </button>
              </div>

              {/* Verified Catalogue Counts */}
              <div className="mt-14 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-8 sm:grid-cols-4 dark:border-zinc-800">
                <div className="text-center sm:text-left">
                  <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">113,000+</p>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Company Hiring Guides</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">1,021</p>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Standardized Occupations</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">209</p>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Supported Countries</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">0%</p>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Fabricated Hallucinations</p>
                </div>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------------
              ACT 2: INTERACTIVE PRODUCT DEMO STAGE (FEATURING DAILY MATCHES)
              ------------------------------------------------------------- */}
          <section id="interactive-demo" className="scroll-mt-20 border-b border-zinc-200 py-16 md:py-24 dark:border-zinc-800">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                  Every tool grounded in verifiable evidence.
                </h2>
                <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
                  Explore how RoleSharp accelerates your entire job search without fluff, guesswork, or fake auto-send bots.
                </p>

                {/* Interactive Tab Switcher */}
                <div role="tablist" aria-label="Product capability demos" className="mt-8 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDemoTab === "dailyMatches"}
                    onClick={() => setActiveDemoTab("dailyMatches")}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                      activeDemoTab === "dailyMatches"
                        ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:text-white"
                    }`}
                  >
                    <SparklesIcon size={14} className="text-amber-500" />
                    <span>Daily Matches</span>
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-600 dark:text-amber-300">
                      PREMIUM
                    </span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDemoTab === "ats"}
                    onClick={() => setActiveDemoTab("ats")}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                      activeDemoTab === "ats"
                        ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:text-white"
                    }`}
                  >
                    ATS Diagnostic
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDemoTab === "interview"}
                    onClick={() => setActiveDemoTab("interview")}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                      activeDemoTab === "interview"
                        ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:text-white"
                    }`}
                  >
                    Voice Mock Interview
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDemoTab === "match"}
                    onClick={() => setActiveDemoTab("match")}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                      activeDemoTab === "match"
                        ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:text-white"
                    }`}
                  >
                    Role Match &amp; Gap
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDemoTab === "tailor"}
                    onClick={() => setActiveDemoTab("tailor")}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                      activeDemoTab === "tailor"
                        ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:text-white"
                    }`}
                  >
                    Evidence-Based Tailor
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDemoTab === "salary"}
                    onClick={() => setActiveDemoTab("salary")}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                      activeDemoTab === "salary"
                        ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:text-white"
                    }`}
                  >
                    Salary Intelligence
                  </button>
                </div>
              </div>

              {/* Interactive Stage Viewport */}
              <div role="tabpanel" className="mt-12 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
                {activeDemoTab === "dailyMatches" && (
                  <div className="space-y-6">
                    <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center dark:border-zinc-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            Premium Feature Showcase
                          </span>
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                            Live Role Ingestion
                          </span>
                        </div>
                        <h3 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">
                          Daily Matches — Evidence-Backed Role Suggestions
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          We match your verified resume bullets against active job postings. Click any role card below to preview its 1-Click Tailor plan.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => scrollToSection("plans")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                      >
                        <span>Unlock Daily Matches</span>
                        <ArrowRightIcon size={13} />
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      {DAILY_MATCH_ROLES.map((role) => {
                        const isSelected = selectedMatchId === role.id;
                        return (
                          <div
                            key={role.id}
                            onClick={() => setSelectedMatchId(role.id)}
                            className={`cursor-pointer rounded-xl border p-5 transition-all ${
                              isSelected
                                ? "border-zinc-900 bg-zinc-50/90 shadow-sm dark:border-white dark:bg-zinc-800/70"
                                : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-zinc-900 dark:text-white">{role.title}</span>
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-black text-emerald-700 dark:text-emerald-300">
                                {role.match}% Match
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              {role.company} • {role.location}
                            </p>
                            <div className="mt-4 space-y-1.5 text-xs">
                              {role.bullets.map((b) => (
                                <div key={b} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                                  <CheckIcon size={13} className="text-emerald-500" />
                                  <span>{b}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 text-xs dark:border-zinc-700/60">
                              <span className="font-mono text-zinc-500">{role.salary}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMatchId(role.id);
                                }}
                                className="font-bold text-zinc-900 underline-offset-2 hover:underline dark:text-white"
                              >
                                1-Click Tailor →
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Interactive 1-Click Tailor Live Preview Bar */}
                    {DAILY_MATCH_ROLES.map((role) =>
                      role.id === selectedMatchId ? (
                        <div
                          key={role.id}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:flex-row sm:items-center dark:border-emerald-900/60 dark:bg-emerald-950/20"
                        >
                          <div className="text-xs">
                            <span className="font-mono font-bold uppercase text-emerald-700 dark:text-emerald-400">
                              1-Click Tailor Plan ({role.company} — {role.title}):{" "}
                            </span>
                            <span className="text-zinc-700 dark:text-zinc-300">{role.tailoredPreview}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openRouteAction("/resume-fixer", `1-Click Tailor: ${role.company}`, `Tailoring your verified resume bullets for ${role.title} at ${role.company}.`)}
                            className="shrink-0 rounded-full bg-emerald-600 px-4 py-1.5 text-center text-[11px] font-bold text-white transition-colors hover:bg-emerald-700"
                          >
                            Generate Tailored Draft →
                          </button>
                        </div>
                      ) : null
                    )}
                  </div>
                )}

                {activeDemoTab === "ats" && (
                  <div className="space-y-6">
                    <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center dark:border-zinc-800">
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Deterministic ATS Diagnostic Score</h3>
                        <p className="text-xs text-zinc-500">Real parsing by section, keyword match rate, and layout readability.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRouteAction("/resume-fixer", "Run Free ATS Audit", "Upload your PDF or DOCX resume to inspect section-by-section ATS parse results.")}
                        className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-zinc-900"
                      >
                        <span>Run Free ATS Audit</span>
                        <ArrowRightIcon size={13} />
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
                        <p className="text-xs font-semibold text-zinc-500">ATS Parse Score</p>
                        <p className="mt-1 text-3xl font-extrabold text-emerald-600">92/100</p>
                        <p className="mt-1 text-[11px] text-zinc-500">Full column readability verified</p>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
                        <p className="text-xs font-semibold text-zinc-500">Keyword Coverage</p>
                        <p className="mt-1 text-3xl font-extrabold text-zinc-900 dark:text-white">18 / 20</p>
                        <p className="mt-1 text-[11px] text-zinc-500">Core hard skills evidenced</p>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
                        <p className="text-xs font-semibold text-zinc-500">Measurable Impact</p>
                        <p className="mt-1 text-3xl font-extrabold text-amber-600">85%</p>
                        <p className="mt-1 text-[11px] text-zinc-500">Metrics verified without hyperbole</p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-4 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/15">
                        <p className="font-bold text-emerald-800 dark:text-emerald-300">✓ Structural Checks Passed (6/6)</p>
                        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                          Single-column reading order, standard section headers, ISO date ranges, and embedded font glyphs verified for Workday &amp; Greenhouse.
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4 text-xs dark:border-amber-900/50 dark:bg-amber-950/15">
                        <p className="font-bold text-amber-800 dark:text-amber-300">⚠️ 2 High-Impact Fixes Flagged</p>
                        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                          2 senior role bullets describe responsibilities (&ldquo;Responsible for CI/CD&rdquo;) without citing deployment frequency or build time delta.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeDemoTab === "interview" && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                        <MicIcon size={14} className="text-rose-500 animate-pulse" />
                        <span>Real-Time Voice Mock Interview Session</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Switch interview question type">
                        {INTERVIEW_QUESTIONS.map((q, idx) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => setSelectedQuestionIdx(idx)}
                            className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                              selectedQuestionIdx === idx
                                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {q.category}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-800/50">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {currentQuestion.question}
                      </p>
                      <p className="mt-3 text-xs text-zinc-500">
                        {currentQuestion.coaching}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {currentQuestion.rubric.map((item) => (
                        <div key={item.label} className="rounded-xl border border-zinc-200 p-3.5 text-xs dark:border-zinc-800">
                          <span className="text-zinc-500">{item.label}</span>
                          <p className="mt-1 font-mono text-lg font-extrabold text-emerald-600">{item.score}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeDemoTab === "match" && (
                  <div className="space-y-5">
                    <div className="flex flex-col justify-between gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center dark:border-zinc-800">
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Role Match &amp; Skill Gap Diagnostics</h3>
                        <p className="text-xs text-zinc-500">Pinpoints exactly what your resume proves vs. what the role description asks for.</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        Target Fit: 88% Verified
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckIcon size={12} /> TypeScript (Evidenced in 3 jobs)
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckIcon size={12} /> Docker &amp; Kubernetes (Evidenced)
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckIcon size={12} /> Distributed Tracing / OpenTelemetry (Evidenced)
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                        ⚠️ Kafka (Mentioned once without metric)
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/80 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        ○ Go / Golang (Undocumented in current draft)
                      </span>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
                      <strong>Anti-Hallucination Guidance:</strong> RoleSharp never injects <code className="rounded bg-zinc-200 px-1 py-0.5 dark:bg-zinc-700">Go / Golang</code> into your work history if you haven&apos;t used it. Instead, it prompts you to add a verified side project or strengthens your adjacent <code className="rounded bg-zinc-200 px-1 py-0.5 dark:bg-zinc-700">Kafka</code> throughput evidence.
                    </div>
                  </div>
                )}

                {activeDemoTab === "tailor" && (
                  <div className="space-y-5">
                    <div className="flex flex-col justify-between gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center dark:border-zinc-800">
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">1-Click Evidence Tailor</h3>
                        <p className="text-xs text-zinc-500">Reorders and highlights true achievements to match target responsibilities.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRouteAction("/resume-fixer", "1-Click Evidence Tailor", "Upload your resume and target job description to reorder and sharpen your verified achievements.")}
                        className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-zinc-900"
                      >
                        <span>Tailor Your Resume</span>
                        <ArrowRightIcon size={13} />
                      </button>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200">
                      + Highlighted 4 cloud cost optimization bullets to rank for &ldquo;FinOps &amp; Efficiency&rdquo; requirements.
                      <br />
                      + Cleaned multi-column artifact tables into single-column clean ATS hierarchy.
                      <br />
                      + Preserved 100% of original dates, employers, and verified numerical denominators.
                    </div>
                  </div>
                )}

                {activeDemoTab === "salary" && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Real-World Salary Intelligence</h3>
                        <p className="text-xs text-zinc-500">Extracted from live verified postings, updated daily ({currentSalary.sample}).</p>
                      </div>
                      <div className="flex gap-1.5" role="group" aria-label="Select seniority band">
                        {(["mid", "senior", "staff"] as const).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setSelectedSalaryLevel(lvl)}
                            className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                              selectedSalaryLevel === lvl
                                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {SALARY_BANDS[lvl].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 text-center sm:grid-cols-3">
                      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                        <p className="text-xs font-medium text-zinc-500">25th Percentile</p>
                        <p className="mt-1 text-2xl font-extrabold text-zinc-900 dark:text-white">{currentSalary.p25}</p>
                        <p className="mt-1 text-[11px] text-zinc-500">Base compensation floor</p>
                      </div>
                      <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/30 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Median Market Band</p>
                        <p className="mt-1 text-2xl font-extrabold text-emerald-600">{currentSalary.median}</p>
                        <p className="mt-1 text-[11px] text-zinc-500">Target negotiation anchor</p>
                      </div>
                      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                        <p className="text-xs font-medium text-zinc-500">90th Percentile</p>
                        <p className="mt-1 text-2xl font-extrabold text-zinc-900 dark:text-white">{currentSalary.p90}</p>
                        <p className="mt-1 text-[11px] text-zinc-500">Top-tier competing offers</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------------
              ACT 3: FLAGSHIP TOOLS BENTO (PROMOTING DAILY MATCHES)
              ------------------------------------------------------------- */}
          <section id="suite" className="scroll-mt-20 border-b border-zinc-200 py-16 md:py-24 dark:border-zinc-800">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                  The complete career acceleration suite.
                </h2>
                <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
                  Zero fake credentials, zero recurring traps. Built for professionals who want real interviews.
                </p>
              </div>

              <div className="mt-12 grid gap-6 md:grid-cols-2">
                {/* FULL-WIDTH FEATURED CARD: DAILY MATCHES */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/80 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/30 p-8 shadow-sm md:col-span-2 dark:border-amber-600/60 dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-800 dark:text-amber-300">
                      <SparklesIcon size={14} />
                      FLAGSHIP PREMIUM FEATURE
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                      Updated Daily From 113k Companies
                    </span>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-center">
                    <div>
                      <h3 className="text-2xl font-extrabold text-zinc-900 sm:text-3xl dark:text-white">
                        Daily Matches &amp; Evidence-Backed Discovery
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        Stop manually crawling through hundreds of irrelevant job postings. RoleSharp continuously scans verified employer listings and recommends roles that directly align with your evidenced skills.
                      </p>

                      <ul className="mt-5 space-y-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        <li className="flex items-center gap-2">
                          <CheckIcon size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span><strong>Evidence-Grounded Matching:</strong> Match score calculated from real resume bullets, not keywords.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckIcon size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span><strong>1-Click Tailor Pipeline:</strong> Instantly create an ATS-tailored draft for any recommended match.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckIcon size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span><strong>Strict Anti-Spam Guarantee:</strong> Controlled applications without reckless auto-emailing.</span>
                        </li>
                      </ul>

                      <div className="mt-7 flex flex-wrap items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openRouteAction("/daily-matches", "Daily Matches", "Jumping to Daily Matches interactive showcase.")}
                          className="rounded-full bg-zinc-900 px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                        >
                          Explore Daily Matches →
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollToSection("plans")}
                          className="text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        >
                          Included with Premium Pass
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-200/80 bg-white/90 p-5 shadow-inner dark:border-zinc-800 dark:bg-zinc-900/90">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <BriefcaseIcon size={16} className="text-zinc-700 dark:text-zinc-300" />
                          <span className="text-xs font-bold text-zinc-900 dark:text-white">Live Role Compatibility</span>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                          High Confidence
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Skills Overlap</span>
                          <span className="font-mono font-bold text-emerald-600">94%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: "94%" }} />
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Seniority Alignment</span>
                          <span className="font-mono font-bold text-emerald-600">100% (Lead / Staff)</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: "100%" }} />
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Domain Impact Evidence</span>
                          <span className="font-mono font-bold text-emerald-600">91% (Cloud &amp; Distributed)</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: "91%" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: RESUME FIXER */}
                <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <span className="font-mono text-xs font-bold text-zinc-500">Core Diagnostic</span>
                    <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">Evidence-Based Resume Fixer</h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Upload your existing PDF or DOCX. RoleSharp ranks issues by ATS severity, highlights missing numbers, and fixes syntax flaws.
                    </p>
                    <ul className="mt-4 space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <li className="flex items-center gap-2">
                        <CheckIcon size={13} className="text-emerald-500" />
                        <span>Line-by-line weak verb &amp; missing denominator detection</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon size={13} className="text-emerald-500" />
                        <span>Instant single-column clean PDF &amp; DOCX export</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => openRouteAction("/resume-fixer", "Evidence-Based Resume Fixer", "Upload your existing resume to rank and fix ATS and metric issues.")}
                      className="text-xs font-bold text-zinc-900 underline underline-offset-4 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-300"
                    >
                      Fix your resume free →
                    </button>
                  </div>
                </div>

                {/* CARD 3: LIVE MOCK INTERVIEW */}
                <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-zinc-500">Interactive Prep</span>
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Voice Powered
                      </span>
                    </div>
                    <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">Live Voice Mock Interviews</h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Practice behavioral, situational, and technical questions generated straight from your career projects and real job descriptions.
                    </p>
                    <ul className="mt-4 space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <li className="flex items-center gap-2">
                        <CheckIcon size={13} className="text-emerald-500" />
                        <span>Real-time STAR structure &amp; technical depth grading</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon size={13} className="text-emerald-500" />
                        <span>Probes specifically on metrics claimed in your resume</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => openRouteAction("/interview-prep", "Live Voice Mock Interviews", "Jumping to Voice Mock Interview interactive demo.")}
                      className="text-xs font-bold text-zinc-900 underline underline-offset-4 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-300"
                    >
                      Start voice practice session →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------------
              ACT 4: HONEST FIXED-TERM PLANS & REDESIGNED STUDENT BANNER
              ------------------------------------------------------------- */}
          <section id="plans" className="scroll-mt-20 border-b border-zinc-200 py-16 md:py-24 dark:border-zinc-800">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3.5 py-1 text-xs font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  <ShieldIcon size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Honest, Fixed-Term Passes</span>
                </div>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl dark:text-white">
                  Exact allowances. Zero recurring subscriptions.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
                  Manual tools remain completely free forever. Premium is paid once for a fixed term, never auto-renews, and drops back to Free when access ends.
                </p>

                {/* Interactive Pass Switcher Toggle */}
                <div className="mt-8 flex justify-center">
                  <div
                    role="group"
                    aria-label="Select fixed-term pass duration"
                    className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <button
                      type="button"
                      aria-pressed={billingPeriod === "monthly"}
                      onClick={() => setBillingPeriod("monthly")}
                      className={`rounded-full px-4 py-2 text-xs font-bold transition-all sm:px-5 sm:text-sm ${
                        billingPeriod === "monthly"
                          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                      }`}
                    >
                      30-Day Sprint ({priceMonthly})
                    </button>
                    <button
                      type="button"
                      aria-pressed={billingPeriod === "yearly"}
                      onClick={() => setBillingPeriod("yearly")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:px-5 sm:text-sm ${
                        billingPeriod === "yearly"
                          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                      }`}
                    >
                      <span>365-Day Career ({priceYearly})</span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                        SAVE {savingsPercent}%
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2-COLUMN PRICING GRID (FREE VS PREMIUM) */}
              <div className="mx-auto mt-12 grid max-w-5xl gap-8 lg:grid-cols-2 lg:items-stretch">
                
                {/* CARD 1: FREE FOREVER */}
                <div className="flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm transition-all hover:border-zinc-300 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
                      <div>
                        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-500">Free</h3>
                        <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">Diagnostic &amp; Manual Prep</p>
                      </div>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        No Card Needed
                      </span>
                    </div>

                    <div className="mt-6 flex items-baseline gap-2">
                      <span className="text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white">$0</span>
                      <span className="text-sm font-medium text-zinc-500">forever</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">Check, build, and export without ever entering payment details.</p>

                    <ul className="mt-7 space-y-3.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span><strong>{tailoredResumes(DEFAULT_FREE_MONTHLY_LIMIT)}</strong> per rolling month</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>Evidence-grounded ATS score &amp; keyword gap audit</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>Full manual resume builder with instant clean PDF export</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>Real-world salary ranges &amp; interview question bank</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-zinc-400 dark:text-zinc-500">
                        <XIcon size={15} className="mt-0.5 shrink-0 text-zinc-300 dark:text-zinc-600" />
                        <span>Daily Matches &amp; curated role suggestions</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-zinc-400 dark:text-zinc-500">
                        <XIcon size={15} className="mt-0.5 shrink-0 text-zinc-300 dark:text-zinc-600" />
                        <span>Voice-guided live mock interview practice</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-8 border-t border-zinc-100 pt-6 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => openRouteAction("/resume-maker", "Start Building Free", "Launching the free manual resume builder with clean single-column PDF export.")}
                      className="block w-full rounded-full border border-zinc-300 bg-white py-3 text-center text-xs font-bold text-zinc-900 transition-all hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                    >
                      Start Building Free
                    </button>
                  </div>
                </div>

                {/* CARD 2: PREMIUM PASS (FIXED TERM) */}
                <div className="relative flex h-full flex-col justify-between rounded-2xl border-2 border-zinc-900 bg-white p-7 shadow-lg sm:p-8 dark:border-white dark:bg-zinc-900">
                  <div className="absolute -top-3.5 right-6 rounded-full bg-zinc-900 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-white dark:bg-white dark:text-zinc-900">
                    Fixed-Term Pass • 0 Auto-Renew
                  </div>

                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
                      <div>
                        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">Premium Pass</h3>
                        <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                          {billingPeriod === "yearly" ? "365-Day Career Access" : "30-Day Sprint Access"}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        Single One-Time Payment
                      </span>
                    </div>

                    <div className="mt-6 flex items-baseline gap-2">
                      <span className="text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                        {billingPeriod === "yearly" ? priceYearly : priceMonthly}
                      </span>
                      <span className="text-sm font-medium text-zinc-500">
                        {billingPeriod === "yearly" ? "/ 365 days (single payment)" : "/ 30 days (single payment)"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      Paid once ({billingPeriod === "yearly" ? "~$0.22/day" : "$0.40/day"}). Expires automatically. Never charges your card again.
                    </p>

                    <ul className="mt-7 space-y-3.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span><strong>{tailoredResumes(DEFAULT_PREMIUM_MONTHLY_LIMIT)}</strong> per rolling month</span>
                      </li>
                      <li className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 p-2 text-amber-900 dark:text-amber-200">
                        <SparklesIcon size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>
                          <strong>Daily Matches &amp; Role Discovery:</strong> Curated role suggestions matching your verified evidence.
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span><strong>Voice Mock Interview Prep:</strong> Live interactive question practice with voice AI</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span><strong>Executive DOCX &amp; PDF Exports:</strong> Clean formatting for corporate recruiters</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>Application status tracking &amp; pipeline follow-up management</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-8 border-t border-zinc-100 pt-6 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => openRouteAction(
                        billingPeriod === "yearly" ? "/pricing?period=yearly" : "/pricing?period=monthly",
                        `Get ${billingPeriod === "yearly" ? "365-Day" : "30-Day"} Premium Pass`,
                        `Single one-time payment of ${billingPeriod === "yearly" ? priceYearly : priceMonthly} with zero auto-renewal.`
                      )}
                      className="block w-full rounded-full bg-zinc-900 py-3 text-center text-xs font-bold text-white transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                    >
                      Get {billingPeriod === "yearly" ? "365-Day" : "30-Day"} Pass ({billingPeriod === "yearly" ? priceYearly : priceMonthly})
                    </button>
                  </div>
                </div>
              </div>

              {/* DEDICATED ACADEMIC / STUDENT CALLOUT BANNER (#student-access) */}
              <div
                id="student-access"
                className="mx-auto mt-10 max-w-5xl scroll-mt-24 overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-50 via-white to-zinc-50 p-6 sm:p-8 dark:border-zinc-800 dark:from-zinc-900/60 dark:via-zinc-900 dark:to-zinc-900/60"
              >
                <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-zinc-200/70 px-3 py-0.5 text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                      <GraduationCapIcon size={14} />
                      <span>Academic Verification Program</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-zinc-900 sm:text-2xl dark:text-white">
                      Active Student or University Researcher?
                    </h3>
                    <p className="max-w-2xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Get <strong>6 months of RoleSharp Premium for $0</strong>. Access evidence-based resume tailoring, DOCX exports, and interview preparation with your school email. <strong>No credit card required.</strong>
                    </p>
                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      <span className="flex items-center gap-1.5">
                        <CheckIcon size={13} className="text-emerald-500" /> {tailoredResumes(DEFAULT_STUDENT_MONTHLY_LIMIT)} / month
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CheckIcon size={13} className="text-emerald-500" /> Full diagnostic suite
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CheckIcon size={13} className="text-emerald-500" /> .edu or university domain
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => openRouteAction("/students", "Claim Student Access ($0)", "Verify with your .edu or university domain email to activate 6 months free with no credit card required.")}
                      className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                    >
                      <span>Claim Student Access ($0)</span>
                      <ArrowRightIcon size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggle Full Feature Comparison Matrix */}
              <div className="mt-10 text-center">
                <button
                  type="button"
                  aria-expanded={showMatrix}
                  aria-controls="feature-comparison-matrix"
                  onClick={() => setShowMatrix(!showMatrix)}
                  className="inline-flex items-center gap-2 text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  <span>{showMatrix ? "Hide detailed feature matrix" : "Compare full feature matrix across all plans"}</span>
                  <ChevronDownIcon size={14} className={`transition-transform ${showMatrix ? "rotate-180" : ""}`} />
                </button>
              </div>

              {showMatrix && (
                <div
                  id="feature-comparison-matrix"
                  className="mx-auto mt-6 max-w-5xl overflow-x-auto rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        <th className="pb-3 font-bold text-zinc-900 dark:text-white">Feature</th>
                        <th className="pb-3 font-bold text-zinc-900 dark:text-white">Free ($0)</th>
                        <th className="pb-3 font-bold text-zinc-900 dark:text-white">Student ($0 / 6 Mos)</th>
                        <th className="pb-3 font-bold text-zinc-900 dark:text-white">Premium Pass ({billingPeriod === "yearly" ? priceYearly : priceMonthly})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      <tr>
                        <td className="py-3 font-medium text-zinc-900 dark:text-white">Monthly Tailored Resumes</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">{DEFAULT_FREE_MONTHLY_LIMIT} / month</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">{DEFAULT_STUDENT_MONTHLY_LIMIT} / month</td>
                        <td className="py-3 font-bold text-emerald-600">{DEFAULT_PREMIUM_MONTHLY_LIMIT} / month</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium text-zinc-900 dark:text-white">ATS Parse &amp; Keyword Gap Diagnostic</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">Included</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">Included</td>
                        <td className="py-3 font-bold text-emerald-600">Included</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium text-zinc-900 dark:text-white">Clean Single-Column PDF Exports</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">Unlimited</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">Unlimited</td>
                        <td className="py-3 font-bold text-emerald-600">Unlimited</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium text-zinc-900 dark:text-white">Daily Matches &amp; Role Discovery</td>
                        <td className="py-3 text-zinc-400">—</td>
                        <td className="py-3 text-zinc-400">—</td>
                        <td className="py-3 font-bold text-emerald-600">Included (Daily Feed)</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium text-zinc-900 dark:text-white">Voice Mock Interview Practice</td>
                        <td className="py-3 text-zinc-400">—</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">Basic</td>
                        <td className="py-3 font-bold text-emerald-600">Unlimited</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium text-zinc-900 dark:text-white">DOCX Word Document Exports</td>
                        <td className="py-3 text-zinc-400">—</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">Included</td>
                        <td className="py-3 font-bold text-emerald-600">Included</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium text-zinc-900 dark:text-white">Application Status &amp; Follow-Up Tracker</td>
                        <td className="py-3 text-zinc-400">—</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">Included</td>
                        <td className="py-3 font-bold text-emerald-600">Included</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium text-zinc-900 dark:text-white">Auto-Renewal Policy</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">Never charges</td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">Never charges</td>
                        <td className="py-3 font-bold text-emerald-600">Never charges (Zero auto-renew)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* -------------------------------------------------------------
              ACT 5: FAQ ACCORDION & HIGH-CONVERSION CLOSE
              ------------------------------------------------------------- */}
          <section id="faq" className="scroll-mt-20 border-b border-zinc-200 py-16 md:py-24 dark:border-zinc-800">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                  Frequently Asked Questions
                </h2>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  Clear answers on subscriptions, privacy, and evidence grounding.
                </p>
              </div>

              <div className="mt-10 space-y-4">
                {[
                  {
                    q: "Are these subscriptions that keep charging my credit card?",
                    a: "No. RoleSharp has zero recurring subscriptions. You purchase a fixed-term pass (30-day or 365-day) with a single one-time payment. When your pass expires, your account automatically reverts to Free. We never charge your card again without your deliberate action.",
                  },
                  {
                    q: "What makes Daily Matches different from generic job alerts?",
                    a: "Daily Matches compares the actual evidenced bullets and hard skills from your resume directly against verified requirements in job postings from 113,000+ companies. You see exact compatibility scores (e.g. 94%), match explanations, and can tailor your resume with 1 click.",
                  },
                  {
                    q: "How does RoleSharp prevent invented metrics and AI hallucinations?",
                    a: "Our reviewer LLMs are constrained by strict deterministic anti-fabrication rules. If a metric or company does not exist in your uploaded source resume, our models are prohibited from inventing it. We rephrase and elevate your real accomplishments without putting you at risk during background checks.",
                  },
                  {
                    q: "How do university students get 6 months free?",
                    a: "Visit /students and verify with your university email (.edu, ac.uk, etc.). Your 6-month student pass activates instantly with zero credit card or billing details required.",
                  },
                  {
                    q: "Will recruiters or ATS systems flag my exported resume as AI-generated?",
                    a: "No. Because RoleSharp preserves your genuine career facts, avoids generic LLM buzzword templates, and exports deterministic single-column PDF and DOCX layouts, your resume reads like a sharp human-edited document rather than synthetic AI boilerplate.",
                  },
                ].map((item, idx) => {
                  const isOpen = activeFaq === idx;
                  return (
                    <div key={idx} className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setActiveFaq(isOpen ? null : idx)}
                        className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-zinc-900 dark:text-white"
                      >
                        <span>{item.q}</span>
                        <ChevronDownIcon size={16} className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-zinc-100 px-5 pb-5 pt-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* FINAL HIGH-CONVERSION CLOSE BANNER */}
              <div className="mt-16 rounded-3xl bg-zinc-900 p-8 text-center text-white sm:p-12 dark:bg-white dark:text-zinc-900">
                <h3 className="text-2xl font-extrabold sm:text-3xl">
                  Ready to run an honest, evidence-grounded search?
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-xs text-zinc-300 sm:text-sm dark:text-zinc-600">
                  Upload your resume now to uncover ATS gaps, find high-probability job matches, and prepare for interviews without monthly subscription anxiety.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openRouteAction("/resume-fixer", "Upload & Fix Resume Free", "Upload your PDF or DOCX resume to start your free diagnostic.")}
                    className="rounded-full bg-white px-8 py-3.5 text-xs font-bold text-zinc-900 shadow-md transition-all hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                  >
                    Upload &amp; Fix Resume Free
                  </button>
                  <button
                    type="button"
                    onClick={() => openRouteAction("/daily-matches", "Explore Daily Matches", "Jumping to Daily Matches interactive showcase.")}
                    className="rounded-full border border-zinc-700 bg-transparent px-8 py-3.5 text-xs font-bold text-white transition-all hover:bg-zinc-800 dark:border-zinc-300 dark:text-zinc-900 dark:hover:bg-zinc-100"
                  >
                    Explore Daily Matches
                  </button>
                </div>
                <p className="mt-4 text-[11px] text-zinc-400 dark:text-zinc-500">
                  Zero credit card required • Instant PDF exports • 100% private
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* -------------------------------------------------------------
            FOOTER
            ------------------------------------------------------------- */}
        <footer className="border-t border-zinc-200 py-10 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
            <p>© {new Date().getFullYear()} RoleSharp. Anti-hallucination career infrastructure.</p>
            <div className="flex items-center gap-6 font-semibold">
              <button type="button" onClick={() => openRouteAction("/privacy", "Privacy Policy", "RoleSharp never sells candidate data or trains public foundation models on private resumes.")} className="hover:text-zinc-900 dark:hover:text-white">Privacy</button>
              <button type="button" onClick={() => openRouteAction("/terms", "Terms of Service", "Fixed-term passes never auto-renew and revert cleanly to Free upon expiration.")} className="hover:text-zinc-900 dark:hover:text-white">Terms</button>
              <button type="button" onClick={() => scrollToSection("plans")} className="hover:text-zinc-900 dark:hover:text-white">Pricing</button>
              <button type="button" onClick={() => scrollToSection("student-access")} className="hover:text-zinc-900 dark:hover:text-white">Students</button>
            </div>
          </div>
        </footer>

        {/* -------------------------------------------------------------
            INTERACTIVE ACTION MODAL (FOR ROUTE PREVIEWS IN CANVAS)
            ------------------------------------------------------------- */}
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Route Target: {activeModal.route}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg px-2 py-1 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>
              <h4 className="mt-4 text-lg font-extrabold text-zinc-900 dark:text-white">
                {activeModal.title}
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {activeModal.description}
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-full bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
                >
                  Continue Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
