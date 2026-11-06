import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumb, Button, Card, Container, Eyebrow, MarketingShell, Section } from "@/components/ui/primitives";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { candidatesPromise, salaryPageStats } from "@/lib/salary-pages";
import { MIN_SAMPLE } from "@/lib/salary-data";
import JsonLd from "../../../json-ld";

// One template over the live jobs table, prebuilt for the strongest role×market
// pairs only. dynamicParams = false is the anti-spam mechanism: a URL that was
// not generated here 404s, so there is no crawlable thin page for an empty
// combination. revalidate is daily — postings roll on ingestion schedules.
// Country level, not city: the ingestor does not populate jobs.city yet
// (0 of ~227K rows), so a city page would be an empty promise — see
// docs/PROGRAMMATIC-SEO.md for the follow-up.
//
// Candidate LIST: candidatesPromise memoizes per 6h (module scope), so the
// list can be up to 6h stale — bounded, and every figure on the page comes
// from the same engine either way. Page STATS: fetched fresh per render and
// shared between generateMetadata and the page through React's cache(), so
// the SERP description and the on-page sample size can never disagree.
export const revalidate = 86400;
export const dynamicParams = false;

const candidatesCache = cache(() => candidatesPromise(150));
const prebuiltSlugs = cache(async () => {
  const candidates = await candidatesCache();
  return new Set(candidates.map((c) => `${c.roleSlug}/${c.countryCode.toLowerCase()}`));
});
const statsFor = cache((roleSlug: string, country: string) =>
  prebuiltSlugs().then((slugs) => salaryPageStats(roleSlug, country, slugs)),
);

export async function generateStaticParams(): Promise<Array<{ role: string; country: string }>> {
  const candidates = await candidatesCache();
  return candidates.map((candidate) => ({ role: candidate.roleSlug, country: candidate.countryCode.toLowerCase() }));
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "the United States", GB: "the United Kingdom", IN: "India", DE: "Germany", FR: "France",
  ES: "Spain", IT: "Italy", NL: "the Netherlands", IE: "Ireland", AE: "the UAE", SG: "Singapore",
  CA: "Canada", AU: "Australia",
};

function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

function fmt(n: number | null, currency: string): string {
  if (n == null) return "—";
  return `${currency} ${n.toLocaleString()}`;
}

export async function generateMetadata({ params }: { params: Promise<{ role: string; country: string }> }): Promise<Metadata> {
  const { role: roleSlug, country } = await params;
  const candidates = await candidatesCache();
  const candidate = candidates.find((c) => c.roleSlug === roleSlug && c.countryCode.toLowerCase() === country);
  if (!candidate) return {};
  // Same execution the page body uses (React cache) — the numbers here ARE
  // the numbers on the page.
  const stats = await statsFor(roleSlug, country);
  if (!stats) return {};
  const market = countryName(stats.countryCode);
  const title = `${stats.roleTitle} salary in ${market} (${new Date().getFullYear()})`;
  const description = `Real ${stats.roleTitle.toLowerCase()} pay in ${market}: 25th percentile, median, and 75th percentile computed from ${stats.sampleSize.toLocaleString()} live job postings with published salaries — not estimates.`;
  return {
    title,
    description,
    alternates: { canonical: `/salaries/${roleSlug}/${country}` },
    openGraph: {
      type: "website",
      images: [`/salaries/${roleSlug}/${country}/opengraph-image`],
      title,
      description,
      url: `/salaries/${roleSlug}/${country}`,
    },
  };
}

