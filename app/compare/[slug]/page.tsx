import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  COMPETITORS,
  comparisonWinnerCounts,
  competitorEvidenceLastChecked,
  getCompetitor,
  rowHasCurrentEvidence,
} from "@/content/competitors";
import { FaqSection } from "../../seo-blocks";
import AskAiLinks from "../../ask-ai-links";
import JsonLd from "../../json-ld";
import { env } from "@/lib/env";
import { Container, Section, Card, Button, MarketingShell, Breadcrumb } from "@/components/ui/primitives";
import { comparisonSeoMetadata } from "@/lib/seo-metadata";

// Comparison landing pages: /compare/rolesharp-vs-<competitor>.
// High-intent "X vs Y" SEO pages. Honest by design — each page credits the
// competitor's real strengths before making RoleSharp's case.

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getCompetitor(slug);
  if (!c) return {};
  const seo = comparisonSeoMetadata(c.name);
  return {
    title: { absolute: seo.title },
    description: seo.description,
    alternates: {
      canonical: `/compare/${c.slug}`,
      // Markdown twin for AI crawlers (see app/compare-md/[slug]/route.ts)
      types: { "text/markdown": `/compare/${c.slug}.md` },
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `/compare/${c.slug}`,
      type: "website",
      images: [`/compare/${c.slug}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [`/compare/${c.slug}/opengraph-image`],
    },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCompetitor(slug);
  if (!c) notFound();

  const base = env.siteUrl;
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Compare", item: `${base}/compare` },
      { "@type": "ListItem", position: 3, name: `RoleSharp vs ${c.name}`, item: `${base}/compare/${c.slug}` },
    ],
  };

  const counts = comparisonWinnerCounts(c);
  const lastChecked = competitorEvidenceLastChecked(c);

  return (
    <MarketingShell className="reading-shell">
      <JsonLd data={breadcrumbLd} />

      <section className="reading-masthead">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Compare", href: "/compare" }, { label: c.name }]} />
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-6 max-w-3xl">
            {c.h1}{" "}
            <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] font-normal">
              (2026)
            </span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-8">
            {c.intro}
          </p>
          <div className="flex flex-wrap gap-4">
            <Button as="a" href="/checker" size="lg">
              Check my resume free
            </Button>
            <Button as="a" href="/pricing" variant="outline" size="lg">
              See RoleSharp pricing
            </Button>
          </div>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card padding="md" className="border-l-4 border-[var(--color-primary)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              The short version
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
              {c.verdict}
            </p>
          </Card>
        </Container>
      </Section>

      <Section asContainer={false} alt size="sm">
        <Container>
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Side by side
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              {counts.comparable === c.rows.length
                ? `${counts.us} of ${counts.comparable} comparable rows favor RoleSharp, ${counts.them} favor ${c.shortName}. Ties reflect different or non-equivalent boundaries.`
                : `${counts.comparable} of ${c.rows.length} rows have current comparable evidence. Expired, disputed, or non-equivalent claims are not counted as wins.`}
            </p>
          </div>
          <Card padding="md">
            <div tabIndex={0} role="region" aria-label={`Feature comparison with ${c.name}`} className="overflow-x-auto -mx-4 px-4">
              <table className="w-full min-w-[700px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
                    <th scope="col" className="text-left py-4 px-4 font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                      Feature
                    </th>
                    <th
                      scope="col"
                      className="py-4 px-4 text-left font-bold text-[var(--color-primary)] bg-[var(--color-primary-50)] dark:bg-[var(--color-dark-surface-2)] rounded-t-lg"
                    >
                      RoleSharp
                    </th>
                    <th scope="col" className="py-4 px-4 text-left font-bold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                      {c.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map((r) => {
                    const current = rowHasCurrentEvidence(c, r);
                    return (
                    <tr key={r.feature} className="border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] last:border-0">
                      <th scope="row" className="py-4 px-4 text-left font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                        {r.feature}
                        {!current && <span className="mt-1 block text-xs font-normal text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)]">Not scored — evidence is disputed or due for review</span>}
                      </th>
                      <td className="py-4 px-4 bg-[var(--color-primary-50)]/50 dark:bg-[var(--color-dark-surface)]/50 font-medium text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                        {r.rolesharp}
                      </td>
                      <td className="py-4 px-4 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                        {r.them}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)]">
              Evidence last captured {lastChecked}. {c.sourcesNote}
            </p>
            {c.evidence?.length ? (
              <details className="mt-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                <summary className="cursor-pointer font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Evidence and review status</summary>
                <ul className="mt-3 grid gap-3">
                  {c.evidence.map((item) => (
                    <li key={item.id} className="rounded-lg border border-[var(--color-border)] p-3 dark:border-[var(--color-dark-border)]">
                      <a href={item.sourceUrl} rel="nofollow" className="font-semibold">{item.claim}</a>
                      <span className="mt-1 block text-xs">Captured {item.capturedAt} — Review by {item.reviewBy} — Status: {item.status} — Volatility: {item.volatility}</span>
                      {item.notes && <span className="mt-1 block text-xs">{item.notes}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Where {c.shortName} wins
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Credit where it&rsquo;s due — an honest comparison cuts both ways.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.themWins.map((w) => (
              <Card key={w.heading} variant="elevated" padding="md">
                <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">
                  {w.heading}
                </b>
                <span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                  {w.body}
                </span>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section asContainer={false} alt size="sm">
        <Container>
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Where RoleSharp wins
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.usWins.map((w) => (
              <Card key={w.heading} variant="elevated" padding="md">
                <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">
                  {w.heading}
                </b>
                <span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                  {w.body}
                </span>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card padding="md">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
              {c.pricingHeading}
            </h2>
            <p className="text-[var(--color-text)] dark:text-[var(--color-dark-text)] leading-relaxed mb-4">
              {c.pricingProse}
            </p>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Full RoleSharp pricing is on the{" "}
              <a href="/pricing" className="font-semibold">pricing page</a> — no checkout required to see it.
            </p>
          </Card>
        </Container>
      </Section>


      <FaqSection visible heading={`RoleSharp vs ${c.name} — common questions`} faqs={c.faqs} />
      <Container size="small" className="pb-2">
        <AskAiLinks topic={`RoleSharp vs ${c.name} for resume building`} />
      </Container>
    </MarketingShell>
  );
}
