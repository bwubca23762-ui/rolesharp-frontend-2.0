"use client";

import { useState } from "react";
import {
  Shield,
  Target,
  Sparkles,
  BarChart3,
  Check,
  ChevronRight,
} from "@/app/icons";
import { Button, Container } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";

const DEMO_TABS = [
  { id: "ats", label: "ATS Diagnostic", icon: Shield, badge: "Score 86/100" },
  { id: "matches", label: "Daily Matches", icon: Target, badge: "Premium" },
  { id: "interview", label: "Live Mock Interview", icon: Sparkles, badge: "Voice AI Coach" },
  { id: "match", label: "Job Description Match", icon: Target, badge: "88% Match" },
  { id: "tailor", label: "AI Bullet Enhancer", icon: Sparkles, badge: "Before / After" },
  { id: "salary", label: "Salary Benchmark", icon: BarChart3, badge: "Live Market" },
] as const;

const SAMPLE_KEYWORDS = [
  { name: "React 19", status: "verified", category: "Framework" },
  { name: "TypeScript", status: "verified", category: "Language" },
  { name: "Next.js 15", status: "verified", category: "Framework" },
  { name: "PostgreSQL", status: "verified", category: "Database" },
  { name: "Redis", status: "verified", category: "Cache" },
  { name: "CI/CD Pipelines", status: "verified", category: "DevOps" },
  { name: "REST APIs", status: "verified", category: "Architecture" },
  { name: "Distributed Systems", status: "missing", category: "Architecture", impact: "+6 pts" },
  { name: "Kubernetes", status: "missing", category: "Cloud", impact: "+4 pts" },
  { name: "Kafka Streams", status: "missing", category: "Messaging", impact: "+3 pts" },
] as const;

type DemoTabId = (typeof DEMO_TABS)[number]["id"];

