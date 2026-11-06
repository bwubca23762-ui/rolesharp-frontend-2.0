import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import JobsFinder from "./jobs-finder";
import CountryPicker from "./country-picker";
import JsonLd from "../json-ld";
import { FaqSection } from "../seo-blocks";
import { Container, MarketingShell } from "@/components/ui/primitives";
import { MethodologyCallout, RelatedWorkflow } from "@/components/marketing";
import { Globe } from "@/app/icons";
import { env } from "@/lib/env";
import { JOB_COUNTRIES } from "@/lib/job-config";

export const metadata: Metadata = {
  title: "Job Search — Find Fresh Jobs by Country, Free",
  description:
    "Member job search across every market Indeed serves. Fresh listings, salary filters, remote search, and one-click resume tailoring.",
  alternates: { canonical: "/jobs" },
  keywords: [
    "job search", "find jobs", "fresh jobs", "remote jobs",
    ...JOB_COUNTRIES.map((c) => `jobs in ${c.name}`),
  ],
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Job Search — Fresh Jobs by Country | RoleSharp",
    description:
      "Search fresh jobs by country, salary, remote status, and job type, then tailor your resume to the role.",
    url: "/jobs",
  },
};

const JOBS_FAQS: [string, string][] = [
  ["Which countries can I search jobs in?", "RoleSharp covers every market Indeed serves through the current JobSpy integration, from the US, UK, Canada, India, Germany, and Japan to dozens more across Europe, Asia, the Middle East, Africa, and Latin America."],
  ["How fresh are the job listings?", "Tier-1 markets refresh through the day, larger tier-2 markets refresh twice a day, and long-tail markets refresh daily. Listings expire after 30 days, so dead postings fall out automatically and every result still links to the original source."],
  ["Do I need an account to search jobs?", "Yes. Job search is members-only so saved jobs, tailored resumes, and application tracking stay tied to one account. The account itself is free: you only pay if you choose Premium features later."],
  ["Can I filter for remote jobs only?", "Yes. Tick the remote-only box and the results narrow to listings marked remote by the employer. You can combine it with a country, a job type like full-time or internship, and a role or company keyword."],
  ["What happens when I click Tailor resume?", "The job's real description is sent into the AI builder, which rewrites your resume for that exact posting — matching its keywords without inventing experience. You get an ATS score and an ATS-safe PDF before you apply."],
  ["Where do the listings come from?", "From the original job boards and career pages, with source attribution on every card. RoleSharp is a fresh search index, not a copy: we keep listings 30 days, always link back, and never rewrite the employer's posting."],
];

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: env.siteUrl },
    { "@type": "ListItem", position: 2, name: "Job Search", item: `${env.siteUrl}/jobs` },
  ],
};

const APP_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "RoleSharp Job Finder",
  url: `${env.siteUrl}/jobs`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Free country-aware job search with fresh listings, salary info, a remote filter, and one-click ATS resume tailoring.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function JobsPage() {
  return (
    <MarketingShell className="jobs-page growth-page growth-search">
      <JsonLd data={BREADCRUMB_LD} />
      <JsonLd data={APP_LD} />

      <JobsFinder
        resultLabel="jobs"
        heroKicker={`Fresh listings — ${JOB_COUNTRIES.length} countries`}
        heroTitle="Find jobs by country"
        heroSubtitle="Search recent listings by country, compare openings, and use the job description to tailor a resume."
      />

      <CountryPicker
        basePath="jobs"
        resultLabel="jobs"
        heroKicker={`Browse by market — ${JOB_COUNTRIES.length} countries`}
        heroTitle="Browse country job boards"
        heroSubtitle="Jump directly to any country's dedicated job index."
      />

      <section className="border-y border-[var(--hairline)] bg-[var(--surface)] py-4">
        <Container size="large">
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Globe size={21} className="mt-0.5 shrink-0 text-[var(--primary)]" />
              <p className="text-sm leading-relaxed text-[var(--muted-fg)]">
                <strong className="text-[var(--fg)]">Outside these {JOB_COUNTRIES.length} job-search markets?</strong>{" "}
                Resume building and country adaptation work across 209 countries and territories—paste any real job description directly into the builder.
              </p>
            </div>
            <a href="/resume-translator" className="shrink-0 text-sm font-bold text-[var(--primary)] hover:underline">
              Explore global support →
            </a>
          </div>
        </Container>
      </section>

      <section className="pb-4 md:pb-6">
        <Container size="small">
          <MethodologyCallout
            eyebrow="Listing source and freshness"
            title="Every result remains a lead to verify at the original source."
            description="RoleSharp indexes source-linked listings on market-specific refresh schedules. Employers can edit, close, or remove a role between refreshes, so the original posting controls availability and application instructions."
            points={[
              "Original source remains linked on each result",
              "Listings age out after 30 days",
              "Salary appears only when the source publishes it",
              "Remote and job-type labels follow source data",
            ]}
            href="/about#evidence-policy"
          />
        </Container>
      </section>

      <RelatedWorkflow
        title="Use the employer's real requirements in the next step."
        description="Open the original posting, confirm it is active, then carry its description into a grounded tailored-resume draft."
        href="/build"
        cta="Tailor a resume to the job"
        secondary={{ href: "/tracker", label: "Open the application tracker" }}
      />

      <FaqSection
        visible
        heading="Job search — common questions"
        faqs={JOBS_FAQS}
      />
    </MarketingShell>
  );
}
