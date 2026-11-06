import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { FileText, Lock, Shield, Target } from "@/app/icons";
import { RelatedWorkflow } from "@/components/marketing";
import { Button, Card, Container, MarketingShell, PageHeader, Section, SectionHeader } from "@/components/ui/primitives";
import { getAuthor, authorPersonLd } from "@/lib/authors";
import { env } from "@/lib/env";
import { JOB_COUNTRIES } from "@/lib/job-config";
import { formatStat, getSiteStats } from "@/lib/site-stats";
import { SUPPORT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "About & Methodology",
  description: "How RoleSharp evaluates resumes, limits claims, maintains country guidance, protects application data, and keeps controlled Auto Apply narrow.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp About & Methodology",
    description: "A transparent account of RoleSharp's ATS checks, evidence rules, country guidance, Auto Apply safeguards, privacy process, and correction policy.",
    url: "/about",
  },
};

const principles = [
  {
    icon: Shield,
    title: "Use supplied evidence",
    body: "Suggestions should reorganize, clarify, or strengthen facts the job seeker provided. Titles, dates, qualifications, employers, and results must not be invented.",
  },
  {
    icon: Target,
    title: "Evaluate one role at a time",
    body: "Keyword and evidence feedback is most useful when it is tied to one job description, company context, role, and country rather than a universal score.",
  },
  {
    icon: FileText,
    title: "State what a signal means",
    body: "Scores and confidence labels are diagnostic estimates. They are not employer decisions, interview probabilities, or guarantees that an ATS will rank a resume.",
  },
] as const;

const methodology = [
  {
    id: "ats-method",
    eyebrow: "ATS checks",
    title: "What the score examines—and what it cannot know",
    body: "RoleSharp inspects extractable text, standard section structure, role and job-description term coverage, evidence quality, and selected market conventions. Real employers configure different systems and rules, so no score can reproduce every ATS or recruiter decision.",
    points: ["Parsing and section readability", "Job-description term coverage", "Evidence and quantified outcomes", "Country-aware format guidance"],
  },
  {
    id: "evidence-policy",
    eyebrow: "Evidence policy",
    title: "Grounded edits remain traceable to the source",
    body: "A useful suggestion should have a visible basis in the resume, profile, or job posting. If a requirement is not supported, RoleSharp should identify the gap rather than manufacture an answer.",
    points: ["No invented experience or metrics", "One proposed change can be reviewed at a time", "Unsupported requirements stay unsupported", "Fictional demonstrations are labeled"],
  },
  {
    id: "country-guidance",
    eyebrow: "Country guidance",
    title: "Local conventions are guidance, not law",
    body: "Country context can change expectations around page length, photos, personal details, and terminology. RoleSharp exposes that advice for review and override; job-posting instructions and applicable law take priority.",
    points: ["Market context remains visible", "Guidance can be overridden", "High-risk personal details are not assumed", "Catalog coverage is separated from verified outcomes"],
  },
  {
    id: "auto-apply-safety",
    eyebrow: "Controlled Auto Apply",
    title: "Automation stops where evidence or consent stops",
    body: "RoleSharp supports application-by-email only when a current posting explicitly publishes the recipient and instruction. It does not complete job-board or ATS forms, guess contacts, or call provider acceptance confirmed delivery.",
    points: ["Posting-backed recipient required", "Consent, caps, cooldowns, and duplicate checks", "Immutable package remains reviewable", "Unknown outcomes cannot automatically retry"],
  },
  {
    id: "privacy-security",
    eyebrow: "Privacy and security",
    title: "Mailbox permission and product login remain separate",
    body: "Connected mail is limited to the documented send-only flow. RoleSharp does not request inbox-read, mailbox-modify, or contacts access for controlled email applications. Account deletion and retention boundaries are documented in the privacy policy.",
    points: ["Separate delegated mailbox consent", "No message bodies or tokens in queue payloads", "Same-origin and encrypted-session controls", "Deletion controls remain accessible"],
  },
  {
    id: "pricing-and-access",
    eyebrow: "Pricing and access",
    title: "Access terms and usage allowances answer different questions",
    body: "Premium is purchased once for a stated number of days. During that term, tailored-resume generations use a rolling monthly allowance. The pass never auto-renews; when it expires, the account returns to Free while saved resumes remain available.",
    points: [`${env.daysMonthly}-day and ${env.daysYearly}-day fixed terms`, "One-time payment with no renewal charge", "Rolling generation allowance stated separately", "Saved work remains after expiry"],
  },
  {
    id: "comparison-governance",
    eyebrow: "Competitor claims",
    title: "Volatile comparisons are dated and fail closed",
    body: "Pricing, free access, and product limits can change. Comparison evidence carries capture and review dates, volatility, source, and status. Expired, disputed, or non-equivalent evidence should not produce a numerical winner.",
    points: ["One governed source for HTML and Markdown", "High-volatility claims require review dates", "Disputed evidence renders neutrally", "Corrections propagate across public formats"],
  },
] as const;