export default async function SalaryCountryPage({ params }: { params: Promise<{ role: string; country: string }> }) {
  const { role: roleSlug, country } = await params;
  const candidates = await candidatesCache();
  const candidate = candidates.find((c) => c.roleSlug === roleSlug && c.countryCode.toLowerCase() === country);
  // With dynamicParams=false Next only reaches here for prebuilt params, but
  // the stats are re-fetched fresh on every revalidation — if the pair has
  // since fallen below the sample bar, the page honestly disappears rather
  // than showing stale numbers. (The candidate LIST behind it is at most 6h
  // stale; see the memo comment in lib/salary-pages.ts.)
  if (!candidate) notFound();
  const stats = await statsFor(roleSlug, country);
  if (!stats || stats.sampleSize < MIN_SAMPLE) notFound();

  const market = countryName(stats.countryCode);
  const rows: Array<[string, number | null]> = [
    ["25th percentile", stats.p25],
    ["Median", stats.median],
    ["75th percentile", stats.p75],
  ];

  const faqs: Array<[string, string]> = [
    ["How is this salary data collected?", `The numbers are computed from ${stats.sampleSize.toLocaleString()} live job postings in ${market} that publish an annual salary — job-board estimates are not mixed in. Postings roll in and out continuously, so the figures are recomputed daily from what employers are advertising right now.`],
    ["Why is the range wide?", stats.p25 != null && stats.p75 != null ? `The gap between ${fmt(stats.p25, stats.currency)} and ${fmt(stats.p75, stats.currency)} is the market itself: experience levels, company sizes, and negotiating positions all differ. The median — ${fmt(stats.median, stats.currency)} — is the middle of what employers actually advertise.` : "Some markets publish fewer salary-bearing postings, so the percentiles carry real spread. The sample size above is the honest measure of how much data stands behind each number."],
    ["How should I use this in a negotiation?", "Anchor on the median for your experience level, and use the 75th percentile as the ask when your evidence — resume, portfolio, interview — supports the top of what employers advertise for this role."],
  ];

  // The bar's geometry is the data: its full width IS the p25–p75 spread, and
  // the tick sits where the median falls inside that spread. A zero-width
  // range has no shape to draw, so the bar is skipped rather than faked.
  const iqr = stats.p25 != null && stats.p75 != null ? stats.p75 - stats.p25 : null;
  const medianRatio =
    iqr != null && iqr > 0 && stats.median != null
      ? Math.min(1, Math.max(0, (stats.median - (stats.p25 as number)) / iqr))
      : null;

  return (
    <>
      <JsonLd data={breadcrumbLd([
        { name: "Home", item: env.siteUrl },
        { name: "Salaries", item: `${env.siteUrl}/salaries` },
        { name: `${stats.roleTitle} in ${market}`, item: `${env.siteUrl}/salaries/${roleSlug}/${stats.countryCode.toLowerCase()}` },
      ])} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
      }} />
      <MarketingShell>
        <header className="relative overflow-hidden">
          <Container className="relative z-10 py-12 md:py-16">
            <div className="max-w-3xl">
              <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Salaries", href: "/salaries" }, { label: `${stats.roleTitle} in ${market}` }]} />
              <h1 className="mt-3 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold! leading-[1.02]! tracking-[-0.03em]! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                {stats.roleTitle} salary in {market}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Computed from <b>{stats.sampleSize.toLocaleString()}</b> live postings with published annual pay in {market} — refreshed daily, not estimated.
              </p>
            </div>
          </Container>
        </header>

        <Section asContainer={false} size="sm">
          <Container>
            <Card padding="lg" className="mb-6">
              <Eyebrow>What employers advertise in {market}</Eyebrow>
              <div className="mt-4 divide-y divide-[var(--hairline)]">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{label}</span>
                    <b className="text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{fmt(value, stats.currency)}</b>
                  </div>
                ))}
              </div>
              {medianRatio != null && (
                <div className="mt-5" aria-hidden="true">
                  <div className="relative h-2 rounded-full bg-[var(--color-surface-2)]">
                    <span className="absolute inset-y-0 left-0 right-0 rounded-full bg-[var(--color-primary)] opacity-25" />
                    <span className="absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[var(--color-primary)]" style={{ left: `${(medianRatio * 100).toFixed(1)}%` }} title={`Median ${fmt(stats.median, stats.currency)}`} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-[var(--muted-fg)]">
                    <span>{fmt(stats.p25, stats.currency)}</span>
                    <span>{fmt(stats.p75, stats.currency)}</span>
                  </div>
                </div>
              )}
              <p className="mt-4 text-[13px] text-[var(--muted-fg)]">
                Based on <b>{stats.sampleSize.toLocaleString()}</b> live postings with published annual pay for this role and market.
              </p>
            </Card>

            {stats.employers.length > 0 && (
              <Card padding="lg" className="mb-6">
                <h2 className="text-lg font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Employers advertising {stats.roleTitle.toLowerCase()} roles in {market}</h2>
                <p className="mt-1 text-[13px] text-[var(--muted-fg)]">The companies behind the sample — with the median they advertise.</p>
                <div className="mt-3 divide-y divide-[var(--hairline)]">
                  {stats.employers.map((employer) => (
                    <div key={employer.company} className="flex items-center justify-between gap-4 py-2.5">
                      <span className="text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{employer.company}</span>
                      <span className="text-[13px] text-[var(--muted-fg)]">
                        {employer.n} posting{employer.n === 1 ? "" : "s"}
                        {employer.median != null ? ` · median ${fmt(employer.median, stats.currency)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {stats.siblings.length > 0 && (
              <Card padding="lg" className="mb-6">
                <h2 className="text-lg font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{stats.roleTitle} pay across markets</h2>
                <div className="mt-3 divide-y divide-[var(--hairline)]">
                  {stats.siblings.map((sibling) => (
                    <div key={sibling.countryCode} className="flex items-center justify-between gap-4 py-2.5">
                      <span className="text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                        {sibling.linkable ? (
                          <Link href={`/salaries/${roleSlug}/${sibling.countryCode.toLowerCase()}`} className="underline decoration-[var(--hairline)] underline-offset-4 hover:decoration-[var(--color-primary)]">{countryName(sibling.countryCode)}</Link>
                        ) : countryName(sibling.countryCode)}
                      </span>
                      <span className="text-[13px] text-[var(--muted-fg)]">
                        median {fmt(sibling.median, sibling.currency)} · {sibling.sampleSize.toLocaleString()} postings
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card padding="lg" className="mb-6">
              <h2 className="text-lg font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Earn the top of this range</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                The 75th percentile goes to resumes that mirror what the posting asks for. Check what your resume signals, then tailor it to the exact job.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button as="a" href="/checker">Check my resume free</Button>
                <Button as="a" href="/jobs" variant="outline">{stats.roleTitle} jobs</Button>
                <Button as="a" href={`/roles/${roleSlug}`} variant="outline">About the {stats.roleTitle} role</Button>
              </div>
            </Card>

            <Card padding="lg">
              <h2 className="text-lg font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">How the numbers work</h2>
              <div className="mt-3">
                {faqs.map(([question, answer]) => (
                  <details key={question} className="group border-b border-[var(--hairline)] py-1">
                    <summary className="cursor-pointer list-none py-2.5 text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{question}</summary>
                    <p className="pb-3 text-sm leading-7 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{answer}</p>
                  </details>
                ))}
              </div>
              <p className="mt-4 text-[13px] text-[var(--muted-fg)]">
                Medians and percentiles come from the midpoint of each posting&apos;s advertised range. Roles match by title words, so adjacent specialisations are included. No number on this page is invented, model-generated, or estimated — if the sample is too small to state a figure, the figure is not shown.
              </p>
              {/* AskAiLinks removed */}
              <div hidden className="mt-3" />
            </Card>
          </Container>
        </Section>
      </MarketingShell>
    </>
  );
}
