import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import { listSeoCompanies } from "@/lib/db";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { Container, Section, MarketingShell, Breadcrumb } from "@/components/ui/primitives";
import { DirectoryMethodCard, RelatedWorkflow } from "@/components/marketing";
import CompaniesPage from "./CompaniesPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Company Resume Guides for Top Employers (2026)",
  description: "Browse free, ATS-optimized resume guides for employers worldwide. Pick any company and build a resume that matches its exact job description.",
  alternates: { canonical: "/companies" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Global Company Resume Guides — ATS Resumes for Top Employers",
    description: "Browse company-specific resume guides and tailor your resume to the employer you actually want.",
    url: "/companies",
  },
};

export default async function CompaniesIndex() {
  // Keep the public directory usable during a brief database outage; search
  // and company detail requests can recover as soon as the database returns.
  const companies = await listSeoCompanies().catch(() => []);
  return (
    <MarketingShell className="reading-shell">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: "/" },
          { name: "Companies", item: "/companies" },
        ])}
      />
      <section className="reading-masthead">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Companies" }]} />
          <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-6 max-w-3xl">
            Resume guides for companies worldwide
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-8">
            Find a company guide, then use the employer&apos;s real job posting as the source for requirements and phrasing. Directory entries organize RoleSharp&apos;s catalog; they do not claim access to private hiring criteria.
          </p>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          <h2 className="mb-4 text-2xl font-bold text-[var(--fg)]">Top global employers</h2>
          <CompaniesPage companies={companies} />
          <nav aria-label="Resume tools" className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
            <a href="/resume-builder" className="reading-text-link">Build a company-tailored resume</a>
            <a href="/checker" className="reading-text-link">Check an existing resume</a>
          </nav>
        </Container>
      </Section>

      <Section asContainer={false} size="sm" alt>
        <Container>
          <DirectoryMethodCard
            title="Company names come from the catalog; job requirements come from the posting."
            description="RoleSharp can organize public company context and builder routes, but a directory entry is not evidence of a private hiring bar, recruiter preference, or current vacancy."
            items={[
              { kind: "database", detail: "Company names and country context reflect the current RoleSharp database." },
              { kind: "curated", detail: "Directory grouping and featured ordering are catalog choices, not employer rankings." },
              { kind: "guidance", detail: "Company-specific language must be checked against the employer's live posting." },
              { kind: "illustrative", detail: "Any generated bullet or skill example must be replaced with supportable candidate evidence." },
            ]}
          />
        </Container>
      </Section>

      <RelatedWorkflow
        eyebrow="Use a real source"
        title="Carry the employer and its actual job description into the builder."
        description="The posting—not the company directory—sets the factual requirements for a tailored resume."
        href="/build"
        cta="Tailor to a real posting"
        secondary={{ href: "/jobs", label: "Find current jobs" }}
      />
    </MarketingShell>
  );
}