export default async function AboutPage() {
  const founder = getAuthor("mustak");
  const stats = await getSiteStats();
  const coverage = [
    [formatStat(stats.companies), "company guides currently indexed"],
    [formatStat(stats.roles), "role guides currently indexed"],
    [stats.countries > 0 ? `${stats.countries}` : "200+", "country contexts covered"],
    [`${JOB_COUNTRIES.length}`, "configured job markets"],
  ] as const;
  const aboutPageLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${env.siteUrl}/about#page`,
    url: `${env.siteUrl}/about`,
    name: "RoleSharp About & Methodology",
    description: "How RoleSharp evaluates resumes, governs evidence, protects user control, and corrects public claims.",
    isPartOf: { "@id": `${env.siteUrl}/#website` },
    mainEntity: [{ "@id": `${env.siteUrl}/#org` }, { "@id": `${env.siteUrl}/#person-mustak` }],
  };

  return (
    <MarketingShell className="reading-shell">
      <JsonLd data={[aboutPageLd, authorPersonLd(founder)]} />

      <header className="reading-masthead">
        <Container className="py-14 md:py-20">
          <PageHeader
            eyebrow="About RoleSharp"
            title="A job-application tool should explain its evidence and its limits."
            description="RoleSharp checks and tailors resumes, tracks applications, and lets you review the evidence before you send an application."
            actions={<Button as="a" href="#methodology">Read the methodology</Button>}
          />
        </Container>
      </header>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="grid gap-4 md:grid-cols-3">
            {principles.map(({ icon: Icon, title, body }) => (
              <Card key={title} variant="elevated" padding="lg">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]"><Icon size={21} /></span>
                <h2 className="mt-5 text-lg font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section asContainer={false} alt size="sm">
        <Container>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeader eyebrow="Coverage facts" title="Catalog scope is not presented as user success." description="These figures describe currently available RoleSharp content or configuration. They do not imply applications, interviews, hires, or customer outcomes." />
            <a href="#corrections" className="min-h-11 font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline">Report a claim or correction</a>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {coverage.map(([value, label]) => <Card key={label} padding="sm"><strong className="text-2xl text-[var(--color-primary)]">{value}</strong><span className="mt-1 block text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{label}</span></Card>)}
          </div>
        </Container>
      </Section>

      <Section id="methodology" asContainer={false} className="scroll-mt-24">
        <Container>
          <SectionHeader eyebrow="Product methodology" title="Seven boundaries govern the public product." description="The standard is simple: show the basis, state uncertainty, preserve user review, and stop when consent or evidence is missing." />
          <div className="reading-article-grid mt-8 grid items-start gap-8">
            <nav aria-label="Methodology sections" className="reading-toc lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24">
              <h3 className="text-base font-bold">On this page</h3>
              <ul className="text-sm">
                {methodology.map((item) => (
                  <li key={item.id}><a href={`#${item.id}`}>{item.title}</a></li>
                ))}
              </ul>
            </nav>
            <div className="reading-measure min-w-0 lg:col-start-1 lg:row-start-1">
              {methodology.map((item) => (
                <section id={item.id} key={item.id} className="reading-index-section" aria-labelledby={`${item.id}-title`}>
                  <p className="text-sm text-[var(--muted-fg)]">{item.eyebrow}</p>
                  <h2 id={`${item.id}-title`} className="mt-1 text-2xl font-bold">{item.title}</h2>
                  <p className="mt-3 text-[var(--muted-fg)]">{item.body}</p>
                  <ul className="mt-3 list-disc space-y-2 ps-5">{item.points.map((point) => <li key={point}>{point}</li>)}</ul>
                </section>
              ))}
              <a href="/resume-fixer" className="reading-text-link">Check a resume free</a>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="corrections" asContainer={false} alt className="scroll-mt-24">
        <Container>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card variant="elevated" padding="lg" className="flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                  Methodology & Verification SLA
                </p>
                <h3 className="mt-2 text-xl font-bold text-[var(--fg)]">
                  Zero fabricated experience — ever
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-fg)]">
                  Every RoleSharp diagnostic and rewrite engine operates strictly on the facts you supply. When a bullet lacks a number, we insert an explicit placeholder like [X%] so you stay in full control of the truth.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button as="a" href="/checker" variant="primary" size="compact">
                  Try Free ATS Checker →
                </Button>
                <Button as="a" href="/build" variant="outline" size="compact">
                  Open AI Builder
                </Button>
              </div>
            </Card>
            <Card variant="dark" padding="lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[var(--color-brand-amber)]"><Lock size={21} /></span>
              <h2 className="mt-5 text-2xl font-bold">Accountable contact</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">RoleSharp content and product decisions are accountable to {founder.name}, {founder.title}. Support and correction requests can be sent to {SUPPORT_EMAIL}.</p>
              <div className="mt-6 flex flex-wrap gap-3"><Button as="a" href="/contact" variant="primaryInverse">Contact RoleSharp</Button><Button as="a" href="/privacy" variant="outlineInverse">Privacy policy</Button></div>
            </Card>
          </div>
        </Container>
      </Section>

      <RelatedWorkflow
        eyebrow="Inspect before trusting"
        title="See the method applied to a fictional resume and job."
        description="The homepage demonstration shows how source evidence, job requirements, grounded edits, diagnostic scoring, application controls, and tracking remain connected."
        href="/#application-journey"
        cta="Inspect the workflow"
        secondary={{ href: "/compare", label: "Review comparisons" }}
      />
    </MarketingShell>
  );
}
