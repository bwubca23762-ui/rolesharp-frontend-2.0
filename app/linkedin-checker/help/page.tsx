import type { Metadata } from "next";
import GuideBreadcrumb from "@/app/guide-breadcrumb";
import { Container, Section, Card, Button, MarketingShell } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "What recruiters look for on LinkedIn",
  description:
    "Learn what recruiters notice first on LinkedIn — headline clarity, proof in experience, keyword alignment — and which RoleSharp tools to use next.",
  alternates: { canonical: "/linkedin-checker/help" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "What recruiters look for on LinkedIn | RoleSharp",
    description:
      "A quick guide to the biggest LinkedIn profile mistakes and the fastest fixes using RoleSharp's LinkedIn checker.",
    url: "/linkedin-checker/help",
  },
};

export default function LinkedinCheckerHelpPage() {
  return (
    <MarketingShell>
      <GuideBreadcrumb
        toolName="LinkedIn Profile Checker"
        toolPath="/linkedin-checker"
        guideName="What recruiters look for on LinkedIn"
        guidePath="/linkedin-checker/help"
      />
      <section className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)]">
        <Container className="relative z-10 py-12 md:py-20">
          <a
            href="/linkedin-checker"
            className="inline-block mb-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            ← Back to LinkedIn checker
          </a>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4 max-w-3xl">
            What recruiters look for on LinkedIn
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed">
            Recruiters search by role terms and skills, then decide in seconds whether your profile feels credible. Here's what makes them stop or keep scrolling.
          </p>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card padding="md" className="mb-6">
            <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              What recruiters notice first
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-4">
              The biggest LinkedIn misses are usually obvious: a headline that says almost nothing, an About section full of
              generic claims, and experience bullets with no proof. Recruiters search by role terms and skills first, then
              decide in seconds whether the profile feels credible enough to keep reading.
            </p>
            <ul className="space-y-2 text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              <li>
                <strong>Headline clarity.</strong>{" "}
                <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  Can someone tell your target role and specialty without opening the full profile?
                </span>
              </li>
              <li>
                <strong>Proof in experience.</strong>{" "}
                <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  Are there numbers, scope, or outcomes that make the profile feel real?
                </span>
              </li>
              <li>
                <strong>Keyword alignment.</strong>{" "}
                <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  Does the wording match the roles and companies you want next?
                </span>
              </li>
            </ul>
          </Card>

          <Card padding="md">
            <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Related pages that help
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-4">
              Use the <a href="/resume-fixer" className="font-semibold underline">resume fixer</a> if the resume behind your profile is also weak, the{" "}
              <a href="/checker" className="font-semibold underline">ATS checker</a> if you are applying right now, and{" "}
              <a href="/blog/linkedin-headline-examples-job-seekers" className="font-semibold underline">LinkedIn headline examples for job seekers</a> if the
              top line still sounds too generic.
            </p>
            <Button as="a" href="/linkedin-checker" variant="outline">
              Check your LinkedIn
            </Button>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
