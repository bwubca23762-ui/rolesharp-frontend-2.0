import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { FileText, Globe, Mail, Shield, Target, Users } from "@/app/icons";
import { Button, Card, Container, MarketingShell, PageHeader, Section, SectionHeader } from "@/components/ui/primitives";
import { getAuthor, authorPersonLd } from "@/lib/authors";
import { PARTNERSHIPS_EMAIL } from "@/lib/contact";
import { env } from "@/lib/env";
import { JOB_COUNTRIES } from "@/lib/job-config";
import { formatStat, getSiteStats } from "@/lib/site-stats";

export const metadata: Metadata = {
  title: "Press & Media Kit",
  description: "Find RoleSharp company facts, founder information, brand assets and press contacts for stories about resumes, ATS tools and the job search.",
  alternates: { canonical: "/press" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp Press & Media Kit",
    description: "Boilerplate, facts, founder bio, and brand assets for press coverage of RoleSharp.",
    url: "/press",
  },
};

const BOILERPLATE = "RoleSharp is a job-application platform that connects resume checks, role-specific tailoring, controlled application email, and tracking. Its free tools — ATS checker, resume match, salary estimator, interview bank, and a set of evidence-grounded generators — run in the browser without an account. The product is built around reviewable evidence: it suggests edits traceable to facts the job seeker provided, states what a diagnostic score can and cannot mean, and never invents experience or metrics.";

const STORY_ANGLES = [
  {
    icon: Shield,
    title: "What an ATS actually does to your resume",
    body: "How applicant tracking systems parse, score, and filter applications — and what the free RoleSharp ATS checker reveals about keyword coverage and structure.",
  },
  {
    icon: Target,
    title: "Tailoring beats blasting",
    body: "Why one resume matched to one job description outperforms a generic resume sent everywhere, with the match-score data to illustrate the gap.",
  },
  {
    icon: Globe,
    title: "Resume rules change by country",
    body: "Page length, photos, personal details, and terminology differ across 200+ markets. RoleSharp's country guidance makes the differences concrete.",
  },
  {
    icon: Users,
    title: "Salary transparency from live postings",
    body: "The Salary Estimator publishes 25th/median/75th percentile bands from real advertised ranges across 72 countries — and says so when data is thin.",
  },
] as const;

export default async function PressPage() {
  const founder = getAuthor("mustak");
  const stats = await getSiteStats();
  const base = env.siteUrl;

  const facts = [
    [formatStat(stats.resumesScored), "resumes scored on the platform"],
    [formatStat(stats.companies), "company guides indexed"],
    [formatStat(stats.roles), "role guides indexed"],
    [`${JOB_COUNTRIES.length}`, "configured job markets"],
  ] as const;

  const pressPageLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${base}/press#page`,
    url: `${base}/press`,
    name: "RoleSharp Press & Media Kit",
    description: "Press resources for journalists covering RoleSharp, ATS systems, and the modern job search.",
    isPartOf: { "@id": `${base}/#website` },
    mainEntity: [{ "@id": `${base}/#org` }, { "@id": `${base}/#person-mustak` }],
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Press", item: `${base}/press` },
    ],
  };

  return (
    <MarketingShell className="reading-shell">
      <JsonLd data={[pressPageLd, authorPersonLd(founder), breadcrumbLd]} />

      <header className="reading-masthead">
        <Container className="py-14 md:py-20">
          <PageHeader
            title="RoleSharp press kit"
            description="Boilerplate, a live fact sheet, founder background, brand assets, and story angles on ATS systems, resume tailoring, and salary transparency. For interviews or data requests, write to the press contact below."
            actions={<><Button as="a" href={`mailto:${PARTNERSHIPS_EMAIL}?subject=RoleSharp%20press%20inquiry`}>Email the press contact</Button><Button as="a" href="#boilerplate" variant="outline">Read the boilerplate</Button></>}
          />
        </Container>
      </header>

      <Section id="boilerplate" asContainer={false} className="scroll-mt-24">
        <Container>
          <SectionHeader eyebrow="Boilerplate" title="The short version, ready to quote." description="Use as-is or trim to fit. For a longer cut, the About & Methodology page documents how the product works." />
          <Card variant="elevated" padding="lg" className="mt-8">
            <p className="text-base leading-8 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{BOILERPLATE}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button as="a" href="/about" variant="outline" size="sm">About & methodology</Button>
              <Button as="a" href="/tools" variant="outline" size="sm">Free tools catalogue</Button>
            </div>
          </Card>
        </Container>
      </Section>

      <Section asContainer={false} alt>
        <Container>
          <SectionHeader eyebrow="Fact sheet" title="Numbers pulled live from the platform." description="These figures are queried from the production database when this page renders. RoleSharp does not publish estimates, projections, or invented user counts." />
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {facts.map(([value, label]) => (
              <Card key={label} padding="sm">
                <strong className="text-2xl text-[var(--color-primary)]">{value}</strong>
                <span className="mt-1 block text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{label}</span>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section asContainer={false}>
        <Container>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card variant="elevated" padding="lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]"><Users size={21} /></span>
              <h2 className="mt-5 text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Founder</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]"><strong className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{founder.name}</strong> — {founder.title}. {founder.bio}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Interviews and commentary available on ATS behaviour, resume strategy, country-specific application norms, and salary-transparency data.</p>
            </Card>
            <Card variant="elevated" padding="lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]"><FileText size={21} /></span>
              <h2 className="mt-5 text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Brand assets</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">The RoleSharp mark ships as an SVG favicon and a 512×512 PNG icon; the social preview image is generated at <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs dark:bg-[var(--color-dark-surface-2)]">/opengraph-image</code>. Use the mark to identify RoleSharp in coverage; don&apos;t recolor it, embed it in your own logo, or imply endorsement.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button as="a" href="/icon.svg" variant="outline" size="sm">Logo (SVG)</Button>
                <Button as="a" href="/icon-512.png" variant="outline" size="sm">Icon (PNG 512)</Button>
              </div>
            </Card>
          </div>
        </Container>
      </Section>

      <Section asContainer={false} alt>
        <Container>
          <SectionHeader eyebrow="Story angles" title="Topics we can speak to with data." description="Each of these maps to a live RoleSharp feature or dataset, so quotes can be backed by something a reader can try." />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {STORY_ANGLES.map(({ icon: Icon, title, body }) => (
              <Card key={title} padding="lg">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]"><Icon size={20} /></span>
                <h3 className="mt-4 text-lg font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section asContainer={false}>
        <Container>
          <Card variant="dark" padding="lg">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[var(--color-brand-amber)]"><Mail size={21} /></span>
            <h2 className="mt-5 text-2xl font-bold">Press contact</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">For interviews, data requests, or fact-checking, email <a href={`mailto:${PARTNERSHIPS_EMAIL}`} className="font-semibold text-white underline-offset-4 hover:underline">{PARTNERSHIPS_EMAIL}</a> with your outlet, deadline, and the specific question or dataset you need.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Button as="a" href={`mailto:${PARTNERSHIPS_EMAIL}?subject=RoleSharp%20press%20inquiry`} variant="primaryInverse">Send a press inquiry</Button><Button as="a" href="/contact" variant="outlineInverse">General contact</Button></div>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
