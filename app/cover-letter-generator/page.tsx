import type { Metadata } from "next";
import JsonLd from "../json-ld";
import ResumeToolPanel from "@/components/ResumeToolPanel";
import { FaqSection } from "../seo-blocks";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { Badge, Breadcrumb, Button, Card, Container, Eyebrow, MarketingShell, PageHeader, Section } from "@/components/ui/primitives";
import { tailoredResumes } from "@/lib/limits";

// /cover-letter-generator — SEO landing for "cover letter generator".
// RoleSharp's cover letter feature is Premium; this page is the public entry point.
export const metadata: Metadata = {
  title: "AI Cover Letter Generator (2026)",
  description:
    "Generate a cover letter grounded in your saved resume — assembled from your real roles, achievements, and skills for the company and role you name.",
  alternates: { canonical: "/cover-letter-generator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "AI Cover Letter Generator — Tailored to Any Job",
    description: "A cover letter built from your actual saved resume. Grounded in your evidence, ATS-friendly.",
    url: "/cover-letter-generator",
  },
};

const FAQS: [string, string][] = [
  ["Is the cover letter generator free?", `It's a Premium feature. You can try RoleSharp free — ${tailoredResumes(env.freeMonthlyLimit)} a month with ATS scores — and cover letters unlock with Premium at $${env.priceMonthlyCents / 100} for ${env.daysMonthly} days or $${env.priceYearlyCents / 100} for ${env.daysYearly}. Students with a university email get 6 months of Premium free.`],
  ["How is this different from a template cover letter?", "Your letter is assembled from your actual saved resume — the roles, achievements, skills, and projects you built here — and the opening names the exact company and role you're applying to. It's not a fill-in-the-blank template: every line traces back to your real experience, and it never claims anything your resume doesn't."],
  ["Can I edit the cover letter after it's generated?", "Yes. The generated letter is a starting point you can edit in the builder. Most users tweak the opening and a sentence or two to sound like themselves."],
  ["Does the cover letter match my resume?", "Yes — the generator uses your existing RoleSharp resume as its source, so the letter reinforces the same achievements and keywords rather than repeating or contradicting them."],
  ["How do I use the finished letter?", "Copy it with one click and paste it into the application form, your email, or the job portal. It's plain, ATS-friendly text — no formatting to break."],
];

/* Illustrative inputs → draft showcase (ported from the redesign concept).
   Fictional example company/candidate, consistent with the homepage mock. */
function GeneratorShowcase() {
  const label =
    "text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]";
  const field =
    "mt-1.5 rounded-md border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] px-3 py-2 text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)]";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]" aria-label="Example cover letter generation">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          Example — not a form
        </p>
        {/* pointer-events-none: the mock reads as a form, and visitors tried to
            type into it. It is an illustration; the real inputs live above. */}
        <Card variant="elevated" padding="lg" className="reveal-on-scroll h-fit select-none pointer-events-none" aria-hidden="true">
          <Eyebrow>Inputs</Eyebrow>
          {/* No opacity dimming: #52647A at 0.8 over white composites to
              #758395 = 3.86:1, under the AA floor. The entrance animation
              used to mask this by holding opacity at 1; under reduced motion
              the static value applied and the labels failed. Full-strength
              muted tokens pass (7.4:1); the card still reads as an example
              via the aria-hidden frame and the "not a form" eyebrow. */}
          <div className="mt-4 grid gap-4 text-sm">
            <div>
              <div className={label}>Company</div>
              <div className={field}>Ledgerline</div>
            </div>
            <div>
              <div className={label}>Role</div>
              <div className={field}>Senior Product Designer</div>
            </div>
            <div>
              <div className={label}>Tone</div>
              <div className={field}>Direct</div>
            </div>
            <div>
              <div className={label}>Why this company (one sentence)</div>
              <div className={`${field} text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]`}>
                Something specific — a product decision, a value, a person&apos;s work…
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card variant="elevated" padding="lg" className="reveal-on-scroll">
        <Eyebrow>Draft</Eyebrow>
        <article className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
          <p>Dear Ledgerline hiring team,</p>
          <p>
            I&apos;m applying for the Senior Product Designer role. In seven years designing
            B2B workflows, my strongest work has been on billing and onboarding —
            exactly the two surfaces your careers page mentions as this year&apos;s focus.
          </p>
          <p>
            At Ledgerline I&apos;d expect to spend the first quarter on the failed-renewal
            path, since that&apos;s where I&apos;ve moved the metric fastest before (18% at my
            current role). I&apos;d want to pair that with lightweight research so the
            second-quarter work is grounded in what your customers actually hit.
          </p>
          <p>
            Happy to share a walkthrough of the billing redesign. Thank you for your time.
          </p>
        </article>
        <p className="mt-4 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          Illustrative example — your letter is written from your real resume and the actual posting.
        </p>
      </Card>
    </div>
  );
}

export default function CoverLetterPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: `${env.siteUrl}/` },
          { name: "Cover Letter Generator", item: `${env.siteUrl}/cover-letter-generator` },
        ])}
      />

      {/* PageHero-style header */}
      <header className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-[var(--color-primary)]/10 blur-3xl"
        />
        <Container className="relative z-10 py-12 md:py-16">
          <div className="max-w-3xl">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cover Letter Generator" }]} />
            <PageHeader
              eyebrow="Cover Letter Generator"
              title="A tight cover letter. Real evidence. No filler."
              description={
                <>
                  Generate a cover letter from the resume you actually built here — assembled from your real roles,
                  achievements, and skills for the company and role you name. Three tones change how the same evidence
                  leads — not a template swap.
                </>
              }
              meta={<Badge variant="premium">Premium feature</Badge>}
              actions={
                <>
                  <Button as="a" href="#generator" size="lg">Generate my cover letter</Button>
                  <Button as="a" href="/pricing" variant="outline" size="lg">See pricing</Button>
                </>
              }
              className="mb-0"
            />
          </div>
        </Container>
      </header>

      {/* The generator itself. /api/cover keys off a saved resume, so the entry
          point is "pick one of yours" rather than a blank textarea. */}
      <Section asContainer={false} size="sm" id="generator">
        <Container size="small">
          <ResumeToolPanel
            kind="cover"
            heading="Generate your cover letter"
            description="Pick a resume you already made and RoleSharp writes a cover letter from the evidence in it — no invented claims."
            actionLabel="Write my cover letter"
          />
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container>
          <GeneratorShowcase />
        </Container>
      </Section>

      <Section asContainer={false} size="sm" alt>
        <Container size="small">
          <Card padding="lg" className="reveal-on-scroll">
            <h2 className="text-lg md:text-xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              How it works
            </h2>
            <ol className="space-y-3 text-[var(--color-text)] dark:text-[var(--color-dark-text)] list-decimal pl-5">
              <li><strong>Build or import your resume.</strong> The cover letter draws entirely from your resume — the same achievements, skills, and tone.</li>
              <li><strong>Name the target.</strong> Add the company and role you're applying to, and the opening addresses them directly.</li>
              <li><strong>Generate the letter.</strong> Get a cover letter whose every line comes from your documented experience — in the tone you pick.</li>
              <li><strong>Edit and send.</strong> Tweak the wording, copy it, and paste it straight into the application.</li>
            </ol>
          </Card>
        </Container>
      </Section>

      

      

      <FaqSection heading="Frequently asked questions" faqs={FAQS} headingClassName="text-lg md:text-xl" />

      
    </MarketingShell>
  );
}
