import type { Metadata } from "next";
import GuideBreadcrumb from "@/app/guide-breadcrumb";
import { Container, Section, Card, Button, MarketingShell } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Why old resumes get rejected — and how to fix them",
  description:
    "Learn why old resumes fail ATS checks, how to repair weak bullets and missing keywords, and what to do after running RoleSharp's resume fixer.",
  alternates: { canonical: "/resume-fixer/help" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Why old resumes get rejected — and how to fix them | RoleSharp",
    description:
      "Learn why old resumes get rejected fast and how the RoleSharp resume fixer prioritizes the highest-impact repairs.",
    url: "/resume-fixer/help",
  },
};

export default function ResumeFixerHelpPage() {
  return (
    <MarketingShell>
      <GuideBreadcrumb
        toolName="Resume Fixer"
        toolPath="/resume-fixer"
        guideName="Why old resumes get rejected and how to fix them"
        guidePath="/resume-fixer/help"
      />
      <section className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)]">
        <Container className="relative z-10 py-12 md:py-20">
          <a
            href="/resume-fixer"
            className="inline-block mb-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            ← Back to resume fixer
          </a>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4 max-w-3xl">
            Why old resumes get rejected — and how to fix them
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed">
            Most rejected resumes fail on wording, keywords, or formatting. The fixer scores the biggest problems first so you know exactly where to spend your time.
          </p>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card padding="md" className="mb-6">
            <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Why old resumes get rejected so fast
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-4">
              Most older resumes are not failing because the person is unqualified. They fail because the wording is weak,
              the job keywords are missing, or the layout was built for looks instead of parsing. The fastest fixes are
              usually measurable bullets, clearer role targeting, and a cleaner ATS-safe structure.
            </p>
            <ul className="space-y-2 text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              <li>
                <strong>Weak bullets.</strong>{" "}
                <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  Duty-style lines like &ldquo;responsible for&rdquo; or &ldquo;worked on&rdquo; without results.
                </span>
              </li>
              <li>
                <strong>Missing keywords.</strong>{" "}
                <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  The resume says roughly the right thing, but not in the same language as the job post.
                </span>
              </li>
              <li>
                <strong>Formatting risk.</strong>{" "}
                <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  Columns, tables, or design-heavy exports that ATS parsers read badly.
                </span>
              </li>
            </ul>
          </Card>

          <Card padding="md">
            <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              What to do after the fixer
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-4">
              Once you know what is broken, the next step is usually to run the{" "}
              <a href="/checker" className="font-semibold underline">ATS checker</a>, rebuild
              the content in the <a href="/resume-maker" className="font-semibold underline">manual resume maker</a>, or tailor it to a real opening with the{" "}
              <a href="/build" className="font-semibold underline">AI resume builder</a>. If you are still unsure why the score is low, start with{" "}
              <a href="/blog/fix-old-resume-or-build-new" className="font-semibold underline">whether to fix your old resume or rebuild it</a>.
            </p>
            <Button as="a" href="/resume-fixer" variant="outline">
              Run the fixer
            </Button>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
