import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import JobsFinder from "@/app/jobs/jobs-finder";
import CountryPicker from "@/app/jobs/country-picker";
import JsonLd from "@/app/json-ld";
import { FaqSection } from "@/app/seo-blocks";
import { Container } from "@/components/ui/primitives/Container";
import { Eyebrow, MarketingShell } from "@/components/ui/primitives";
import { env } from "@/lib/env";
import { JOB_COUNTRIES } from "@/lib/job-config";

export const metadata: Metadata = {
  title: "Internship Finder by Country",
  description:
    "Find internships across 72 countries. Filter remote roles, search by company or skill, and tailor your resume to the original posting.",
  keywords: ["internship search", "find internships", "internship finder", "student internships", "remote internships", "internships near me", "summer internships"],
  alternates: { canonical: "/internships" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Find Fresh Internships by Country",
    description: "Search internship-only listings and tailor your resume to the exact opportunity.",
    url: "/internships",
  },
};

const FAQS: [string, string][] = [
  ["Where can I search for internships?", "RoleSharp searches internship listings across every market supported by the current jobs pipeline, including the US, UK, Canada, India, Germany, Singapore, Australia, Japan, and dozens more. Select a country, then narrow by role, skill, company, remote work, or salary."],
  ["Are these internships current?", "Yes. High-volume markets refresh through the day, other active markets refresh twice daily, and long-tail markets refresh daily. Listings expire after 30 days and every result links to the original employer or job-board posting."],
  ["Can I find remote internships?", "Yes. Turn on Remote only while the internship filter remains locked. You can combine it with a country and a role or skill query to find remote internships relevant to your target field."],
  ["Do I need experience to apply for an internship?", "Not necessarily. Internship recruiters often evaluate coursework, projects, skills, volunteering, clubs, certifications, and evidence that you can learn and contribute. Tailor those signals to the responsibilities and keywords in the actual internship description."],
  ["How do I tailor my resume to an internship?", "Open an internship and choose Tailor resume. RoleSharp sends the original description into the builder so your summary, project emphasis, skills, and bullets reflect that exact opportunity without inventing experience."],
  ["Is the internship finder free?", "A free RoleSharp account can search internship listings, open the original application, save opportunities, and move a posting into the resume builder."],
];

export default function InternshipsPage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: env.siteUrl },
      { "@type": "ListItem", position: 2, name: "Internship Finder", item: `${env.siteUrl}/internships` },
    ],
  };
  const appLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "RoleSharp Internship Finder",
    url: `${env.siteUrl}/internships`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Country-aware internship search with fresh listings, remote filtering, and one-click resume tailoring.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <MarketingShell className="jobs-page growth-page growth-search">
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={appLd} />

      <JobsFinder
        initialJobType="internship"
        lockJobType
        resultLabel="internships"
        heroKicker={`Internship listings — ${JOB_COUNTRIES.length} countries`}
        heroTitle="Find internships by country"
        heroSubtitle="Search internship-only listings, filter for remote opportunities, and tailor your resume to the exact posting when you find a fit."
      />

      <CountryPicker
        basePath="internships"
        resultLabel="internships"
        heroKicker={`Browse by market — ${JOB_COUNTRIES.length} countries`}
        heroTitle="Dedicated internship boards by country"
        heroSubtitle="Select a market to browse its dedicated internship feed."
      />

      <section className="border-y border-[var(--hairline)] bg-[var(--surface-2)] py-5">
        <Container size="large">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <Eyebrow>Student safety</Eyebrow>
              <h2 className="mt-1 text-lg font-bold text-[var(--fg)]">Something about an internship offer feels wrong?</h2>
              <p className="mt-1 text-sm text-[var(--muted-fg)]">
                Check moderated community reports or submit suspicious fees, fake letters, and data requests privately for review.
              </p>
            </div>
            <a
              href="/internship-reports"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white transition hover:opacity-95"
            >
              🛡 Open safety board →
            </a>
          </div>
        </Container>
      </section>

      <FaqSection
        visible
        heading="Internship search — common questions"
        faqs={FAQS}
      />
    </MarketingShell>
  );
}
