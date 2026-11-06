import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import {
  GUIDE_LIMITS,
  GUIDE_STEPS,
  GUIDE_SUBTITLE,
  GUIDE_TITLE,
  FILLER_PHRASES,
  LETTER_SHAPES,
  bulletDemo,
} from "@/lib/job-search-guide";
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Container,
  MarketingShell,
  PageHeader,
  Section,
  SectionHeader,
} from "@/components/ui/primitives";

const DESCRIPTION =
  "Follow seven steps to check your resume, improve bullets, tailor applications and prepare interview answers. Read online or download the free PDF.";

export const metadata: Metadata = {
  title: "The Job Search Guide (Free PDF)",
  description: DESCRIPTION,
  alternates: { canonical: "/job-search-guide" },
  openGraph: {
    type: "article",
    images: ["/opengraph-image"],
    title: "The Job Search Guide (Free PDF) | RoleSharp",
    description: DESCRIPTION,
    url: "/job-search-guide",
  },
};

const HOW_TO_LD = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: GUIDE_TITLE,
  description: DESCRIPTION,
  step: GUIDE_STEPS.map((s) => ({
    "@type": "HowToStep",
    position: s.n,
    name: s.title,
    text: s.why,
  })),
};

export default function JobSearchGuidePage() {
  const demo = bulletDemo();

  return (
    <MarketingShell className="reading-shell">
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: "Job Search Guide", item: "/job-search-guide" }])} />
      <JsonLd data={HOW_TO_LD} />

      <section className="reading-masthead">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Job Search Guide" }]} />
          <PageHeader
            eyebrow="Free guide, no account"
            title={GUIDE_TITLE}
            description={`${GUIDE_SUBTITLE} Read it here, or take the PDF with you. Every step is what RoleSharp's own tools do, written down so you can do it by hand if you prefer.`}
            actions={
              <>
                <Button as="a" href="/api/job-search-guide/pdf" size="lg" download>
                  Download the PDF
                </Button>
                <Button as="a" href="/checker" variant="outline" size="lg">
                  Start with step 1 — score my resume
                </Button>
              </>
            }
            className="mb-0"
          />
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="grid gap-6">
            {GUIDE_STEPS.map((step) => (
              <Card key={step.n} className="border-l-4 border-[var(--color-primary)]" padding="lg">
                <div className="flex flex-wrap items-baseline gap-3 mb-2">
                  <Badge variant="primary">Step {step.n}</Badge>
                  <h2 className="text-xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                    {step.title}
                  </h2>
                </div>
                <p className="text-[var(--color-primary)] font-medium mb-3">{step.rule}</p>
                <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-4 max-w-3xl leading-relaxed">
                  {step.why}
                </p>
                <ul className="space-y-2 mb-5 max-w-3xl">
                  {step.actions.map((action) => (
                    <li
                      key={action}
                      className="flex gap-3 text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)] leading-relaxed"
                    >
                      <span aria-hidden="true" className="text-[var(--color-primary)]">→</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
                {step.tool ? (
                  <Button as="a" href={step.tool.href} size="sm">
                    {step.tool.label}
                  </Button>
                ) : null}
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section asContainer={false} alt size="sm">
        <Container size="small">
          <SectionHeader
            eyebrow="Step 3, demonstrated"
            title="The same rewrite the free tool runs"
            description="Three lines through strengthenBullets(). It removes filler and fixes shape; anything that would need a fact you did not give comes back as a note instead of a guess."
            align="center"
            className="mb-8"
          />
          <div className="space-y-4">
            {demo.map((review, i) => (
              <Card key={i} padding="lg">
                <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] line-through">
                  {review.original}
                </p>
                <p className="mt-2 font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  {review.improved}
                </p>
                {review.notes.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-primary)]">
                    Nothing to add — verb, result and number are all here.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {review.notes.map((note) => (
                      <li key={note} className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                        {note}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Button as="a" href="/resume-bullet-points-generator" variant="outline">
              Run my own bullets
            </Button>
          </div>
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card padding="lg">
              <h2 className="text-xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">
                Phrases the score marks down
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-4 leading-relaxed">
                Each one pushes the verb to the middle of the sentence and the result off the end of it.
                This is the checker&apos;s own list, not a second one written to match it.
              </p>
              <div className="flex flex-wrap gap-2">
                {FILLER_PHRASES.map((phrase) => (
                  <Badge key={phrase} variant="neutral">{phrase}</Badge>
                ))}
              </div>
            </Card>

            <Card padding="lg">
              <h2 className="text-xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">
                The six letter shapes
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-4 leading-relaxed">
                A cover letter template is not a font. It is what the letter leads with.
              </p>
              <dl className="space-y-3">
                {LETTER_SHAPES.map((shape) => (
                  <div key={shape.name}>
                    <dt className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                      {shape.name}
                    </dt>
                    <dd className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                      {shape.leadsWith}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5">
                <Button as="a" href="/cover-letter-templates" size="sm" variant="outline">
                  See all six written out
                </Button>
              </div>
            </Card>
          </div>
        </Container>
      </Section>

      <Section asContainer={false} alt size="sm">
        <Container size="small">
          <SectionHeader
            eyebrow="Being straight about it"
            title="What this guide will not do"
            align="center"
            className="mb-8"
          />
          <ul className="space-y-3">
            {GUIDE_LIMITS.map((limit) => (
              <li
                key={limit}
                className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] px-5 py-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed"
              >
                {limit}
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card variant="gradient" padding="lg" className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold! text-white mb-4">Take the guide with you</h2>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto leading-relaxed">
              The whole thing as a PDF — seven steps, the rewrite demonstration, and the letter shapes.
              No email, no account.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button as="a" href="/api/job-search-guide/pdf" variant="primaryInverse" size="lg" download>
                Download the PDF
              </Button>
              <Button as="a" href="/learn" variant="outlineInverse" size="lg">
                Go deeper in the academy
              </Button>
            </div>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
