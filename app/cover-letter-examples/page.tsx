import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import Link from "next/link";
import { seoRoleList } from "@/lib/db";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { Breadcrumb, Button, Card, Container, MarketingShell, Section } from "@/components/ui/primitives";

// /cover-letter-examples — programmatic SEO hub: cover letter examples by role.
// Reuses the roles dataset; each role links to /roles/[slug] and the cover
// letter generator. RoleSharp's cover letters are generated from the user's
// resume + JD, so these examples describe the pattern each role benefits from.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cover Letter Examples by Role (2026)",
  description:
    "Browse free cover letter examples by role. Learn the structure, tone, and talking points that work, then generate your own.",
  alternates: { canonical: "/cover-letter-examples" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Cover Letter Examples by Role — Free Sample Letters",
    description: "Free cover letter examples for every role. See what works, then generate your own with AI.",
    url: "/cover-letter-examples",
  },
};

export default async function CoverLetterExamplesPage() {
  const roles = await seoRoleList(80).catch(() => []);

  return (
    <MarketingShell className="growth-page growth-library">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: `${env.siteUrl}/` },
          { name: "Cover Letter Examples", item: `${env.siteUrl}/cover-letter-examples` },
        ])}
      />

      <section className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)]">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cover Letter Examples" }]} />
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-6 max-w-3xl">
            Example cover letters by role
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-8">
            See the structure, tone, and talking points that make a cover letter work for your target role. Each example
            shows what to lead with, what to prove, and what to leave out — then generate your own with the AI cover
            letter generator.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button as="a" href="/cover-letter-generator" size="lg">
              Generate a cover letter
            </Button>
            <Button as="a" href="/build" variant="outline" size="lg">
              Build a matching resume
            </Button>
          </div>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          <Card className="growth-library-section mb-6" padding="md">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Examples by role
            </h2>
            {roles.length === 0 ? (
              <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Examples are loading. Check back shortly, or{" "}
                <Link href="/cover-letter-generator" className="font-semibold">generate a cover letter</Link>.
              </p>
            ) : (
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0">
                {roles.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/roles/${r.slug}`}
                      className="growth-library-link block p-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] text-sm font-medium text-[var(--color-text)] dark:text-[var(--color-dark-text)] hover:border-[var(--color-primary)] transition-colors"
                    >
                      {r.title} cover letter
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="growth-library-section mb-6" padding="md">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
              What every strong cover letter does
            </h2>
            <ul className="space-y-3">
              {[
                ["Opens with the role and why you want it.", "Name the job and the company in the first two sentences. No \"To Whom It May Concern.\""],
                ["Proves fit with one or two specific examples.", "Not a resume recap — pick the achievement that maps most directly to the job&rsquo;s top requirement and tell it briefly."],
                ["Matches the tone of the company.", "A startup cover letter reads differently from a bank cover letter. The generator adapts to cues in the job description."],
                ["Closes with a clear next step.", "A single confident line that you&rsquo;d welcome the chance to talk — no begging, no repetition of the resume."],
              ].map(([title, body]) => (
                <li key={title} className="flex items-start gap-3 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mt-2 shrink-0" />
                  <span><b>{title}</b> {body}</span>
                </li>
              ))}
            </ul>
            <p className="text-[var(--color-text)] dark:text-[var(--color-dark-text)] mt-5">
              Ready to write yours?{" "}
              <Link href="/cover-letter-generator" className="font-semibold">Generate a cover letter tailored to your job</Link>.
            </p>
          </Card>

          <Card className="growth-library-section" padding="md">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Related resume tools
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
              Pair these examples with the <Link href="/resume-examples" className="font-semibold">resume examples</Link>, the{" "}
              <Link href="/resume-builder" className="font-semibold">AI resume builder</Link>, the{" "}
              <Link href="/checker" className="font-semibold">ATS checker</Link>, the{" "}
              <Link href="/resume-templates" className="font-semibold">ATS-safe templates</Link>, and the{" "}
              <Link href="/pricing" className="font-semibold">pricing page</Link>.
            </p>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