export function ProductDemoStage() {
  const [activeTab, setActiveTab] = useState<DemoTabId>("ats");
  const [showEnhanced, setShowEnhanced] = useState(true);
  const [keywordFilter, setKeywordFilter] = useState<"all" | "verified" | "missing">("all");

  return (
    <section id="demo" className="scroll-mt-20 border-b border-[var(--hairline)] py-8 md:py-12">
      <Container size="large">
        <Reveal variant="rise">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
              Interactive Product Preview
            </p>
            <h2 className="mt-3 text-[clamp(1.9rem,3.4vw,2.75rem)] font-extrabold! leading-[1.05]! tracking-[-0.035em]! text-[var(--fg)] text-balance">
              See how the AI sharpens your resume in seconds.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--muted-fg)] md:text-lg md:leading-8">
              No generic suggestions or fake buzzwords. Test the exact diagnosis, skill matching, and evidence-grounded rewriting engine right here.
            </p>
          </div>
        </Reveal>

        {/* Tab switcher buttons */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-2">
          {DEMO_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--surface)] text-[var(--fg)] shadow-sm ring-2 ring-[var(--primary)]/20"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-fg)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
                }`}
              >
                <Icon size={14} className={isSelected ? "text-[var(--primary)]" : "text-[var(--muted-fg)]"} aria-hidden="true" />
                <span>{tab.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-normal ${
                  isSelected
                    ? "bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-[var(--primary)]"
                    : "bg-[var(--surface)] text-[var(--muted-fg)]"
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive stage canvas */}
        <div className="mt-8 mx-auto max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_64px_-32px_rgb(0_0_0/0.18)] dark:shadow-[0_24px_64px_-32px_rgb(0_0_0/0.6)]">
          {/* Stage Top Bar */}
          <div className="flex items-center justify-between border-b border-[var(--hairline)] bg-[var(--surface-2)] px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
              <span className="font-mono text-xs font-medium text-[var(--muted-fg)]">
                rolesharp-engine :: {activeTab}.analysis
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                Verified Sample Data
              </span>
            </div>
          </div>

          {/* Tab 1: ATS Diagnostic */}
          {activeTab === "ats" && (
            <div className="p-6 sm:p-8">
              <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
                {/* SVG Radial Score Dial */}
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-6 text-center">
                  <div className="relative grid size-32 place-items-center">
                    <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-[var(--border)] opacity-30"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        stroke="url(#atsScoreGradient)"
                        strokeWidth="8"
                        strokeDasharray={264}
                        strokeDashoffset={264 * (1 - 0.86)}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-1000 ease-out"
                      />
                      <defs>
                        <linearGradient id="atsScoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold tracking-tight text-[var(--fg)]">86</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-fg)]">Out of 100</span>
                    </div>
                  </div>

                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Interview-Ready</span>
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-[var(--muted-fg)]">
                    Top 12% of applicants in market
                  </p>

                  {/* ATS engine pass badges */}
                  <div className="mt-4 grid w-full grid-cols-3 gap-1 border-t border-[var(--hairline)] pt-3 text-[10px] font-semibold text-[var(--muted-fg)]">
                    <div className="rounded bg-[var(--surface)] p-1 text-center">
                      <span className="block font-bold text-emerald-800 dark:text-emerald-200">96%</span>
                      <span>Workday</span>
                    </div>
                    <div className="rounded bg-[var(--surface)] p-1 text-center">
                      <span className="block font-bold text-emerald-800 dark:text-emerald-200">92%</span>
                      <span>Greenhouse</span>
                    </div>
                    <div className="rounded bg-[var(--surface)] p-1 text-center">
                      <span className="block font-bold text-emerald-800 dark:text-emerald-200">88%</span>
                      <span>Lever</span>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Cards */}
                <div className="space-y-4">
                  {/* Card 1: Formatting & Parsability */}
                  <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[var(--fg)] font-bold">1. Formatting & ATS Parsability</span>{" "}
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        96% Optimal
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className="h-full rounded-full bg-emerald-500 w-[96%]" />
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted-fg)]">
                      <span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-200">
                        <Check size={12} aria-hidden="true" /> Single column structure
                      </span>
                      <span aria-hidden="true" className="text-[var(--muted-fg)]">·</span>
                      <span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-200">
                        <Check size={12} aria-hidden="true" /> Standard section titles
                      </span>
                      <span aria-hidden="true" className="text-[var(--muted-fg)]">·</span>
                      <span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-200">
                        <Check size={12} aria-hidden="true" /> 0 parsing bottlenecks
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Target Keyword Coverage (Interactive!) */}
                  <div className="rounded-xl border border-amber-500/30 bg-[var(--surface)] p-4 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-[var(--fg)]">2. Target Keyword & Hard Skills Coverage</span>
                        <p className="text-[11px] text-[var(--muted-fg)]">7 verified matches against job description · 3 missing core competencies</p>
                      </div>
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                        74% Needs Lift
                      </span>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className="h-full rounded-full bg-amber-500 w-[74%]" />
                    </div>

                    {/* Interactive Filter Pills */}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--hairline)] pt-3">
                      <span className="text-[11px] font-semibold text-[var(--muted-fg)]">Detected Skill Coverage:</span>
                      <div className="inline-flex rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] p-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setKeywordFilter("all")}
                          className={`rounded px-2 py-0.5 font-semibold transition-all ${keywordFilter === "all" ? "bg-[var(--surface)] text-[var(--fg)] shadow-xs" : "text-[var(--muted-fg)]"}`}
                        >
                          All ({SAMPLE_KEYWORDS.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setKeywordFilter("verified")}
                          className={`rounded px-2 py-0.5 font-semibold transition-all ${keywordFilter === "verified" ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 shadow-xs" : "text-[var(--muted-fg)]"}`}
                        >
                          Verified (7)
                        </button>
                        <button
                          type="button"
                          onClick={() => setKeywordFilter("missing")}
                          className={`rounded px-2 py-0.5 font-semibold transition-all ${keywordFilter === "missing" ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 shadow-xs" : "text-[var(--muted-fg)]"}`}
                        >
                          Missing (3)
                        </button>
                      </div>
                    </div>

                    {/* Chips Display */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {SAMPLE_KEYWORDS
                        .filter((k) => keywordFilter === "all" || k.status === keywordFilter)
                        .map((kw) => (
                          <span
                            key={kw.name}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                              kw.status === "verified"
                                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                : "border border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300 shadow-2xs"
                            }`}
                          >
                            {kw.status === "verified" ? (
                              <Check size={11} className="text-emerald-800 dark:text-emerald-200" />
                            ) : (
                              <span className="font-bold text-amber-800 dark:text-amber-200">+</span>
                            )}
                            <span>{kw.name}</span>
                            {kw.status === "missing" && (
                              <span className="rounded-full bg-amber-500/30 px-1 text-[9px] font-extrabold text-amber-900 dark:text-amber-200">
                                {kw.impact}
                              </span>
                            )}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Card 3: Quantified Impact */}
                  <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[var(--fg)] font-bold">3. Quantified Business Impact (Metrics)</span>{" "}
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        88% Strong
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className="h-full rounded-full bg-emerald-500 w-[88%]" />
                    </div>
                    <div className="mt-2 text-[11px] text-[var(--muted-fg)]">
                      <p><strong>7 of 9 bullets</strong> contain measurable achievements (e.g. 41% latency reduction, 120K MAU, $320K cost savings).</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actionable recommendations */}
              <div className="mt-6 border-t border-[var(--hairline)] pt-5">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                  Top High-Impact Recommendations
                </span>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 dark:bg-amber-950/20">
                    <span className="mt-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-200">
                      +6 pts
                    </span>
                    <div className="text-xs text-[var(--fg)]">
                      <strong>Missing Domain Competency:</strong> Add evidence of <strong>Distributed Systems</strong> in role #1 to satisfy Workday keyword parser.
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 dark:bg-amber-950/20">
                    <span className="mt-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-200">
                      +5 pts
                    </span>
                    <div className="text-xs text-[var(--fg)]">
                      <strong>Passive Verb Detected:</strong> Transform passive phrase &ldquo;responsible for tests&rdquo; into an active outcome with tool context.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
                <span className="text-xs text-[var(--muted-fg)]">Run your own resume against Workday, Lever & Greenhouse logic:</span>
                <Button as="a" href="/checker" size="sm" rightIcon={<ChevronRight size={14} />}>
                  Run Free ATS Checker
                </Button>
              </div>
            </div>
          )}

          {/* Tab 2: Live Mock Interview */}
          {activeTab === "interview" && (
            <div className="p-6 sm:p-8">
              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200">
                      <Sparkles size={15} aria-hidden="true" />
                    </span>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                        Interview Simulation (Voice & Audio)
                      </span>
                      <p className="text-sm font-bold text-[var(--fg)]">Senior Full Stack Engineer Practice Session</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
                    Grounded in Resume Role #1
                  </span>
                </div>

                {/* Simulated Interview Question */}
                <div className="mt-4 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 rounded bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--primary)]">
                      AI Interviewer
                    </span>
                    <p className="text-sm font-medium leading-relaxed text-[var(--fg)]">
                      &ldquo;You noted architecting 14 Next.js workflows and caching with Redis to reduce checkout latency by 41%. What specific cache invalidation strategy did you implement when product inventories changed in real time?&rdquo;
                    </p>
                  </div>
                </div>

                {/* Simulated Candidate Audio & Transcript */}
                <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Candidate Voice Transcript (138 WPM · Clear Pacing)
                    </span>
                    <span className="font-mono text-[11px] text-[var(--muted-fg)]">01:14 duration</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--fg)]">
                    &ldquo;We used an event-driven pub/sub invalidation pattern. When inventory updated in PostgreSQL, an event triggered worker nodes to invalidate the specific SKU key with TTL locks, preventing cache stampedes while ensuring checkout never displayed stale pricing.&rdquo;
                  </p>
                </div>

                {/* Real-Time AI Coaching Breakdown */}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3">
                    <span className="text-[11px] font-semibold text-[var(--muted-fg)]">STAR Structure</span>
                    <p className="mt-1 text-sm font-bold text-emerald-800 dark:text-emerald-200">94% (Structured)</p>
                    <span className="text-[10px] text-[var(--muted-fg)]">Clear technical context, action & outcome</span>
                  </div>
                  <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3">
                    <span className="text-[11px] font-semibold text-[var(--muted-fg)]">Resume Evidence</span>
                    <p className="mt-1 text-sm font-bold text-emerald-800 dark:text-emerald-200">100% Truth Grounded</p>
                    <span className="text-[10px] text-[var(--muted-fg)]">Every claim aligns with candidate resume</span>
                  </div>
                  <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3">
                    <span className="text-[11px] font-semibold text-[var(--muted-fg)]">Coaching Feedback</span>
                    <p className="mt-1 text-xs font-medium text-[var(--fg)]">Mention Prometheus metrics to demonstrate reliability monitoring.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
                <span className="text-xs text-[var(--muted-fg)]">Rehearse real behavioral & technical questions tailored to your resume:</span>
                <Button as="a" href="/interview-prep" size="sm" rightIcon={<ChevronRight size={14} />}>
                  Practice Live Interview Free
                </Button>
              </div>
            </div>
          )}

          {/* Tab 2: Job Description Match */}
          {activeTab === "match" && (
            <div className="p-6 sm:p-8">
              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
                  <div>
                    <span className="text-xs text-[var(--muted-fg)]">Target Job Posting</span>
                    <p className="text-sm font-bold text-[var(--fg)]">Senior Full Stack Engineer · FinTech Platforms</p>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    88% Match
                  </span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                      Evidenced in Your Resume ({`8`})
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["React", "TypeScript", "Node.js", "PostgreSQL", "Next.js", "Redis", "GraphQL", "Tailwind CSS"].map((skill) => (
                        <span key={skill} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                          <Check size={11} aria-hidden="true" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      Missing from Resume ({`3`})
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["Kubernetes", "Kafka", "Micro-frontends"].map((skill) => (
                        <span key={skill} className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                          + {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
                <span className="text-xs text-[var(--muted-fg)]">Compare any resume against any job description free:</span>
                <Button as="a" href="/resume-match" size="sm" rightIcon={<ChevronRight size={14} />}>
                  Match My Resume to a Job
                </Button>
              </div>
            </div>
          )}

          {/* Tab 3: AI Bullet Enhancer */}
          {activeTab === "tailor" && (
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3 pb-4">
                <span className="text-xs font-medium text-[var(--muted-fg)]">
                  Compare the transformation:
                </span>
                <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setShowEnhanced(false)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                      !showEnhanced ? "bg-[var(--surface)] text-[var(--fg)] shadow-sm" : "text-[var(--muted-fg)]"
                    }`}
                  >
                    Original Bullet
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEnhanced(true)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                      showEnhanced ? "bg-[var(--color-primary-solid)] text-white shadow-sm" : "text-[var(--muted-fg)]"
                    }`}
                  >
                    RoleSharp Tailored ✨
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5">
                {!showEnhanced ? (
                  <div>
                    <span className="font-mono text-xs uppercase tracking-wider text-[var(--muted-fg)]">
                      Standard Candidate Draft (Weak)
                    </span>
                    <p className="mt-2 text-base leading-relaxed text-[var(--fg)] line-through decoration-red-500/50">
                      &ldquo;Worked on frontend features for the web app, fixed bugs, and helped team members release new updates.&rdquo;
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-red-600 dark:text-red-400">
                      <span>✕ No quantified metrics</span>
                      <span>✕ Vague action verbs (&ldquo;worked on&rdquo;)</span>
                      <span>✕ Missing technology stack context</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                      RoleSharp Enhanced (Evidence-Grounded)
                    </span>
                    <p className="mt-2 text-base font-medium leading-relaxed text-[var(--fg)]">
                      &ldquo;Architected <strong>14 responsive React & Next.js workflows</strong> and automated Redis caching, reducing customer checkout latency by <strong>41%</strong> across <strong>120K+ monthly active users</strong>.&rdquo;
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-emerald-800 dark:text-emerald-200">
                      <span>✓ High-impact power verb (&ldquo;Architected&rdquo;)</span>
                      <span>✓ Quantified result (41% latency drop)</span>
                      <span>✓ Grounded in verifiable stack evidence</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
                <span className="text-xs text-[var(--muted-fg)]">Turn weak bullet points into executive-ready achievements:</span>
                <Button as="a" href="/resume-fixer" size="sm" rightIcon={<ChevronRight size={14} />}>
                  Enhance Bullets with Resume Fixer
                </Button>
              </div>
            </div>
          )}

          {/* Tab 4: Salary Benchmark */}
          {activeTab === "salary" && (
            <div className="p-6 sm:p-8">
              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
                  <div>
                    <span className="text-xs text-[var(--muted-fg)]">Verified Market Salary Report</span>
                    <p className="text-sm font-bold text-[var(--fg)]">Staff Software Engineer · United States (Remote)</p>
                  </div>
                  <span className="font-mono text-xs text-[var(--muted-fg)]">482 Live Verified Postings</span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3 text-center">
                    <span className="text-[11px] text-[var(--muted-fg)]">25th Percentile</span>
                    <p className="mt-1 text-lg font-bold text-[var(--fg)]">$145,000</p>
                  </div>
                  <div className="rounded-lg border border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] p-3 text-center shadow-sm">
                    <span className="text-[11px] font-semibold text-[var(--primary)]">Median Benchmark</span>
                    <p className="mt-1 text-lg font-extrabold text-[var(--primary)]">$178,000</p>
                  </div>
                  <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3 text-center">
                    <span className="text-[11px] text-[var(--muted-fg)]">75th Percentile</span>
                    <p className="mt-1 text-lg font-bold text-[var(--fg)]">$210,000</p>
                  </div>
                  <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3 text-center">
                    <span className="text-[11px] text-[var(--muted-fg)]">Top 10% (Lead)</span>
                    <p className="mt-1 text-lg font-bold text-[var(--fg)]">$245,000</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
                <span className="text-xs text-[var(--muted-fg)]">Explore live compensation data across 400+ roles & countries:</span>
                <Button as="a" href="/salaries" size="sm" rightIcon={<ChevronRight size={14} />}>
                  Explore Live Salaries
                </Button>
              </div>
            </div>
          )}

          {/* Tab 5: Daily Matches & Role Discovery */}
          {activeTab === "matches" && (
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                      Daily Opportunity Snapshot
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-200">
                      3 High-Fit Matches
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[var(--fg)]">
                    Matched against verified resume skills: TypeScript, React, Next.js & System Design
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[var(--muted-fg)]">Fit Floor: 85%+</span>
                </div>
              </div>

              {/* 3 Role Match Cards */}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col justify-between rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4 transition-all hover:border-[var(--primary)]">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[var(--muted-fg)]">Stripe</span>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
                        94% Match
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-[var(--fg)]">Staff Frontend Engineer</h4>
                    <p className="mt-1 text-xs text-[var(--muted-fg)]">Payments UI · Remote (US/EU)</p>
                    <div className="mt-3 flex flex-wrap gap-1 text-[10px] font-medium text-[var(--fg)]">
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-emerald-800 dark:text-emerald-200">✓ React 19</span>
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-emerald-800 dark:text-emerald-200">✓ TypeScript</span>
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-emerald-800 dark:text-emerald-200">✓ Next.js</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[var(--hairline)]">
                    <a href="/build" className="text-[11px] font-bold text-[var(--primary)] hover:underline">1-Click Tailor →</a>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4 transition-all hover:border-[var(--primary)]">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[var(--muted-fg)]">Linear</span>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
                        91% Match
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-[var(--fg)]">Senior Product Engineer</h4>
                    <p className="mt-1 text-xs text-[var(--muted-fg)]">Core Workflow · Remote</p>
                    <div className="mt-3 flex flex-wrap gap-1 text-[10px] font-medium text-[var(--fg)]">
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-emerald-800 dark:text-emerald-200">✓ State Sync</span>
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-emerald-800 dark:text-emerald-200">✓ TypeScript</span>
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-amber-800 dark:text-amber-200">⚠ WebSockets</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[var(--hairline)]">
                    <a href="/build" className="text-[11px] font-bold text-[var(--primary)] hover:underline">1-Click Tailor →</a>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4 transition-all hover:border-[var(--primary)]">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[var(--muted-fg)]">Vercel</span>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
                        89% Match
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-[var(--fg)]">Full Stack Platform Engineer</h4>
                    <p className="mt-1 text-xs text-[var(--muted-fg)]">Developer Exp · Remote</p>
                    <div className="mt-3 flex flex-wrap gap-1 text-[10px] font-medium text-[var(--fg)]">
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-emerald-800 dark:text-emerald-200">✓ Next.js 15</span>
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-emerald-800 dark:text-emerald-200">✓ Server Actions</span>
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-emerald-800 dark:text-emerald-200">✓ Edge Runtime</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[var(--hairline)]">
                    <a href="/build" className="text-[11px] font-bold text-[var(--primary)] hover:underline">1-Click Tailor →</a>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
                <span className="text-xs text-[var(--muted-fg)]">
                  Stop scrolling job boards — let evidence-grounded matching surface high-fit roles automatically:
                </span>
                <Button as="a" href="/daily-matches" size="sm" rightIcon={<ChevronRight size={14} />}>
                  Explore Daily Matches
                </Button>
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
