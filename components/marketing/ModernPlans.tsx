"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, GraduationCap, Shield, Lock, ChevronDown } from "@/app/icons";
import { Button, Container } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";
import {
  DEFAULT_DAYS_MONTHLY,
  DEFAULT_DAYS_YEARLY,
  DEFAULT_FREE_MONTHLY_LIMIT,
  DEFAULT_PREMIUM_MONTHLY_LIMIT,
  DEFAULT_STUDENT_MONTHLY_LIMIT,
  formatPlanPrice,
  tailoredResumes,
} from "@/lib/limits";

export interface ModernPlansProps {
  freeMonthlyLimit?: number;
  premiumMonthlyLimit?: number;
  studentMonthlyLimit?: number;
  priceMonthlyCents?: number;
  priceYearlyCents?: number;
  daysMonthly?: number;
  daysYearly?: number;
  studentOfferEnabled?: boolean;
}

export function ModernPlans({
  freeMonthlyLimit = DEFAULT_FREE_MONTHLY_LIMIT,
  premiumMonthlyLimit = DEFAULT_PREMIUM_MONTHLY_LIMIT,
  studentMonthlyLimit = DEFAULT_STUDENT_MONTHLY_LIMIT,
  priceMonthlyCents = 1200,
  priceYearlyCents = 7900,
  daysMonthly = DEFAULT_DAYS_MONTHLY,
  daysYearly = DEFAULT_DAYS_YEARLY,
  studentOfferEnabled = true,
}: ModernPlansProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "yearly">("monthly");
  const [showMatrix, setShowMatrix] = useState(false);

  const monthlyPrice = formatPlanPrice(priceMonthlyCents);
  const yearlyPrice = formatPlanPrice(priceYearlyCents);

  const annualizedMonthlyCents = priceMonthlyCents * 12;
  const savingsPercent =
    annualizedMonthlyCents > priceYearlyCents
      ? Math.round((1 - priceYearlyCents / annualizedMonthlyCents) * 100)
      : 45;
  const yearlyPerMonthEquivalent = formatPlanPrice(Math.round(priceYearlyCents / 12));

  // Pricing is public, but creating an order must be bound to an account. The
  // billing panel lets the user choose crypto (USD) or Razorpay (INR) rather
  // than silently opening one processor after a marketing-page click.
  const premiumCheckoutHref = `/settings?tab=billing&plan=${selectedPeriod}`;

  return (
    <section id="plans" className="scroll-mt-20 border-b border-[var(--hairline)] py-8 md:py-12">
      <Container size="large">
        <Reveal variant="rise">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1 text-xs font-semibold text-[var(--primary)] shadow-2xs">
              <Shield size={13} aria-hidden="true" />
              <span>Honest, Fixed-Term Passes</span>
            </div>
            <h2 className="mt-4 text-[clamp(2rem,3.6vw,2.85rem)] font-extrabold! leading-[1.04]! tracking-[-0.035em]! text-[var(--fg)] text-balance">
              Exact allowances. Zero recurring subscriptions.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--muted-fg)] md:text-lg md:leading-8">
              Manual tools remain completely free forever. Premium is paid once for a fixed term, never auto-renews, and drops back to Free when access ends.
            </p>

            {/* Interactive Billing Pass Switcher */}
            <div className="mt-8 flex justify-center">
              <div
                role="group"
                aria-label="Select fixed-term pass duration"
                className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1 shadow-2xs"
              >
                <button
                  type="button"
                  aria-pressed={selectedPeriod === "monthly"}
                  onClick={() => setSelectedPeriod("monthly")}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-all sm:px-5 sm:text-sm ${
                    selectedPeriod === "monthly"
                      ? "bg-[var(--surface)] text-[var(--fg)] shadow-sm"
                      : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
                  }`}
                >
                  {daysMonthly}-Day Sprint ({monthlyPrice})
                </button>
                <button
                  type="button"
                  aria-pressed={selectedPeriod === "yearly"}
                  onClick={() => setSelectedPeriod("yearly")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:px-5 sm:text-sm ${
                    selectedPeriod === "yearly"
                      ? "bg-[var(--surface)] text-[var(--fg)] shadow-sm"
                      : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
                  }`}
                >
                  <span>{daysYearly}-Day Career ({yearlyPrice})</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-200 sm:text-[11px]">
                    SAVE {savingsPercent}%
                  </span>
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-[var(--muted-fg)]">
              University student?{" "}
              <a
                href="#student-access"
                className="font-semibold text-[var(--primary)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--primary)]"
              >
                Claim 6 months of free academic access ↓
              </a>
            </p>
          </div>
        </Reveal>

        {/* 2-Column Main Plans Grid */}
        <div className="mx-auto mt-6 grid max-w-4xl gap-8 md:grid-cols-2 md:items-stretch">
          {/* Card 1: Free */}
          <Reveal variant="rise" delay={0}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-sm transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-md sm:p-8">
              <div>
                <div className="flex items-center justify-between gap-2 border-b border-[var(--hairline)] pb-4">
                  <div>
                    <h3 className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-fg)]">
                      Free
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-[var(--fg)]">Diagnostic & Manual Prep</p>
                  </div>
                  <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-bold text-[var(--muted-fg)]">
                    No Card Needed
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold! tracking-tight text-[var(--fg)]">$0</span>
                  <span className="text-sm font-medium text-[var(--muted-fg)]">forever</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-fg)]">
                  Check, build, and export without a card.
                </p>

                <ul className="mt-7 space-y-3.5 text-xs font-medium text-[var(--fg)]">
                  <li className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>
                      <strong>{tailoredResumes(freeMonthlyLimit)}</strong> per rolling month
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>ATS score and ranked keyword fixes</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>PDF export and unlimited manual tools</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>All 20+ free career tools with no account needed</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>Permanent document retention (never locked)</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 border-t border-[var(--hairline)] pt-6">
                <Button as="a" href="/build" variant="outline" className="w-full justify-center">
                  Start free
                </Button>
                <p className="mt-3 text-center font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted-fg)]">
                  No card — no trial clock
                </p>
              </div>
            </div>
          </Reveal>

          {/* Card 2: Premium (Featured / Recommended) */}
          <Reveal variant="rise" delay={80}>
            <div className="relative flex h-full flex-col justify-between rounded-2xl border-2 border-[var(--primary)] bg-[var(--surface)] p-7 shadow-xl transition-all duration-200 md:-translate-y-1 sm:p-8">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-white shadow-sm">
                  <Sparkles size={12} className="text-amber-300" aria-hidden="true" />
                  <span>Recommended for Job Search</span>
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 border-b border-[var(--hairline)] pb-4">
                  <div>
                    <h3 className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
                      Premium
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-[var(--fg)]">Full Job Search Arsenal</p>
                  </div>
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                    Paid Once · No Auto-Renew
                  </span>
                </div>

                <div className="mt-6">
                  {selectedPeriod === "monthly" ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-extrabold! tracking-tight text-[var(--fg)]">{monthlyPrice}</span>
                      <span className="text-sm font-semibold text-[var(--muted-fg)]">once for {daysMonthly} days</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-5xl font-extrabold! tracking-tight text-[var(--fg)]">{yearlyPrice}</span>
                      <span className="text-sm font-semibold text-[var(--muted-fg)]">once for {daysYearly} days</span>
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                        ~{yearlyPerMonthEquivalent}/mo
                      </span>
                    </div>
                  )}
                  <p className="mt-2 text-xs leading-5 text-[var(--muted-fg)]">
                    {selectedPeriod === "monthly"
                      ? `${yearlyPrice} once for ${daysYearly} days available. Neither option auto-renews.`
                      : `Saves ${savingsPercent}% compared to 30-day passes. Paid once for 1 full year of career coverage.`}
                  </p>
                </div>

                <ul className="mt-7 space-y-3.5 text-xs font-medium text-[var(--fg)]">
                  <li className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>
                      <strong>{tailoredResumes(premiumMonthlyLimit)}</strong> per rolling month
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>
                      <strong>Live Mock Interview with Voice AI</strong> & STAR coaching
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>
                      <strong>DOCX, every template, cover letters, and interview prep</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Sparkles size={15} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                    <span className="flex-1">
                      <Link
                        href="/auto-apply"
                        className="underline decoration-[var(--border)] underline-offset-4 transition-colors hover:text-[var(--primary)] hover:decoration-[var(--primary)]"
                      >
                        Auto Apply — application email you approve first
                      </Link>
                      <span className="ml-2 inline-block rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                        Access by request
                      </span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Sparkles size={15} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                    <span className="flex-1">
                      <Link
                        href="/daily-matches"
                        className="font-bold underline decoration-[var(--border)] underline-offset-4 transition-colors hover:text-[var(--primary)] hover:decoration-[var(--primary)]"
                      >
                        Daily Matches — evidence-backed role suggestions
                      </Link>
                      <span className="ml-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                        Premium
                      </span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>Evidence-backed bullet rewrites grounded in your real metrics</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>LinkedIn Headline & Bio Optimizer with keyword targeting</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 border-t border-[var(--hairline)] pt-6">
                <Button as="a" href={premiumCheckoutHref} variant="primary" className="w-full justify-center shadow-md">
                  {selectedPeriod === "monthly" ? `Get ${daysMonthly}-Day Pass` : `Get ${daysYearly}-Day Pass`}
                </Button>
                <p className="mt-3 text-center font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted-fg)]">
                  Paid once — never auto-renews — drops to Free at term end
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Dedicated Student & Academic Access Banner ("Another Way") */}
        <Reveal variant="rise" delay={140}>
          <div
            id="student-access"
            className="mx-auto mt-8 max-w-4xl rounded-2xl border border-blue-500/25 bg-gradient-to-r from-blue-500/[0.06] via-[var(--surface-2)] to-indigo-500/[0.06] p-6 shadow-sm transition-all duration-200 hover:border-blue-500/40 sm:p-8"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                    <GraduationCap size={14} aria-hidden="true" />
                    <span>Student & University Access</span>
                  </span>
                  <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-xs font-extrabold text-[var(--fg)] shadow-2xs">
                    {studentOfferEnabled ? "$0 for 6 months" : "Waitlist only"}
                  </span>
                  <span className="text-xs text-[var(--muted-fg)]">
                    • University email required — no card
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold tracking-tight text-[var(--fg)] sm:text-xl">
                    Studying or active university student?
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)] sm:text-sm">
                    Premium features with a reduced allowance — full ATS keyword fixes, watermark-free PDF exports, and Voice AI mock interview practice.
                  </p>
                </div>

                <ul className="grid gap-2 text-xs font-medium text-[var(--fg)] sm:grid-cols-2">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>
                      <strong>{tailoredResumes(studentMonthlyLimit)}</strong> per rolling month
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>Premium exports and application tools</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>Voice AI Live Mock Interview practice</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="shrink-0 text-emerald-800 dark:text-emerald-200" />
                    <span>University email required; no card</span>
                  </li>
                </ul>
              </div>

              <div className="flex shrink-0 flex-col items-stretch sm:items-end">
                <Button
                  as="a"
                  href="/students"
                  variant="outline"
                  className="w-full justify-center border-blue-500/30 bg-[var(--surface)] font-bold text-blue-700 shadow-sm hover:border-blue-500 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40 sm:w-auto"
                >
                  <GraduationCap size={15} className="mr-1.5" aria-hidden="true" />
                  {studentOfferEnabled ? "Claim student access" : "Join student waitlist"}
                </Button>
                <p className="mt-2 text-center font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted-fg)] sm:text-right">
                  University email — no card
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Feature Comparison Accordion */}
        <div className="mt-12 text-center">
          <button
            type="button"
            aria-expanded={showMatrix}
            aria-controls="plans-feature-matrix"
            onClick={() => setShowMatrix((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-xs font-semibold text-[var(--fg)] shadow-2xs transition-colors hover:bg-[var(--surface-2)]"
          >
            <span>{showMatrix ? "Hide complete feature comparison" : "Compare all features across plans"}</span>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`transition-transform duration-200 ${showMatrix ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {showMatrix && (
          <Reveal variant="rise">
            <div
              id="plans-feature-matrix"
              className="mt-8 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6 shadow-sm"
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hairline)] text-[var(--muted-fg)]">
                    <th scope="col" className="pb-3 font-semibold uppercase tracking-wider">Feature</th>
                    <th scope="col" className="pb-3 font-semibold uppercase tracking-wider">Free</th>
                    <th scope="col" className="pb-3 font-bold uppercase tracking-wider text-[var(--primary)]">Premium</th>
                    <th scope="col" className="pb-3 font-semibold uppercase tracking-wider">Student</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)] text-[var(--fg)]">
                  <tr>
                    <td className="py-3 font-medium">Monthly Tailored Resumes</td>
                    <td className="py-3 font-semibold">{freeMonthlyLimit} / month</td>
                    <td className="py-3 font-extrabold text-[var(--primary)]">{premiumMonthlyLimit} / month</td>
                    <td className="py-3 font-semibold">{studentMonthlyLimit} / month</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium">ATS Diagnostic & Keyword Fixes</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Unlimited</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Unlimited</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium">Evidence-Grounded Bullet Rewrites</td>
                    <td className="py-3 text-[var(--muted-fg)]">1 resume / month</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">5 resumes / month</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">2 resumes / month</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium">Voice Mock Interview AI</td>
                    <td className="py-3 text-[var(--muted-fg)]">Diagnostic preview</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Full Voice Coaching</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Full Voice Coaching</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium">AI Cover Letter Generator</td>
                    <td className="py-3 text-[var(--muted-fg)]">Manual template</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Grounded in Resume</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Grounded in Resume</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium">Export Formats</td>
                    <td className="py-3">PDF</td>
                    <td className="py-3 font-semibold text-[var(--primary)]">DOCX & PDF</td>
                    <td className="py-3 font-semibold">Watermark-free PDF</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium">Daily Matches & Role Discovery</td>
                    <td className="py-3 text-[var(--muted-fg)]">—</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Included (Daily Matches)</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Included (Student Tier)</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium">Auto Apply by Email</td>
                    <td className="py-3 text-[var(--muted-fg)]">—</td>
                    <td className="py-3 font-semibold text-amber-800 dark:text-amber-200">Access by request</td>
                    <td className="py-3 text-[var(--muted-fg)]">—</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium">Auto-Renewal Trap</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Never (No card)</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Never (Paid once)</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Never (No card)</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium">Document Retention</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Permanent</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Permanent</td>
                    <td className="py-3 font-semibold text-emerald-800 dark:text-emerald-200">Permanent</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Reveal>
        )}

        {/* Trust & Transparency Guarantee Strip */}
        <Reveal variant="rise" delay={240}>
          <div className="mt-14 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)] p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface)] text-emerald-800 dark:text-emerald-200 shadow-2xs">
                  <Shield size={18} aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--fg)]">No Automatic Billing</h4>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">
                    We never store recurring card tokens. When your term ends, access simply closes without a charge.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface)] text-blue-700 dark:text-blue-300 shadow-2xs">
                  <Lock size={18} aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--fg)]">Permanent Resume Ownership</h4>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">
                    Resumes you generate are never held hostage. View and export existing drafts anytime on Free.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface)] text-amber-800 dark:text-amber-200 shadow-2xs">
                  <Sparkles size={18} aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--fg)]">Credit Rewards Program</h4>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">
                    Earn bonus referral credits whenever an invited colleague or friend verifies their email and builds their first resume.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
