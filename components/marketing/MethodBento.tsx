import { Container } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";
import { Shield, Target, Lock, Check } from "@/app/icons";

export function MethodBento() {
  return (
    <section id="method" className="scroll-mt-20 border-b border-[var(--hairline)] py-8 md:py-12">
      <Container size="large">
        <Reveal variant="rise">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
              The RoleSharp Standard
            </p>
            <h2 className="mt-3 text-[clamp(1.9rem,3.4vw,2.75rem)] font-extrabold! leading-[1.05]! tracking-[-0.035em]! text-[var(--fg)] text-balance">
              Built on truth. Refusing generic AI hallucinations.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--muted-fg)] md:text-lg md:leading-8">
              Keep your experience accurate, your layout readable, and your application under your control.
            </p>
          </div>
        </Reveal>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {/* Bento Card 1: Zero Hallucination */}
          <Reveal variant="rise" delay={50}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-all hover:border-[var(--primary)] hover:shadow-md">
              <div>
                <div className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-200">
                  <Shield size={20} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[var(--fg)]">
                  Zero Hallucination Contract
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-fg)]">
                  Generic LLMs invent fake numbers, exaggerated metrics, and company roles you never held. RoleSharp strictly refuses to invent evidence. Every enhancement binds to what you actually achieved.
                </p>
              </div>
              <details className="mt-3 border-t border-[var(--hairline)]">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--primary)]">Details</summary>
              <ul className="space-y-2 pb-2 text-sm text-[var(--fg)]">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-500" aria-hidden="true" />
                  <span>No fabricated percentages or metrics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-500" aria-hidden="true" />
                  <span>Review every claim before exporting</span>
                </li>
              </ul>
              </details>
            </div>
          </Reveal>

          {/* Bento Card 2: True ATS Compliance */}
          <Reveal variant="rise" delay={100}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-all hover:border-[var(--primary)] hover:shadow-md">
              <div>
                <div className="grid size-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Target size={20} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[var(--fg)]">
                  Enterprise ATS Parsing
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-fg)]">
                  Designed for Workday, Greenhouse, Lever, and Taleo. Single-column layouts, clean section headers, standard typography, and UTF-8 encoding that supports reliable text extraction.
                </p>
              </div>
              <details className="mt-3 border-t border-[var(--hairline)]">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--primary)]">Details</summary>
              <ul className="space-y-2 pb-2 text-sm text-[var(--fg)]">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-500" aria-hidden="true" />
                  <span>Single-column, zero parsing bottlenecks</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-500" aria-hidden="true" />
                  <span>Country-aware format conventions</span>
                </li>
              </ul>
              </details>
            </div>
          </Reveal>

          {/* Bento Card 3: Ephemeral & Private */}
          <Reveal variant="rise" delay={150}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-all hover:border-[var(--primary)] hover:shadow-md">
              <div>
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
                  <Lock size={20} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[var(--fg)]">
                  Transient & Ephemeral
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-fg)]">
                  Your resume is processed in transient volatile memory. We do not sell candidate data, track recruiter activity, or train public AI models on your personal career history.
                </p>
              </div>
              <details className="mt-3 border-t border-[var(--hairline)]">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--primary)]">Details</summary>
              <ul className="space-y-2 pb-2 text-sm text-[var(--fg)]">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-500" aria-hidden="true" />
                  <span>Zero retention for free diagnostic tools</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-500" aria-hidden="true" />
                  <span>One-click complete account deletion</span>
                </li>
              </ul>
              </details>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
