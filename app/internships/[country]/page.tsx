import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JobsFinder from "@/app/jobs/jobs-finder";
import JsonLd from "@/app/json-ld";
import { FaqSection } from "@/app/seo-blocks";
import { env } from "@/lib/env";
import {
  countryShortName,
  getCountryBySlug,
  refreshLabelForTier,
} from "@/lib/job-config";
import { breadcrumbLd } from "@/lib/seo";
import { jobMarketSeoMetadata } from "@/lib/seo-metadata";
import { jobMarketIndexability } from "@/lib/job-market-indexability";
import { MarketingShell, Breadcrumb } from "@/components/ui/primitives";

type Params = { params: Promise<{ country: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { country: slug } = await params;
  const country = getCountryBySlug(slug);
  if (!country) return {};

  const short = countryShortName(country);
  const { title, description } = jobMarketSeoMetadata("Internships", country.name, short);
  const indexable = await jobMarketIndexability(country.code, "internships");
  return {
    title: { absolute: title },
    description,
    keywords: [`internships in ${short}`, `student internships in ${short}`, `remote internships in ${short}`, `${short} internships`, `summer internships in ${short}`],
    alternates: { canonical: `/internships/${country.slug}` },
    robots: indexable === false ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title, description, url: `/internships/${country.slug}`, type: "website", images: ["/opengraph-image"] },
  };
}

export default async function CountryInternshipsPage({ params }: Params) {
  const { country: slug } = await params;
  const country = getCountryBySlug(slug);
  if (!country) notFound();

  const canonical = `${env.siteUrl}/internships/${country.slug}`;
  const faqs: [string, string][] = [
    [`How fresh are internships in ${country.name}?`, `${refreshLabelForTier(country.tier)} in ${country.name}. Expired listings fall out after 30 days, and every result links to the original posting.`],
    [`Can I find remote internships in ${country.name}?`, `Yes. The page is locked to internships, and Remote only narrows the results to opportunities marked remote by the original source.`],
    [`What should a ${country.name} internship resume include?`, `Use the exact internship description, then prioritize relevant education, projects, skills, volunteering, and measurable outcomes. Keep every claim truthful and follow the resume conventions expected in ${country.name}.`],
    [`Can international students use this page?`, `Yes. Search the market you are targeting and check each original posting for work authorization, visa, location, and eligibility requirements. RoleSharp does not infer or guarantee employer sponsorship.`],
  ];

  return (
    <MarketingShell className="jobs-page growth-page growth-search">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: env.siteUrl },
          { name: "Internships", item: `${env.siteUrl}/internships` },
          { name: country.name, item: canonical },
        ])}
      />

      <div className="container jobs-country-shell">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Internships", href: "/internships" }, { label: country.name }]} />
      </div>

      <JobsFinder
        initialCountry={country.code}
        initialJobType="internship"
        lockJobType
        resultLabel="internships"
        heroKicker={`Internship search — ${country.name}`}
        heroTitle={`Find fresh internships in ${country.name}`}
        heroSubtitle={`Search internship-only postings in ${country.name}, filter remote opportunities, and tailor your resume when a role fits.`}
      />

      

      <FaqSection heading={`Internships in ${country.name} — common questions`} faqs={faqs} />
    </MarketingShell>
  );
}
