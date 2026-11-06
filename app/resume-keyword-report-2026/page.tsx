import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { Container, Section, MarketingShell } from "@/components/ui/primitives";
import ToolSeo from "@/app/tool-seo";
import { env } from "@/lib/env";
import { allCuratedRoleSlugs, UNIVERSAL_ROLE_SLUGS } from "@/lib/seo-roles";

export const metadata: Metadata = {
  title: "2026 Resume Keywords by Role: Taxonomy Report",
  description: "Explore resume skills across RoleSharp's curated role taxonomy, with transparent role-family counts, sector context, and methodology.",
  keywords: ["resume keywords 2026", "top resume skills", "ats keywords", "in-demand skills", "resume keyword research"],
  robots: { index: true, follow: true },
  alternates: { canonical: "/resume-keyword-report-2026" },
  openGraph: {
    title: "2026 Resume Keyword Report — Skills by Role",
    description: "A transparent analysis of resume skills across RoleSharp's curated role taxonomy, with role-family counts and methodology.",
    type: "article",
    url: "/resume-keyword-report-2026",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "2026 Resume Keyword Report — Skills by Role",
    description: "A transparent role-taxonomy analysis of resume skills, with methodology and sector context.",
    images: ["/opengraph-image"],
  },
};

// Curated taxonomy analysis. Counts represent distinct role families in the
// maintained RoleSharp taxonomy, not job-posting frequency or company weight.
const TOP_SKILLS = [
  { skill: "Data Analysis & Visualization", count: 4, sectors: ["Tech", "Finance", "Data Science"] },
  { skill: "Project Management", count: 4, sectors: ["Operations", "Consulting", "Tech"] },
  { skill: "Team Leadership", count: 3, sectors: ["Management", "Operations", "Consulting"] },
  { skill: "Financial Reporting & Analysis", count: 3, sectors: ["Finance", "Accounting"] },
  { skill: "System Design & Development", count: 3, sectors: ["Tech", "Engineering"] },
  { skill: "CRM & Sales Pipeline Management", count: 2, sectors: ["Sales", "Business Development"] },
  { skill: "Regulatory Compliance", count: 2, sectors: ["Finance", "Healthcare", "HR"] },
  { skill: "Supply Chain & Logistics", count: 2, sectors: ["Operations", "Industrial", "Transport"] },
  { skill: "User Research & Design", count: 2, sectors: ["Tech", "Product", "Design"] },
  { skill: "Budget & Forecasting", count: 2, sectors: ["Finance", "Management"] },
  { skill: "Stakeholder Management", count: 2, sectors: ["Product", "Consulting", "Management"] },
  { skill: "SQL & Python", count: 2, sectors: ["Tech", "Data Science"] },
  { skill: "Content Creation & Strategy", count: 1, sectors: ["Marketing", "Media"] },
  { skill: "Inventory Management", count: 1, sectors: ["Retail", "Operations"] },
  { skill: "Clinical Documentation", count: 1, sectors: ["Healthcare"] },
  { skill: "HRIS & HR Systems", count: 1, sectors: ["Human Resources"] },
  { skill: "Route Optimization", count: 1, sectors: ["Logistics", "Transport"] },
  { skill: "Vendor Negotiation", count: 1, sectors: ["Supply Chain", "Operations"] },
  { skill: "Conversion Optimization", count: 1, sectors: ["Marketing", "Growth"] },
  { skill: "Civil & Construction Engineering", count: 1, sectors: ["Construction", "Engineering"] },
];

const SECTOR_BREAKDOWN = [
  { sector: "Technology & IT", roles: 8, focus: "Software, data, systems, security" },
  { sector: "Finance & Banking", roles: 9, focus: "Analysis, accounting, risk, compliance" },
  { sector: "Healthcare & Pharma", roles: 5, focus: "Clinical work, pharmacy, health operations" },
  { sector: "Industrial & Manufacturing", roles: 8, focus: "Engineering, production, quality, logistics" },
  { sector: "Energy & Utilities", roles: 7, focus: "Engineering, operations, environment, power" },
  { sector: "Retail & E-commerce", roles: 5, focus: "Sales, purchasing, supply chain, service" },
  { sector: "Media & Entertainment", roles: 7, focus: "Content, design, communications, research" },
  { sector: "Consulting & Professional Services", roles: 3, focus: "Analysis, law, operations research" },
];

