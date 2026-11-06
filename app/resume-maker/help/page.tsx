import type { Metadata } from "next";
import GuideBreadcrumb from "@/app/guide-breadcrumb";
import { Container, Section, Card, Button, MarketingShell } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "How to use the manual resume maker",
  description:
    "Build an ATS-friendly resume in RoleSharp's manual maker: write each section, use the live preview, then export a clean PDF or DOCX.",
  alternates: { canonical: "/resume-maker/help" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "How to use the manual resume maker | RoleSharp",
    description:
      "Learn how to build an ATS-ready resume yourself with structured fields, live preview, and PDF/DOCX export.",
    url: "/resume-maker/help",
  },
};

const STEPS = [
  "Read the job requirements and required documents before writing.",
  "Choose the target title and keep only evidence relevant to it.",
  "Put contact details in the document body, not a graphic or image.",
  "Use standard headings, reverse chronology, and consistent month/year dates.",
  "Write action + evidence + result bullets; quantify only facts you can defend.",
  "Mirror exact job terms only where your experience or skills prove them.",
  "Export the final file, upload it to the checker, and inspect the parsed text.",
  "Review every auto-filled application field before submitting.",
];

export default function ResumeMakerHelpPage() {
  return (
    <MarketingShell>
      <GuideBreadcrumb
        toolName="Manual Resume Maker"
        toolPath="/resume-maker"
        guideName="How to use the manual resume maker"
        guidePath="/resume-maker/help"
      />
      <section className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)]">
        <Container className="relative z-10 py-12 md:py-20">
          <a
            href="/resume-maker"
            className="inline-block mb-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            ← Back to manual maker
          </a>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4 max-w-3xl">
            How to use the manual resume maker
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed">
            Write every section yourself with an ATS-safe structure, a live preview, and scoring hints — then export a clean PDF or DOCX.
          </p>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card padding="md" className="mb-6">
            <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
              Build an ATS-ready resume in the right order
            </h2>
            <ol className="space-y-3">
              {STEPS.map((step, index) => (
                <li key={index} className="flex items-start gap-3 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Research basis:{" "}
              <a href="https://support.greenhouse.io/hc/en-us/articles/115002195063-Manually-add-a-candidate-or-prospect" target="_blank" rel="noreferrer" className="font-semibold underline">Greenhouse resume parsing</a>,{" "}
              <a href="https://help.usajobs.gov/faq/application/documents/resume/what-to-include" target="_blank" rel="noreferrer" className="font-semibold underline">USAJOBS federal resume requirements</a>,{" "}
              <a href="https://careers.google.com/videos/google-resume-tips-and-advice/" target="_blank" rel="noreferrer" className="font-semibold underline">Google recruiter resume guidance</a>, and{" "}
              <a href="https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/" target="_blank" rel="noreferrer" className="font-semibold underline">Harvard resume guidance</a>.
            </p>
          </Card>

          <Card padding="md">
            <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              When the manual maker is the better choice
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-3">
              Use the manual maker when you want full control over the wording, you do not trust AI to draft your background,
              or you already know exactly what the resume should say. It gives you the ATS-safe structure without forcing the
              content through a generator first.
            </p>
            <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-4">
              If you later want company-specific tailoring, move the same content into the{" "}
              <a href="/build" className="font-semibold underline">AI resume builder</a>. If you are still fixing an older draft, start with the{" "}
              <a href="/resume-fixer" className="font-semibold underline">resume fixer</a>{" "}
              or the <a href="/checker" className="font-semibold underline">ATS checker</a>.
            </p>
            <Button as="a" href="/resume-maker" variant="outline">
              Open manual maker
            </Button>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
