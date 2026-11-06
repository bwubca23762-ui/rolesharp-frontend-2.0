import { Briefcase, FileText, Globe, GraduationCap, Linkedin, Sparkles, Target } from "@/app/icons";
import { Badge, Card, Container, Section, SectionHeader } from "@/components/ui/primitives";

const groups = [
  {
    label: "Create",
    description: "Build or repair the core application documents.",
    links: [
      { href: "/resume-fixer", label: "Resume Fixer", icon: Sparkles },
      { href: "/build", label: "AI Builder", icon: Target },
      { href: "/resume-maker", label: "Manual Maker", icon: FileText },
    ],
  },
  {
    label: "Discover",
    description: "Research opportunities and how your profile fits.",
    links: [
      { href: "/jobs", label: "Job Finder", icon: Briefcase },
      { href: "/linkedin-checker", label: "LinkedIn Checker", icon: Linkedin },
      { href: "/resume-translator", label: "Country Adapter", icon: Globe },
    ],
  },
  {
    label: "Prepare",
    description: "Close gaps around the resume before applying.",
    links: [
      { href: "/cover-letter-generator", label: "Cover Letter", icon: FileText },
      { href: "/interview-prep", label: "Interview Prep", icon: Sparkles },
      { href: "/learn", label: "Career Academy", icon: GraduationCap },
    ],
  },
] as const;

export function ProductEcosystem() {
  return (
    <Section asContainer={false}>
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
          <SectionHeader
            eyebrow="One connected toolkit"
            title="Use the tool you need without losing the bigger picture."
            description="RoleSharp covers the resume, target role, supporting documents, market conventions, and application follow-through."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {groups.map((group) => (
              <Card key={group.label} variant="elevated" padding="sm" className="min-w-0">
                <div className="p-1">
                  <Badge variant="neutral">{group.label}</Badge>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{group.description}</p>
                </div>
                <div className="mt-4 grid gap-1">
                  {group.links.map(({ href, label, icon: Icon }) => (
                    <a key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] dark:text-[var(--color-dark-text)] dark:hover:bg-[var(--color-dark-surface-2)]">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]"><Icon size={16} /></span>
                      {label}
                    </a>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
