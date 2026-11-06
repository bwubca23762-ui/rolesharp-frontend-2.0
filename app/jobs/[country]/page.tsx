import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JobsFinder from "../jobs-finder";
import JsonLd from "@/app/json-ld";
import { FaqSection } from "@/app/seo-blocks";
import { env } from "@/lib/env";
import {
  countryShortName,
  getCountryBySlug,
  refreshLabelForTier,
} from "@/lib/job-config";
import { breadcrumbLd, jobListLd, type JobListEntry } from "@/lib/seo";
import { q } from "@/lib/db";
import { jobMarketSeoMetadata } from "@/lib/seo-metadata";
import { jobMarketIndexability } from "@/lib/job-market-indexability";
import { MarketingShell, Breadcrumb } from "@/components/ui/primitives";

type Params = { params: Promise<{ country: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { country: slug } = await params;
  const country = getCountryBySlug(slug);
  if (!country) return {};

  const { title, description } = jobMarketSeoMetadata("Jobs", country.name, countryShortName(country));
  const indexable = await jobMarketIndexability(country.code, "jobs");

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/jobs/${country.slug}` },
    robots: indexable === false ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      images: ["/opengraph-image"],
      title,
      description,
      url: `/jobs/${country.slug}`,
    },
  };
}

export default async function CountryJobsPage({ params, searchParams }: Params) {
  const { country: slug } = await params;
  const country = getCountryBySlug(slug);
  if (!country) notFound();

  // Keyword typed on the /jobs picker (or a bookmarked ?q=) carries straight
  // into the results so the query the user typed is the query that runs.
  const query = (await searchParams).q;
  const initialQuery = typeof query === "string" ? query.trim().slice(0, 120) : "";

  const faqs: [string, string][] = [
    [`How fresh are jobs in ${country.name}?`, `${refreshLabelForTier(country.tier)} in ${country.name}, and expired listings fall out after 30 days. Every result links to the original employer or job board posting.`],
    [`Can I search remote jobs in ${country.name}?`, `Yes. Filter by remote-only, combine it with a title or company query, and RoleSharp will narrow the list to jobs marked remote by the source.`],
    [`Do I need an account to search jobs in ${country.name}?`, `Yes. Job search is members-only so your saved jobs, tailored resumes, and tracker activity stay attached to one RoleSharp account. The account itself is free.`],
    [`How should I tailor my resume for ${country.name}?`, `Use the builder with the exact job description so the wording, emphasis, and formatting stay grounded in that market's employer expectations instead of using a one-size-fits-all resume.`],
  ];

  const canonical = `${env.siteUrl}/jobs/${country.slug}`;

  // Recent live listings for structured data. ItemList entries point at the
  // ORIGINAL employer/board URL (apply_url) — we are a directory, not the
  // posting host, so the markup credits the source. see lib/seo.ts jobListLd.
  const recentRows = await q<{ title: string; company: string; location: string | null; apply_url: string; date_posted: string | null }>(
    `select title, company, location, apply_url, date_posted::text
     from jobs
     where lower(country_code) = lower($1)
       and expires_at > now()
       and apply_url ~* '^https?://[^[:space:]]+$'
     order by date_posted desc nulls last, last_seen_at desc
     limit 5`,
    [country.code],
  ).catch(() => []);
  const recent: JobListEntry[] = recentRows.map((row) => ({
    title: row.title,
    company: row.company,
    location: row.location,
    applyUrl: row.apply_url,
    datePosted: row.date_posted,
  }));
  const jobsLd = jobListLd(recent);

  return (
    <MarketingShell className="jobs-page growth-page growth-search">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: `${env.siteUrl}/` },
          { name: "Job Search", item: `${env.siteUrl}/jobs` },
          { name: country.name, item: canonical },
        ])}
      />
      {jobsLd && <JsonLd data={jobsLd} />}

      <div className="container jobs-country-shell">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Job Search", href: "/jobs" }, { label: country.name }]} />
      </div>

      <JobsFinder
        initialCountry={country.code}
        initialQuery={initialQuery}
        heroKicker={`Country search — ${country.name}`}
        heroTitle={`Find fresh jobs in ${country.name}`}
        heroSubtitle={`Search original postings in ${country.name}, filter by remote work or salary, and move straight into a tailored RoleSharp resume when a role fits.`}
      />

      

      <FaqSection heading={`Jobs in ${country.name} — common questions`} faqs={faqs} />
    </MarketingShell>
  );
}
