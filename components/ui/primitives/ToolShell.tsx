import type { ReactNode } from "react";
import { BookOpen, ChevronDown, FileText, LayoutGrid, RotateCcw } from "lucide-react";
import { Container } from "./Container";
import { Section } from "./Section";

export type ToolVisual = "checker" | "fixer" | "linkedin" | "maker";

const PIPELINE_STEPS = [
  { label: "1. ATS Check", href: "/checker" },
  { label: "2. Fix Bullets", href: "/resume-fixer" },
  { label: "3. Match JD", href: "/resume-match" },
  { label: "4. Tailor Resume", href: "/build" },
  { label: "5. Find Jobs", href: "/jobs" },
] as const;

export function ToolShell({
  children,
  eyebrow,
  title,
  subtitle,
  workspaceSize = "large",
  pipelineContext,
  onLoadSample,
  onReset,
  helpHref,
  actions,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  workspaceSize?: "default" | "large";
  icon?: ReactNode;
  visual?: ToolVisual;
  pipelineContext?: ReactNode;
  onLoadSample?: () => void;
  onReset?: () => void;
  helpHref?: string;
  actions?: ReactNode;
}) {
  const control = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";
  return (
    <main>
      <section className="desk-tool-header border-b border-[var(--hairline)]">
        <Container size="large" className="py-6 md:py-9">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <header className="min-w-0 max-w-2xl">
              <h1 className="text-[clamp(1.75rem,2.6vw,2.1rem)] font-bold! leading-[1.1]! tracking-[-0.035em]! text-[var(--fg)] text-balance">{title}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted-fg)]">{subtitle}</p>
              <span className="sr-only">{eyebrow}</span>
            </header>
            <div className="flex flex-wrap items-center gap-2">
              {onLoadSample && <button type="button" onClick={onLoadSample} className={control}><FileText size={16} aria-hidden="true" />Load sample</button>}
              {onReset && <button type="button" onClick={onReset} className={control}><RotateCcw size={16} aria-hidden="true" />Reset</button>}
              {helpHref && <a href={helpHref} className={control}><BookOpen size={16} aria-hidden="true" />Guide</a>}
              {actions}
              <a href="/tools" className={control}><LayoutGrid size={16} aria-hidden="true" />All tools</a>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4">
            <details className="group min-w-0">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-sm font-medium text-[var(--muted-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] [&::-webkit-details-marker]:hidden">
                Resume workflow <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <nav aria-label="Resume workflow" className="flex flex-wrap gap-2 pb-2">
                {PIPELINE_STEPS.map((step) => <a key={step.href} href={step.href} className={control}>{step.label}</a>)}
              </nav>
            </details>
            {pipelineContext && <div className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-[var(--fg)]">{pipelineContext}</div>}
          </div>
        </Container>
      </section>
      <Section size="sm" containerSize={workspaceSize} className="tool-shell-workspace">{children}</Section>
    </main>
  );
}
