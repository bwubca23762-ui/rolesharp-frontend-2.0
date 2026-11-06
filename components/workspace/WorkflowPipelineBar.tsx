"use client";
import Link from "next/link";

// Pipeline bar (Phase 4 frontend pass): the jobs-workflow surfaces in the
// order a member actually uses them. The workspace rail (workspace-context-nav)
// lists the same destinations alphabetically-ish on desktop; this bar carries
// the SEQUENCE — configure, connect, match, review, track — and stays visible
// on mobile where the rail collapses. One row, active step highlighted.

const PIPELINE_STEPS: { href: string; label: string }[] = [
  { href: "/campaign-settings", label: "Campaign rules" },
  { href: "/email-connection", label: "Mailbox" },
  { href: "/daily-matches", label: "Daily matches" },
  { href: "/application-queue", label: "Review queue" },
  { href: "/tracker", label: "Tracker" },
  { href: "/auto-apply", label: "Auto apply" },
];

export function WorkflowPipelineBar({ currentHref }: { currentHref: string }) {
  return (
    <nav
      aria-label="Application pipeline"
      className="mb-5 overflow-x-auto"
    >
      <ol className="inline-flex min-w-full items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]">
        {PIPELINE_STEPS.map((step, i) => {
          const active = currentHref === step.href;
          return (
            <li key={step.href} className="flex shrink-0 items-center">
              {i > 0 && <span aria-hidden="true" className="mx-1 text-xs text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)]">→</span>}
              <Link
                href={step.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
                  active
                    ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] dark:text-[var(--color-dark-text-muted)] dark:hover:text-[var(--color-dark-text)]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text-muted)]"
                  }`}
                >
                  {i + 1}
                </span>
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default WorkflowPipelineBar;
