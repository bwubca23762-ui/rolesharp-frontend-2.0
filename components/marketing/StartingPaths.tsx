import { ChevronRight, FileText, Target, Upload } from "@/app/icons";
import { Card, Container, Section, SectionHeader } from "@/components/ui/primitives";

const paths = [
  {
    icon: Upload,
    eyebrow: "I already have a resume",
    title: "Find what is holding it back.",
    body: "Upload a PDF or DOCX for an ATS score, ranked fixes, and clearer evidence without changing the facts.",
    href: "/resume-fixer",
    cta: "Fix my resume",
    accent: "from-[var(--color-primary-solid)] to-[var(--color-primary-100)]",
  },
  {
    icon: Target,
    eyebrow: "I found a job",
    title: "Tailor for the exact role.",
    body: "Use the company and job description to align keywords, structure, and your strongest existing evidence.",
    href: "/build",
    cta: "Tailor for this job",
    accent: "from-[var(--color-primary)] to-[var(--color-brand-amber-border)]",
  },
  {
    icon: FileText,
    eyebrow: "I am starting fresh",
    title: "Build cleanly from page one.",
    body: "Write every section yourself in a structured builder with an ATS-safe layout and live preview.",
    href: "/resume-maker",
    cta: "Start from scratch",
    accent: "from-[var(--color-brand-amber-solid)] to-[var(--color-brand-amber-surface)]",
  },
] as const;

export function StartingPaths() {
  return (
    <Section asContainer={false} className="relative">
      <Container>
        <SectionHeader
          eyebrow="Start where you are"
          title="Three situations. One clear next step."
          description="RoleSharp does not force every job seeker through the same funnel. Choose the path that matches what you have today."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {paths.map(({ icon: Icon, eyebrow, title, body, href, cta, accent }, index) => (
            <a key={title} href={href} className="group rounded-[var(--radius-lg)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)]">
              <Card variant="interactive" padding="none" className="h-full overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
                <div className="flex h-full flex-col p-6 md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]">
                      <Icon size={22} />
                    </span>
                    <span className="text-xs font-bold text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)]">0{index + 1}</span>
                  </div>
                  <p className="mt-6 text-xs font-bold uppercase tracking-[0.13em] text-[var(--color-primary)]">{eyebrow}</p>
                  <h3 className="mt-2 text-xl font-bold! tracking-[-0.03em]! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{body}</p>
                  <span className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--color-primary)]">
                    {cta} <ChevronRight size={16} className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
                  </span>
                </div>
              </Card>
            </a>
          ))}
        </div>
      </Container>
    </Section>
  );
}
