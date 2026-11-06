import { Reveal } from "@/components/motion";
import { Button, Container } from "@/components/ui/primitives";
import NextImage from "next/image";
import { Shield, Target, Briefcase, Upload } from "@/app/icons";
import { tailoredResumes } from "@/lib/limits";
import { env } from "@/lib/env";

/**
 * ProductShowcase — four sections, one per core capability, each led by a
 * product visual. The tailor step is a compact, inset feature card so the
 * benefit, plan allowance, actions, and builder preview read as one unit:
 *
 *   1. Check    — the checker report (shots/checker.webp)
 *   2. Match    — the match score dial (markup-built, live)
 *   3. Tailor   — the builder with live preview (shots/builder.webp)
 *   4. Import   — format-wise upload flow (markup-built visual)
 *
 * Every visual is a real product surface (the honesty law bans stock art).
 * Copy stays honest: no invented metrics beyond the sample-labelled ones
 * already used on the page.
 */

export function ProductShowcase() {
  return (
    <section id="showcase" className="scroll-mt-20">
      {/* ── 1. CHECK ── */}
      <div className="border-b border-[var(--hairline)] py-14 md:py-20">
        <Container size="large">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal variant="rise">
              <div>
                <p className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.16em] text-[var(--muted-fg)]">
                  <Shield size={14} aria-hidden /> Check
                </p>
                <h2 className="mt-4 text-[clamp(1.7rem,3vw,2.5rem)] font-extrabold! leading-[1.02]! tracking-[-0.03em]! text-[var(--fg)] text-balance">
                  Know exactly what the ATS sees before it sees you.
                </h2>
                <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--muted-fg)]">
                  Upload your resume and the checker reads it the way an applicant tracking
                  system does: section by section, keyword by keyword. You get a score out of
                  100, the exact keywords the job wants that your resume never mentions, and a
                  ranked fix list — the changes that move the number, in the order that matters.
                </p>
                <p className="mt-4 max-w-lg leading-7 text-[var(--muted-fg)]">
                  Works with PDF, DOCX, and plain text. Country-aware, so a resume for a German
                  employer is judged by German conventions, not American ones.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button as="a" href="/checker" size="lg" rightIcon={<Shield size={16} />}>
                    Run a free check
                  </Button>
                  <Button as="a" href="/resume-fixer" variant="outline" size="lg">
                    Or fix an existing one
                  </Button>
                </div>
              </div>
            </Reveal>
            <Reveal variant="rise" delay={120}>
              <div className="rs-showcase-shot">
                <NextImage
                  src="/shots/checker.webp"
                  alt="The RoleSharp checker report: ATS score, missing keywords, and ranked bullet fixes"
                  width={1200}
                  height={800}
                  sizes="(max-width: 1024px) 100vw, 640px"
                  className="h-auto w-full rounded-2xl border border-[var(--border)] shadow-[0_32px_64px_-24px_rgb(0_0_0/0.4)]"
                />
              </div>
            </Reveal>
          </div>
        </Container>
      </div>

      {/* ── 2. MATCH — markup-built score dial, no screenshot needed ── */}
      <div className="border-b border-[var(--hairline)] py-14 md:py-20">
        <Container size="large">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            {/* Visual first on desktop for rhythm (alternating). */}
            <Reveal variant="rise" className="order-2 lg:order-1">
              <div className="rs-showcase-shot mx-auto max-w-md">
                <MatchDialVisual />
              </div>
            </Reveal>
            <Reveal variant="rise" delay={120} className="order-1 lg:order-2">
              <div>
                <p className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.16em] text-[var(--muted-fg)]">
                  <Target size={14} aria-hidden /> Match
                </p>
                <h2 className="mt-4 text-[clamp(1.7rem,3vw,2.5rem)] font-extrabold! leading-[1.02]! tracking-[-0.03em]! text-[var(--fg)] text-balance">
                  Your resume vs the job, scored honestly.
                </h2>
                <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--muted-fg)]">
                  Paste any job description next to your resume. The match engine extracts what
                  the posting repeats — the requirements it genuinely cares about — and measures
                  your evidence against each one. Covered keywords, missing keywords, and the
                  hard requirements (years, degrees) no rewrite can fake.
                </p>
                <p className="mt-4 max-w-lg leading-7 text-[var(--muted-fg)]">
                  Two drafts, one posting? Version Compare runs both and tells you which to send.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button as="a" href="/resume-match" size="lg" rightIcon={<Target size={16} />}>
                    Score my match free
                  </Button>
                  <Button as="a" href="/resume-compare" variant="outline" size="lg">
                    Compare two versions
                  </Button>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </div>

      {/* ── 3. TAILOR ── */}
      <div className="border-b border-[var(--hairline)] py-10 md:py-14">
        <Container size="large">
          <div className="overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_88%,var(--primary)_4%)] p-5 shadow-[0_24px_64px_-44px_rgb(16_42_78/0.45)] sm:p-7 lg:p-9">
            <div className="grid items-center gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
              <Reveal variant="rise">
                <div className="max-w-xl">
                  <p className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                    <Briefcase size={14} aria-hidden /> Tailor for one job
                  </p>
                  <h2 className="mt-3 text-[clamp(1.8rem,3.4vw,2.65rem)] font-extrabold! leading-[1.03]! tracking-[-0.035em]! text-[var(--fg)] text-balance">
                    A resume for this job. Built from your experience.
                  </h2>
                  <p className="mt-4 max-w-lg text-base leading-7 text-[var(--muted-fg)] sm:text-lg sm:leading-8">
                    Match one role, strengthen relevant bullets with evidence you supplied, and
                    review the live resume before you export it.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2" aria-label="Resume builder benefits">
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--fg)]">Evidence-based edits</span>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--fg)]">Live document preview</span>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--fg)]">Export-ready PDF</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[var(--muted-fg)]">
                    Free includes {tailoredResumes(env.freeMonthlyLimit)} per rolling month. Premium includes {env.premiumMonthlyLimit}, every template, and DOCX export.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <Button as="a" href="/build" size="md" rightIcon={<Briefcase size={16} />}>
                      Build for a job
                    </Button>
                    <Button as="a" href="/pricing" variant="outline" size="md">
                      Compare plans
                    </Button>
                  </div>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={120}>
                <figure aria-label="Sample view of the RoleSharp resume builder and live document preview" className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-[0_20px_48px_-30px_rgb(16_42_78/0.48)] sm:p-3">
                  <figcaption className="flex items-center justify-between gap-3 px-1 pb-2.5">
                    <span className="flex items-center gap-2 text-xs font-semibold text-[var(--fg)]">
                      <span aria-hidden="true" className="size-2 rounded-full bg-[var(--success)]" />
                      Builder workspace
                    </span>
                    <span className="rounded-full bg-[color-mix(in_oklab,var(--primary)_9%,var(--surface))] px-2.5 py-1 text-[10px] font-medium text-[var(--primary)] sm:text-xs">Sample preview</span>
                  </figcaption>
                <NextImage
                  src="/shots/builder.webp"
                  alt="Sample RoleSharp resume builder screen with profile fields and a live resume preview"
                  width={1200}
                  height={800}
                  sizes="(max-width: 1024px) 100vw, 640px"
                  className="h-[250px] w-full rounded-xl border border-[var(--border)] object-cover object-top sm:h-[320px] lg:h-[380px]"
                />
                </figure>
              </Reveal>
            </div>
          </div>
        </Container>
      </div>

      {/* ── 4. IMPORT — markup-built upload flow visual ── */}
      <div className="py-14 md:py-20">
        <Container size="large">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal variant="rise" className="order-2 lg:order-1">
              <ImportFlowVisual />
            </Reveal>
            <Reveal variant="rise" delay={120} className="order-1 lg:order-2">
              <div>
                <p className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.16em] text-[var(--muted-fg)]">
                  <Upload size={14} aria-hidden /> Import
                </p>
                <h2 className="mt-4 text-[clamp(1.7rem,3vw,2.5rem)] font-extrabold! leading-[1.02]! tracking-[-0.03em]! text-[var(--fg)] text-balance">
                  Any format in. Our format out.
                </h2>
                <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--muted-fg)]">
                  However your old resume was made — Word template, design tool, LinkedIn export —
                  upload it and the parser reads its structure: every role, every date, every
                  bullet, every skill. Premium pulls all of it straight into the builder as
                  labelled fields, ready to retarget at a new job in minutes.
                </p>
                <p className="mt-4 max-w-lg leading-7 text-[var(--muted-fg)]">
                  Nothing is invented during import: what the file says is what arrives, and
                  anything unreadable is reported, not guessed.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button as="a" href="/build" size="lg" rightIcon={<Upload size={16} />}>
                    Import my resume
                  </Button>
                  <Button as="a" href="/resume-maker" variant="outline" size="lg">
                    Or start from scratch
                  </Button>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </div>
    </section>
  );
}

