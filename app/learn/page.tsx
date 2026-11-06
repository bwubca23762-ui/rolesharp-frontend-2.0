import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { ACADEMY_FAQS, ACADEMY_MODULES } from "@/lib/aeo-content";
import {
  Breadcrumb,
  Button,
  Card,
  Container,
  MarketingShell,
  PageHeader,
  Section,
  SectionHeader,
} from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Free Resume and Job Search Academy",
  description:
    "Learn to fix your resume, pass ATS filters, tailor applications, and prepare for interviews with 24 free actionable guides.",
  alternates: { canonical: "/learn" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp Academy — Free AI Resume & Job Search Training",
    description: "Free structured learning path: fix, build, tailor, apply, interview, land the offer.",
    url: "/learn",
  },
};

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ACADEMY_FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

export default function LearnPage() {
  return (
    <MarketingShell className="reading-shell">
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: "Academy", item: "/learn" }])} />
      <JsonLd data={FAQ_LD} />
      <section className="reading-masthead">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Academy" }]} />
          <PageHeader
            eyebrow="Free learning path"
            title="RoleSharp Academy"
            description="Follow six free modules from revising your resume to preparing for interviews. Start with the module you need."
            actions={
              <>
                <Button as="a" href="#module-1" size="lg">Browse modules</Button>
                <Button as="a" href="/prompts" variant="outline" size="lg">See the AI prompts</Button>
              </>
            }
            className="mb-0"
          />
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="grid gap-6">
            {ACADEMY_MODULES.map((mod, i) => (
              <section key={mod.title} id={`module-${i + 1}`} className="reading-index-section">
                <h2 className="mb-3 text-xl font-bold">{mod.title}</h2>
                <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-5 max-w-2xl leading-relaxed">
                  {mod.description}
                </p>
                <ul className="reading-rows mb-5 max-w-3xl">
                  {/* Keyed by title, not href: module 5 points three different
                      guides at /interview-prep, and React logged a duplicate-key
                      error for every render. */}
                  {mod.guides.map((g) => (
                    <li key={g.title}>
                      <Link href={g.href} className="reading-row">
                        <span>{g.title}</span>
                        <span className="reading-row-caption whitespace-nowrap">{g.time}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Button as="a" href={mod.cta.href} size="sm">
                  {mod.cta.text}
                </Button>
              </section>
            ))}
          </div>
        </Container>
      </Section>

      <Section asContainer={false} alt size="sm">
        <Container size="small">
          <SectionHeader
            eyebrow="Common questions"
            title="About the academy"
            align="center"
            className="mb-8"
          />
          <div className="space-y-3">
            {ACADEMY_FAQS.map(([q, a]) => (
              <details
                key={q}
                className="group rounded-[var(--radius-lg)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] open:border-[var(--color-primary)] transition-colors"
              >
                <summary className="flex items-center justify-between gap-4 px-5 py-4 font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)] cursor-pointer list-none hover:text-[var(--color-primary)] transition-colors">
                  <h3 className="text-base">{q}</h3>
                  <span aria-hidden="true" className="flex-shrink-0 w-7 h-7 rounded-lg bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] group-open:bg-[var(--color-primary)] group-open:text-white flex items-center justify-center text-sm transition-colors">
                    +
                  </span>
                </summary>
                <p className="px-5 pb-5 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card padding="md" className="mb-6">
            <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
              Need a quick answer instead of a course? The{" "}
              <a href="/help" className="font-semibold text-[var(--color-primary)]">help center</a>{" "}
              covers the common questions — tool choice, free limits, uploads, exports, and account
              issues — in plain language.
            </p>
          </Card>
          <Card variant="gradient" padding="lg" className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              The fastest way through the academy
            </h2>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto leading-relaxed">
              Upload your resume and get a score in about a minute. The academy shows you what to fix next.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button as="a" href="/resume-fixer" variant="primaryInverse" size="lg">
                Score my resume — free
              </Button>
              <Button as="a" href="/build" variant="outlineInverse" size="lg">
                Build tailored resume
              </Button>
            </div>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
