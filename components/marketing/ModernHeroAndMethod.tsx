"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Shield } from "@/app/icons";
import { Button, Container } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";
import { TOOLS } from "@/lib/tools-registry";

const INSTANT_TOOLS = [
  { label: "Daily Matches", badge: "Premium", href: "/daily-matches" },
  { label: "ATS Checker", badge: "Popular", href: "/checker" },
  { label: "Resume Match", badge: "Free", href: "/resume-match" },
  { label: "Salary Estimator", badge: "Live Data", href: "/salaries" },
  { label: "Resume Fixer", badge: "AI", href: "/resume-fixer" },
  { label: "AI Resume Builder", badge: "Tailor", href: "/build" },
] as const;

export function ModernHeroAndMethod({ studentOfferEnabled = false }: { studentOfferEnabled?: boolean }) {
  const [inspectTab, setInspectTab] = useState<"grounded" | "refused">("grounded");

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)] pt-10 pb-16 md:pt-16 md:pb-24">
        <Container size="large">
          {/* Top Referral & Student Strip — the student pill only runs while
              the program is open; advertising a closed program reads as a
              broken promise (F-05). */}
          <Reveal variant="rise">
            <div className="mb-8 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
              <Link
                href="/settings?tab=credits"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1 text-xs font-medium text-[var(--fg)] shadow-2xs transition-colors hover:border-[var(--primary)]"
              >
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                  Referral
                </span>
                <span>Invite a friend, earn free Premium credits (up to 3 / 30d)</span>
                <span className="font-bold text-[var(--primary)]" aria-hidden="true">→</span>
              </Link>
              {studentOfferEnabled && (
              <Link
                href="/students"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1 text-xs font-medium text-[var(--fg)] shadow-2xs transition-colors hover:border-[var(--primary)]"
              >
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Students
                </span>
                <span>6 months of Premium free with university email · No card</span>
                <span className="font-bold text-[var(--primary)]" aria-hidden="true">→</span>
              </Link>
              )}
            </div>
          </Reveal>

          <div className="grid items-center gap-12 lg:grid-cols-12">
            {/* Left Copy Column */}
            <div className="lg:col-span-7">
              <Reveal variant="rise">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1 text-xs font-semibold text-[var(--primary)]">
                  <Shield size={13} aria-hidden="true" />
                  <span>Free resume tools — No signup required</span>
                </div>

                <h1 className="mt-5 text-[clamp(2.35rem,4.5vw,3.75rem)] font-extrabold! leading-[1.03]! tracking-[-0.04em]! text-[var(--fg)] text-balance">
                  Your resume, sharpened for one exact job.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted-fg)] md:text-lg md:leading-8">
                  Score it against any job, fix what the ATS actually reads, then tailor every line from evidence you already have.{" "}
                  <strong className="font-semibold text-[var(--fg)]">No borrowed titles. No invented metrics.</strong>
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3.5">
                  <Button as="a" href="/checker" variant="primary" className="px-6 py-3 text-sm shadow-md">
                    Check my resume free
                  </Button>
                  <Button as="a" href="/build" variant="outline" className="px-6 py-3 text-sm">
                    Tailor for a job
                  </Button>
                  <Link
                    href="/tools#catalogue"
                    className="px-2 text-xs font-semibold text-[var(--muted-fg)] underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--fg)]"
                  >
                    Browse all {TOOLS.length} free tools →
                  </Link>
                </div>

                {/* Instant Free Tools Bar */}
                <div className="mt-9 border-t border-[var(--hairline)] pt-6">
                  <p className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-fg)]">
                    Instant free tools — click to launch
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {INSTANT_TOOLS.map((tool) => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--fg)] shadow-2xs transition-all hover:border-[var(--primary)] hover:bg-[var(--surface-2)]"
                      >
                        <span>{tool.label}</span>
                        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                          {tool.badge}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Right Interactive Evidence Inspector Card */}
            <div className="lg:col-span-5">
              <Reveal variant="rise" delay={100}>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
                  <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-4">
                    <div>
                      <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-wider text-[var(--muted-fg)]">
                        Match Report — sampledata-analyst.pdf
                      </span>
                      <h2 className="mt-0.5 text-sm font-bold text-[var(--fg)]">
                        Senior Product Data Analyst · Stripe
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-emerald-800 dark:text-emerald-200">
                      <span className="text-2xl font-extrabold">78</span>
                      <span className="text-[10px] font-bold uppercase leading-tight">Strong<br />Match</span>
                    </div>
                  </div>

                  {/* Keyword Coverage Pills */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--fg)]">9 of 12 posting keywords evidenced</span>
                      <span className="text-[11px] text-[var(--muted-fg)]">2 hard gaps listed honestly</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-2 py-1 text-emerald-800 dark:text-emerald-200">
                        <Check size={12} /> Stakeholder reporting
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-2 py-1 text-emerald-800 dark:text-emerald-200">
                        <Check size={12} /> SQL + dashboards
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-2 py-1 text-emerald-800 dark:text-emerald-200">
                        <Check size={12} /> Renewals workflow
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-amber-800 dark:text-amber-200">
                        Gap: A/B experiment design
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-amber-800 dark:text-amber-200">
                        Gap: Executive presentations
                      </span>
                    </div>
                  </div>

                  {/* Interactive Evidence vs. Refusal Proof Toggle */}
                  <div className="mt-5 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-wider text-[var(--muted-fg)]">
                        How RoleSharp Edits
                      </span>
                      <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setInspectTab("grounded")}
                          className={`rounded-md px-2.5 py-1 transition-colors ${
                            inspectTab === "grounded"
                              ? "bg-[var(--color-primary-solid)] text-white"
                              : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
                          }`}
                        >
                          Grounded Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectTab("refused")}
                          className={`rounded-md px-2.5 py-1 transition-colors ${
                            inspectTab === "refused"
                              ? "bg-[var(--color-primary-solid)] text-white"
                              : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
                          }`}
                        >
                          What We Refuse
                        </button>
                      </div>
                    </div>

                    {inspectTab === "grounded" ? (
                      <div className="mt-3 text-xs">
                        <p className="rounded-lg border border-emerald-500/30 bg-[var(--surface)] p-3 font-medium leading-5 text-[var(--fg)]">
                          “Led the billing-flow redesign for a B2B SaaS product, reducing failed renewals by 18%.”
                        </p>
                        <p className="mt-2 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-200">
                          <span>✓ Source: Existing experience bullet #2</span>
                          <span className="font-semibold">Requirement: Outcome ownership</span>
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 text-xs">
                        <p className="rounded-lg border border-rose-500/30 bg-[var(--surface)] p-3 font-medium leading-5 text-[var(--muted-fg)] line-through">
                          “Managed a cross-functional team of 12 analysts across 3 regions.”
                        </p>
                        <p className="mt-2 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-200">
                          <span>✕ Blocked: No supporting evidence in your file</span>
                          <span className="font-semibold">Flagged as honest gap instead</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-[var(--muted-fg)]">Works with PDF, DOCX & plain text</span>
                    <Link href="/checker" className="font-bold text-[var(--primary)] hover:underline">
                      Open live checker ↗
                    </Link>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Verifiable Catalogue Metrics Strip */}
          <Reveal variant="rise" delay={160}>
            <div className="mt-14 grid grid-cols-2 gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-6 sm:grid-cols-4">
              <div>
                <div className="text-2xl font-extrabold text-[var(--fg)] sm:text-3xl">113,113</div>
                <div className="mt-1 text-xs font-medium text-[var(--muted-fg)]">Company guides indexed</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[var(--fg)] sm:text-3xl">1,021</div>
                <div className="mt-1 text-xs font-medium text-[var(--muted-fg)]">Role guides tailored</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[var(--fg)] sm:text-3xl">209</div>
                <div className="mt-1 text-xs font-medium text-[var(--muted-fg)]">Country formatting contexts</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[var(--fg)] sm:text-3xl">72</div>
                <div className="mt-1 text-xs font-medium text-[var(--muted-fg)]">Active job markets covered</div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