/* Markup-built match dial: the same sample-labelled honesty as the hero
   chips, as a visual. Server-rendered static values; no JS needed. */
function MatchDialVisual() {
  const covered = [
    "Stakeholder reporting",
    "SQL + dashboards",
    "Renewals workflow",
  ];
  const missing = ["A/B experiment design", "Executive presentations"];
  return (
    <figure
      aria-label="Example match report for a sample resume, labelled as sample data"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[0_32px_64px_-24px_rgb(0_0_0/0.35)]"
    >
      <figcaption className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--muted-fg)]">Match report — sample</span>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs text-[var(--muted-fg)]">data-analyst.pdf</span>
      </figcaption>
      <div className="mt-6 flex items-center gap-5">
        <div
          className="relative grid h-24 w-24 place-items-center rounded-full"
          style={{ background: "conic-gradient(var(--color-primary) 0 78%, var(--color-surface-2) 78% 100%)" }}
          role="img"
          aria-label="Match score 78 out of 100 (sample)"
        >
          <div className="grid h-[4.6rem] w-[4.6rem] place-items-center rounded-full bg-[var(--surface)]">
            <strong className="text-2xl font-extrabold! text-[var(--fg)] tabular-nums">78</strong>
          </div>
        </div>
        <div className="text-sm leading-6 text-[var(--muted-fg)]">
          <strong className="block text-base font-bold text-[var(--fg)]">Strong match</strong>
          9 of 12 posting keywords evidenced. Two hard requirements unmet — listed, not hidden.
        </div>
      </div>
      <div className="mt-6 space-y-2">
        {covered.map((item) => (
          <div key={item} className="flex items-center gap-2.5 rounded-lg border border-[var(--hairline,var(--border))] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" />
            <span className="text-[var(--fg)]">{item}</span>
            <span className="ml-auto font-[family-name:var(--font-mono)] text-xs text-[var(--success)]">covered</span>
          </div>
        ))}
        {missing.map((item) => (
          <div key={item} className="flex items-center gap-2.5 rounded-lg border border-[var(--hairline,var(--border))] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand-amber-solid)]" />
            <span className="text-[var(--muted-fg)]">{item}</span>
            <span className="ml-auto font-[family-name:var(--font-mono)] text-xs text-[var(--muted-fg)]">gap</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/* Markup-built import flow: file in → parsed sections → builder fields. */
function ImportFlowVisual() {
  const steps = [
    { label: "resume-old.pdf", note: "any template, any layout", tone: "file" },
    { label: "Parsed 2 roles — 8 skills — education", note: "structure recognised", tone: "parse" },
    { label: "Builder fields filled", note: "labelled, editable, honest", tone: "done" },
  ] as const;
  return (
    <div
      aria-label="The import flow: a resume file becomes parsed sections, then filled builder fields"
      className="mx-auto flex max-w-md flex-col gap-3"
    >
      {steps.map((step, index) => (
        <div key={step.label} className="relative">
          <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-[0_16px_40px_-20px_rgb(0_0_0/0.35)]">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-[family-name:var(--font-mono)] text-sm font-bold ${
                step.tone === "done"
                  ? "bg-[color-mix(in_oklab,var(--color-success)_18%,var(--color-surface))] text-[#166534] dark:text-[#7EE2A8]"
                  : "bg-[#E8EFF9] text-[#1D5FB4] dark:bg-[#16395E] dark:text-[#9FC3F2]"
              }`}
              aria-hidden="true"
            >
              {step.tone === "file" ? "PDF" : step.tone === "parse" ? "{}" : "✓"}
            </span>
            <span>
              <span className="block text-sm font-bold text-[var(--fg)]">{step.label}</span>
              <span className="block text-xs leading-5 text-[var(--muted-fg)]">{step.note}</span>
            </span>
          </div>
          {index < steps.length - 1 && (
            <span aria-hidden="true" className="mx-auto block h-4 w-px bg-[var(--border)]" />
          )}
        </div>
      ))}
    </div>
  );
}
