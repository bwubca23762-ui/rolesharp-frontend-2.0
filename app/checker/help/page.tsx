import type { Metadata } from "next";
import GuideBreadcrumb from "@/app/guide-breadcrumb";
import { Container, Section, Card, Button, MarketingShell } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "How the ATS resume checker works",
  description:
    "Learn how RoleSharp checks resume readability, job-description keywords, bullet quality, and company fit, then ranks the fixes to make first.",
  alternates: { canonical: "/checker/help" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "How the ATS resume checker works | RoleSharp",
    description:
      "A four-step guide to using RoleSharp's free ATS checker, resume grader, and keyword scanner.",
    url: "/checker/help",
  },
};

const CHECKER_STEPS: [string, string][] = [
  ["Paste your resume", "Copy your current resume text into the checker, or upload it."],
  ["Add the job and country", "Pick the company, role, and country, and paste the job description for the most accurate match."],
  ["Get your ATS score", "See your score out of 100 with keyword gaps and bullet-by-bullet feedback."],
  ["Fix and rebuild", "Apply the suggested fixes, or open the resume maker to rebuild it tailored to that exact job."],
];

export default function CheckerHelpPage() {
  return (
    <MarketingShell>
      <GuideBreadcrumb
        toolName="ATS Resume Checker"
        toolPath="/checker"
        guideName="How the ATS resume checker works"
        guidePath="/checker/help"
      />
      <section className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)]">
        <Container className="relative z-10 py-12 md:py-20">
          <a
            href="/checker"
            className="inline-block mb-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            ← Back to checker
          </a>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4 max-w-3xl">
            How the ATS resume checker works
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed">
            Upload or paste your resume, add the job description, and get an ATS score, keyword gaps, and bullet-by-bullet fixes — all in the format an ATS parser understands.
          </p>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Card padding="md" variant="elevated">
              <h3 className="text-base font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-1">
                Can the ATS read it?
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                Reads your file the way an ATS parser does, so you avoid tables, columns, and graphics that machines misread.
              </p>
            </Card>
            <Card padding="md" variant="elevated">
              <h3 className="text-base font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-1">
                Do you match the job?
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                Compares your resume against the job description to find matched, missing, and underused keywords.
              </p>
            </Card>
            <Card padding="md" variant="elevated">
              <h3 className="text-base font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-1">
                What to fix first
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                Ranks fixes by impact: missing keywords, unquantified bullets, section gaps, and format risks.
              </p>
            </Card>
          </div>

          <Card padding="md">
            <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
              Four steps to a higher score
            </h2>
            <ol className="space-y-3">
              {CHECKER_STEPS.map(([title, text], index) => (
                <li key={title} className="flex items-start gap-3 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <div className="text-sm leading-relaxed">
                    <strong>{title}:</strong>{" "}
                    <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{text}</span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <Button as="a" href="/checker" variant="outline">
                Run the checker
              </Button>
            </div>
          </Card>
        </Container>
      </Section>

    </MarketingShell>
  );
}
