import type { Metadata } from "next";
import JsonLd from "../json-ld";
import BuildLauncher from "@/components/BuildLauncher";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { Breadcrumb, Button, Card, Container, Eyebrow, MarketingShell, Section } from "@/components/ui/primitives";

// /resume-translator — SEO landing for "resume translator".
// RoleSharp's country-localization is the closest equivalent: it rebuilds the
// resume for a target country's conventions rather than literal text translation.
export const metadata: Metadata = {
  title: "Resume Country Adapter (2026)",
  description:
    "Adapt resume formatting, conventions, and keywords for more than 200 countries and territories, with country-aware guidance.",
  alternates: { canonical: "/resume-translator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Resume Translator & Country Adapter — Any Market",
    description: "Rebuild your resume for 200+ countries with correct formatting and conventions. Free to try.",
    url: "/resume-translator",
  },
};

const FAQS: [string, string][] = [
  ["Does RoleSharp translate resume text into other languages?", "RoleSharp focuses on country adaptation rather than literal text translation — it rebuilds the resume's formatting, conventions, and keyword structure for the target market. For full text translation you'd pair it with a translation tool; for making a resume read correctly in a new market's format, RoleSharp handles it directly."],
  ["What's the difference between translating and adapting a resume?", "Translating swaps the words. Adapting also checks the application market's length, section order, terminology, date style, and privacy conventions. Photos stay optional unless a verified employer or job-posting rule says otherwise."],
  ["Which countries are supported?", "200+. The builder asks for your target country and adjusts section order, length, photo conventions, date formats, and keyword expectations for that specific market."],
  ["Can I adapt my existing resume for a new country?", "Yes. Upload or paste your existing resume into the fixer or builder, set the target country, and RoleSharp rebuilds it with the correct conventions for that market."],
  ["Is country adaptation free?", "Yes — the free plan includes 3 country-adapted resumes a month. You can build a US resume, a UK version, and a UAE version of the same content on the free tier."],
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

/* Illustrative source → target panes (ported from the redesign concept). */
function AdapterShowcase() {
  const pill =
    "rounded-full border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]";
  const pane =
    "mt-3 rounded-md border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] p-4 text-sm leading-relaxed text-[var(--color-text)] dark:text-[var(--color-dark-text)]";
  return (
    <div aria-label="Example: the same resume adapted from a US to a German market">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="elevated" padding="lg" className="reveal-on-scroll">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Source market</Eyebrow>
            <span className={pill}>United States</span>
          </div>
          <div className={pane}>
            <p className="font-semibold">Product Designer</p>
            <p className="mt-1 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              One page — no photo — no date of birth — experience first — dates as
              &quot;Jan 2022 – Present&quot;
            </p>
          </div>
        </Card>
        <Card variant="elevated" padding="lg" className="reveal-on-scroll">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Target market</Eyebrow>
            <span className={pill}>Germany</span>
          </div>
          <div className={pane}>
            <p className="font-semibold">Produktdesigner:in — Lebenslauf</p>
            <p className="mt-1 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Up to two pages — photo conventional — personal details commonly appear —
              dates as DD.MM.YYYY — formal tone
            </p>
          </div>
        </Card>
      </div>
      <Card variant="elevated" padding="lg" className="mt-6 reveal-on-scroll">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              Localization changes RoleSharp would apply
            </div>
            <ul className="mt-2 grid gap-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] md:grid-cols-2">
              <li>— Convert dates to the local format</li>
              <li>— Adjust page-length expectations</li>
              <li>— Reorder sections to the market&apos;s convention</li>
              <li>— Photo guidance without inventing a requirement</li>
            </ul>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button as="a" href="/build">Adapt my resume — free</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ResumeTranslatorPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: `${env.siteUrl}/` },
          { name: "Resume Translator", item: `${env.siteUrl}/resume-translator` },
        ])}
      />
      <JsonLd data={FAQ_LD} />

      {/* PageHero-style header */}
      <header className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-[var(--color-primary)]/10 blur-3xl"
        />
        <Container className="relative z-10 py-12 md:py-16">
          <div className="max-w-3xl">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Resume Translator" }]} />
            <Eyebrow>Country Adapter</Eyebrow>
            <h1 className="mt-3 text-3xl md:text-[2.6rem] font-bold leading-[1.08] tracking-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              Localize, don&apos;t just translate.
            </h1>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl">
              Applying abroad? Don&apos;t just translate the words — adapt the format. RoleSharp rebuilds your resume for 200+
              countries and territories with market-aware conventions, privacy-safe personal details, and photo guidance that never invents a requirement.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button as="a" href="/build" size="lg">
                Adapt my resume — free
              </Button>
              <Button as="a" href="/resume-fixer" variant="outline" size="lg">
                Check my current resume
              </Button>
            </div>
          </div>
        </Container>
      </header>

      {/* Entry point: /build owns the work and reads prefill from the fragment. */}
      <Section asContainer={false} size="sm" id="launcher">
        <Container size="small">
          <BuildLauncher
            mode="country"
            heading="Adapt your resume to a market"
            description="Resume conventions differ by country — photo or no photo, page length, date formats, what belongs in a header. Pick your target market and the builder applies that market's rules."
            actionLabel="Open the builder for this country"
          />
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container>
          <AdapterShowcase />
        </Container>
      </Section>

      

      

      

      

      <Section asContainer={false} size="sm" alt>
        <Container size="small">
          <div className="reveal-on-scroll">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
              Frequently asked questions
            </h2>
            <div className="space-y-3">
              {FAQS.map(([q, a]) => (
                <details
                  key={q}
                  className="group rounded-[var(--radius-lg)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] open:border-[var(--color-primary)] transition-colors"
                >
                  <summary className="flex items-center justify-between gap-4 px-5 py-4 font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)] cursor-pointer list-none hover:text-[var(--color-primary)] transition-colors">
                    <h3 className="text-base">{q}</h3>
                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] group-open:bg-[var(--color-primary)] group-open:text-white flex items-center justify-center text-sm transition-colors">
                      +
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      
    </MarketingShell>
  );
}
