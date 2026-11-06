"use client";

import { Badge, Button } from "@/components/ui/primitives";
import { Check, Globe, Sparkles } from "@/app/icons";

// Live job suggestions rendered right after a resume is generated. The
// matched jobs are real postings from the jobs table (title-matched,
// home-market first); the card deliberately does NOT show a fabricated match
// percentage — the directive's fake "84% match" badges violated the
// no-invented-numbers rule, so each row carries an honest "Live match" badge.
export interface MatchedJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  country_code: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  is_remote: boolean;
  apply_url: string;
  date_posted: string | null;
}

interface RecommendedJobsCardProps {
  jobs: MatchedJob[];
  roleTitle: string;
  countryCode: string;
  /** Opt-in flag state for the weekly alert (explicit consent, never auto). */
  alertState?: "idle" | "enrolling" | "enrolled";
  onEnrollAlert?: () => void;
  onTailorClick?: (jobTitle: string, company: string) => void;
}

export default function RecommendedJobsCard({
  jobs,
  roleTitle,
  alertState = "idle",
  onEnrollAlert,
  onTailorClick,
}: RecommendedJobsCardProps) {
  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="card mt-6 rounded-2xl border-2 border-[color-mix(in_oklab,var(--color-primary)_30%,transparent)] bg-[var(--color-surface)] p-5 shadow-lg md:p-6 dark:bg-[var(--color-dark-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3 dark:border-[var(--color-dark-border)]">
        <div>
          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            <Sparkles size={12} aria-hidden="true" /> Live matching openings
          </span>
          <h3 className="text-lg font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            Jobs matching your new resume
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Live postings for &ldquo;{roleTitle}&rdquo; — matched to your location preferences.
          </p>
        </div>
        <a
          href="/settings?tab=matching"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
        >
          <Globe size={13} aria-hidden="true" /> Country &amp; location settings
        </a>
      </div>

      <div className="mt-4 grid gap-3">
        {jobs.slice(0, 4).map((job) => {
          const salary = job.salary_min && job.salary_max
            ? `${job.salary_currency || "$"} ${Number(job.salary_min).toLocaleString()} - ${Number(job.salary_max).toLocaleString()}`
            : null;
          return (
            <div
              key={job.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 transition-all hover:border-[color-mix(in_oklab,var(--color-primary)_50%,transparent)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-base font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                    {job.title}
                  </h4>
                  <p className="mt-0.5 text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                    <strong>{job.company}</strong> · {job.location || job.country_code}
                    {job.is_remote && <span className="ml-1.5 text-[var(--color-primary)]">· Remote</span>}
                    {salary && <span className="ml-1.5 font-semibold text-[var(--color-success)]">· {salary}</span>}
                  </p>
                </div>
                <Badge variant="success" className="text-xs font-bold">Live match</Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[color-mix(in_oklab,var(--color-border)_60%,transparent)] pt-2 dark:border-[color-mix(in_oklab,var(--color-dark-border)_60%,transparent)]">
                <Button
                  as="a"
                  href={job.apply_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  size="compact"
                  variant="primary"
                >
                  Apply on site ↗
                </Button>
                {onTailorClick && (
                  <Button
                    size="compact"
                    variant="outline"
                    onClick={() => onTailorClick(job.title, job.company)}
                  >
                    Tailor for this job
                  </Button>
                )}
                <Button
                  as="a"
                  href="/interview-questions"
                  size="compact"
                  variant="ghost"
                >
                  Prep for this interview
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {onEnrollAlert && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[color-mix(in_oklab,var(--color-primary)_10%,transparent)] px-3.5 py-2.5 text-xs text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
          {alertState === "enrolled" ? (
            <span className="flex items-center gap-1.5 font-medium">
              <Check size={14} aria-hidden="true" className="shrink-0 text-[var(--color-success)]" />
              Weekly alert active — we&apos;ll email you top new matches for &ldquo;{roleTitle}&rdquo;. <a href="/job-alerts" className="ml-1 font-bold text-[var(--color-primary)] underline">Manage alerts</a>
            </span>
          ) : (
            <>
              <span className="font-medium">Want the top new matches for this role by email every week?</span>
              <Button size="compact" variant="outline" isLoading={alertState === "enrolling"} onClick={onEnrollAlert}>
                Enroll in the weekly alert
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