const UNIVERSAL_ROLES = [
  "Software Engineer", "Accountant", "Data Analyst", "Sales Executive",
  "Human Resources Specialist", "Marketing Manager", "Customer Service Representative",
  "Financial Analyst", "Project Management Specialist", "Operations Manager"
];

export default function KeywordReportPage() {
  const base = env.siteUrl;
  const allRoles = allCuratedRoleSlugs();
  const roleCount = allRoles.length;

  const datasetLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "The 2026 Resume Keyword Report",
    description: "An unweighted analysis of skills represented across RoleSharp's curated role taxonomy, with sector groupings and a published methodology.",
    url: `${base}/resume-keyword-report-2026`,
    creator: { "@id": `${base}/#org` },
    datePublished: "2026-07-18",
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    measurementTechnique: "Unweighted count of distinct curated role families in which a skill is represented; not job-posting frequency or company-weighted demand.",
    variableMeasured: ["Skill", "Distinct curated role-family count", "Representative sector group"],
  };

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "The 2026 Resume Keyword Report",
    datePublished: "2026-07-18",
    author: { "@id": `${base}/#org` },
    publisher: { "@id": `${base}/#org` },
    mainEntityOfPage: `${base}/resume-keyword-report-2026`,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "2026 Resume Keyword Report", item: `${base}/resume-keyword-report-2026` },
    ],
  };

  return (
    <>
      <JsonLd data={datasetLd} />
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />

      <MarketingShell className="reading-shell">
        <Section asContainer={false} size="sm">
        <Container className="max-w-5xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            The 2026 Resume Keyword Report: Skills by Role
          </h1>
          <p className="text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-8 leading-relaxed">
            A transparent view of the skills represented across {roleCount} curated role guides, with employer-directory and market context. Counts show role-family coverage, not job-posting frequency.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] p-6 text-center">
              <div className="text-4xl font-bold text-[var(--color-primary)] mb-1">100,000+</div>
              <div className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Employer Records for Context</div>
            </div>
            <div className="bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] p-6 text-center">
              <div className="text-4xl font-bold text-[var(--color-primary)] mb-1">{roleCount}</div>
              <div className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Curated Roles</div>
            </div>
            <div className="bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] p-6 text-center">
              <div className="text-4xl font-bold text-[var(--color-primary)] mb-1">190+</div>
              <div className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Countries</div>
            </div>
            <div className="bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] p-6 text-center">
              <div className="text-4xl font-bold text-[var(--color-primary)] mb-1">16</div>
              <div className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Industry Sectors</div>
            </div>
          </div>

          <div className="prose reading-measure mb-12">
            <h2>20 Skills Across the Curated Role Taxonomy</h2>
            <p>
              These skills appear most frequently across role definitions in RoleSharp's dataset of {roleCount} curated roles. Count = number of distinct role families where this skill is considered core.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-[var(--color-border)]">
                    <th className="text-left py-3 px-4 font-bold">Skill / Keyword</th>
                    <th className="text-left py-3 px-4 font-bold">Role Families</th>
                    <th className="text-left py-3 px-4 font-bold">Common Sectors</th>
                  </tr>
                </thead>
                <tbody>
                  {TOP_SKILLS.map((s, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]">
                      <td className="py-3 px-4 font-medium">{s.skill}</td>
                      <td className="py-3 px-4 text-[var(--color-text-muted)]">{s.count}</td>
                      <td className="py-3 px-4 text-sm text-[var(--color-text-muted)]">{s.sectors.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2>Universal Roles — Hired by Nearly Every Company</h2>
            <p>
              These {UNIVERSAL_ROLE_SLUGS.length} roles appear in RoleSharp's universal core — nearly every large employer (tech, finance, retail, healthcare, industrial) hires for them. If your resume targets one of these roles, competition is high but openings are plentiful.
            </p>
            <ul>
              {UNIVERSAL_ROLES.map(r => <li key={r}>{r}</li>)}
            </ul>

            <h2>Keyword Density by Industry Sector</h2>
            <p>
              Different industries prioritize different skills. This breakdown shows role counts and estimated company coverage per sector in RoleSharp's database.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-[var(--color-border)]">
                    <th className="text-left py-3 px-4 font-bold">Sector</th>
                    <th className="text-left py-3 px-4 font-bold">Specialized Roles</th>
                    <th className="text-left py-3 px-4 font-bold">Representative Keyword Focus</th>
                  </tr>
                </thead>
                <tbody>
                  {SECTOR_BREAKDOWN.map((s, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]">
                      <td className="py-3 px-4 font-medium">{s.sector}</td>
                      <td className="py-3 px-4 text-[var(--color-text-muted)]">{s.roles}</td>
                      <td className="py-3 px-4 text-[var(--color-text-muted)]">{s.focus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2>Methodology</h2>
            <p>
              This report aggregates data from RoleSharp's company and role database, which covers:
            </p>
            <ul>
              <li><strong>100,000+ employer records</strong> provide directory and sector context; they do not weight the skill counts shown above</li>
              <li><strong>{roleCount} curated roles</strong> mapped to O*NET occupational data and enhanced with skills arrays and typical achievement bullet points</li>
              <li><strong>16 industry sectors</strong> with deterministic role-matching rules (technology, finance, healthcare, industrial, energy, retail, hospitality, construction, materials, media, transport, aviation, education, consulting, agriculture, plus a default set)</li>
            </ul>
            <p>
              Skill frequency counts reflect how many distinct role families list a skill as core (not weighted by company count or job-posting volume). Data current as of <strong>July 2026</strong>.
            </p>

            <h2>How to Use This Report</h2>
            <p>When tailoring your resume:</p>
            <ol>
              <li><strong>Match the role family first</strong> — if you're applying for a Data Analyst position, prioritize "SQL," "Python," "Statistical analysis," and "Data visualization" over generic skills.</li>
              <li><strong>Check the sector</strong> — a Data Analyst resume for a finance company should emphasize "Financial reporting" and "Regulatory compliance"; the same role at a tech company wants "A/B testing" and "Product metrics."</li>
              <li><strong>Use exact phrasing</strong> — ATS systems scan for the literal strings in job descriptions. "Project management" and "Project coordination" are not the same to a keyword scanner.</li>
              <li><strong>Quantify with the skill</strong> — don't just list "Budget & Forecasting" — write "Managed $2.4M annual budget and delivered quarterly forecasts within 3% accuracy."</li>
            </ol>
            <p>
              For company-specific keyword recommendations, use <a href={`${base}/checker`}>RoleSharp's free ATS checker</a> — it matches your resume against the exact company and role you're targeting.
            </p>

            <h2>Cite This Study</h2>
            <p>
              Journalists, bloggers, and researchers are welcome to cite this report. Suggested citation:
            </p>
            <blockquote className="bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] border-l-4 border-[var(--color-primary)] pl-4 py-2 my-4">
              RoleSharp (2026). <em>The 2026 Resume Keyword Report: Skills Across a Curated Role Taxonomy</em>. Retrieved from https://rolesharp.com/resume-keyword-report-2026
            </blockquote>
            <p>
              Data is licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Attribution required.
            </p>
          </div>

          <div className="bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-surface)] dark:from-[var(--color-dark-surface-2)] dark:to-[var(--color-dark-surface)] rounded-[var(--radius-lg)] border border-[var(--color-primary)]/20 p-8 text-center">
            <h3 className="text-2xl font-bold mb-3 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              Get Your Resume Score
            </h3>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-6">
              See how your resume scores on these keywords for the exact company and role you're targeting.
            </p>
            <a
              href={`${base}/checker`}
              className="inline-flex items-center justify-center gap-2 font-semibold border transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] active:translate-y-px bg-[var(--color-primary)] text-white border-transparent hover:bg-[var(--color-primary-hover)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow)] px-7 py-3.5 text-base min-h-[52px] rounded-xl font-semibold"
            >
              Check Your Resume — Free
            </a>
          </div>
        </Container>
        </Section>

        <ToolSeo path="/resume-keyword-report-2026" name="2026 Resume Keyword Report" description="Transparent resume-skill analysis across RoleSharp's curated role taxonomy" />
      </MarketingShell>
    </>
  );
}
