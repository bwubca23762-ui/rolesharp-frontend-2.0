import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { notFound } from "next/navigation";
import { getRoleBySlug, listSeoCompanies } from "@/lib/db";
import { allCuratedRoleSlugs, hasIndexableRoleEvidence, isPairAllowed } from "@/lib/seo-roles";
import { env } from "@/lib/env";
import { Container, Section, Card, Button, Eyebrow, MarketingShell, Breadcrumb } from "@/components/ui/primitives";
import { Check } from "@/app/icons";
import { roleHubMetadata } from "@/lib/seo-metadata";
import { DirectoryEvidenceNote, DirectoryMethodCard, RelatedWorkflow } from "@/components/marketing";

type Params = { params: Promise<{ role: string }> };

function titleCase(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Order matters: finance/accounting before sales — "accountants" contains
// "account" and used to get CRM/quota skills.
function fallbackSkills(role: string): string[] {
  const r = role.toLowerCase();
  if (/(accountant|auditor|financ|actuar|underwrit|tax|treasur|bookkeep)/.test(r))
    return ["Financial reporting", "GAAP/IFRS compliance", "Account reconciliation", "Budgeting & forecasting", "Excel & ERP systems"];
  if (/(nurse|physician|pharmac|medical|health|clinic|therap)/.test(r))
    return ["Patient care & safety", "Clinical documentation", "Regulatory compliance (HIPAA)", "Electronic health records", "Care coordination"];
  if (/(engineer|developer|software|backend|frontend)/.test(r))
    return ["System design", "Data structures & algorithms", "Code review & testing", "CI/CD", "Production debugging"];
  if (/(data|scientist|analyst|ml|machine)/.test(r))
    return ["SQL", "Python", "Statistical analysis", "Data visualization", "A/B testing"];
  if (/(product|pm|project)/.test(r))
    return ["Product roadmapping", "User research", "Metrics & KPIs", "Prioritization", "Go-to-market"];
  if (/(design|ux|ui)/.test(r))
    return ["User research", "Wireframing & prototyping", "Design systems", "Usability testing", "Figma"];
  if (/(market|growth|content|seo|public relations|advertis)/.test(r))
    return ["Campaign strategy", "Analytics", "Content creation", "SEO/SEM", "Conversion optimization"];
  if (/(human resources|recruit|talent|training)/.test(r))
    return ["Talent acquisition", "Employee relations", "HRIS systems", "Onboarding & training", "Compensation & benefits"];
  if (/(logisti|supply chain|warehouse|transport|dispatch)/.test(r))
    return ["Supply-chain planning", "Inventory management", "Vendor negotiation", "WMS/TMS systems", "KPI reporting"];
  if (/(sales|business development|customer)/.test(r))
    return ["Pipeline management", "Negotiation", "CRM (Salesforce)", "Quota attainment", "Forecasting"];
  if (/(manager|director|operations|supervisor)/.test(r))
    return ["Team leadership", "Budget ownership", "Process improvement", "Performance management", "Strategic planning"];
  return ["Role-specific technical skills", "Quantified achievements", "Industry certifications", "Process & tooling fluency", "Stakeholder communication"];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { role } = await params;
  const row = await getRoleBySlug(role).catch(() => null);
  const formalTitle = row?.title ?? titleCase(role);
  const seo = roleHubMetadata(formalTitle, row?.seo_title);
  // Only curated roles with maintained skills and example patterns participate
  // in the indexable surface; weaker role rows stay reachable but noindex.
  const curated = allCuratedRoleSlugs().includes(role) && hasIndexableRoleEvidence(row);
  return {
    title: { absolute: seo.title },
    description: seo.description,
    keywords: [`${formalTitle} resume`, `${formalTitle} resume template`, `${formalTitle} resume example`, `${formalTitle} resume skills`, `ats ${formalTitle} resume`],
    robots: curated ? { index: true, follow: true } : { index: false, follow: true },
    alternates: { canonical: `/roles/${role}` },
    openGraph: { title: seo.title, description: seo.description, type: "website", url: `/roles/${role}`, images: ["/opengraph-image"] },
  };
}

export default async function RoleHub({ params }: Params) {
  const { role } = await params;
  const r = await getRoleBySlug(role).catch(() => null);
  if (!r) notFound();
  const title: string = r.title ?? titleCase(role);
  const sector: string | null = r.sector ?? null;
  const databaseSkills: string[] = Array.isArray(r.required_skills) ? r.required_skills.filter(Boolean) : [];
  const hasDatabaseSkills = databaseSkills.length > 0;
  const skills: string[] = hasDatabaseSkills ? databaseSkills : fallbackSkills(title);
  // Link only companies whose sector supports this role — every link must be a
  // live, indexable resume page.
  const companies = (await listSeoCompanies(300).catch(() => [])).filter((c) => isPairAllowed(c.sector, role)).slice(0, 60);

  // Cross-surface bridges, gated on existence: the interview bank 404s below
  // 4 questions and salary pages are prebuilt only for sample-strong markets,
  // so bare links would be dead ends for most roles.
  const [bankEligible, salaryCandidate] = await Promise.all([
    import("@/lib/interview-bank").then((m) =>
      m.bankEligibleRoles(200).then((list) => list.some((r) => r.slug === role)),
    ).catch(() => false),
    import("@/lib/salary-pages").then((m) =>
      m.candidatesPromise(150).then((list) => list.find((s) => s.roleSlug === role) ?? null),
    ).catch(() => null),
  ]);

  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: env.siteUrl },
      { "@type": "ListItem", position: 2, name: "Roles", item: `${env.siteUrl}/roles` },
      { "@type": "ListItem", position: 3, name: `${title} resume`, item: `${env.siteUrl}/roles/${role}` },
    ],
  };

  return (
    <MarketingShell className="reading-shell">
      <JsonLd data={ld} />
      <section className="reading-masthead">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Roles", href: "/roles" }, { label: `${title} resume` }]} />
          <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
            <div>
              <Eyebrow>Role guide</Eyebrow>
              <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-6 max-w-3xl">
                {title} Resume
              </h1>
              <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-6">
                Review general structure and skill guidance for a <strong className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{title} resume</strong>{sector ? ` in ${sector}` : ""}. To tailor it, paste a real job description and compare its published requirements with evidence from your own experience.
              </p>
              <DirectoryEvidenceNote
                kind="guidance"
                detail="This role guide is orientation, not a universal hiring checklist. The live job posting remains the source of truth."
                className="mb-8"
              />
              <div className="flex flex-wrap gap-4">
                <Button as="a" href={`/build#role=${role}`} size="lg">Build my {title} resume free</Button>
                <Button as="a" href="/checker" variant="outline" size="lg">Check existing resume</Button>
              </div>
              {(bankEligible || salaryCandidate) && (
                <p className="mt-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  Also for {title}s:{" "}
                  {bankEligible && (
                    <a href={`/interview-questions/${role}`} className="font-semibold text-[var(--color-primary)] hover:underline">
                      interview questions with answer guidance
                    </a>
                  )}
                  {bankEligible && salaryCandidate && " · "}
                  {salaryCandidate && (
                    <a href={`/salaries/${role}/${salaryCandidate.countryCode.toLowerCase()}`} className="font-semibold text-[var(--color-primary)] hover:underline">
                      real salary data from live postings
                    </a>
                  )}
                </p>
              )}
            </div>
            <Card variant="elevated" padding="md">
              <span className="block font-[family-name:var(--font-mono)] text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-3">
                Snapshot
              </span>
              <h2 className="text-lg font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">Skill prompts for {title}</h2>
              <DirectoryEvidenceNote
                kind={hasDatabaseSkills ? "database" : "guidance"}
                detail={hasDatabaseSkills
                  ? "These skills come from the maintained role record; verify relevance against the target posting."
                  : "No maintained skill list was available, so these are deterministic role-themed fallback prompts."}
                className="mb-4"
              />
              <ul className="space-y-2.5">
                {skills.map((s) => (
                  <li key={s} className="flex items-start gap-3 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                    <Check size={16} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="reveal-on-scroll">
            <Eyebrow>By company</Eyebrow>
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">{title} resume guides by company</h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-3 max-w-2xl">
              Choose a sector-plausible company guide for additional context, then tailor only after checking a current {title} job description from that employer.
            </p>
            <DirectoryEvidenceNote
              kind="curated"
              detail="Company links are filtered by role-sector plausibility. They do not confirm an open vacancy or reveal employer-specific screening criteria."
              className="mb-6"
            />
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
              {companies.map((c) => (
                <li key={c.slug}>
                  <a
                    href={`/resume/${c.slug}/${role}`}
                    className="lift block h-full rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] p-4 text-sm font-medium text-[var(--color-text)] dark:text-[var(--color-dark-text)] shadow-[var(--shadow-sm)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] transition-colors"
                  >
                    {title} resume for {c.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <DirectoryMethodCard
            className="mt-10 reveal-on-scroll"
            title={`Evidence boundaries for ${title} guidance`}
            description="This page combines a maintained role record with curated directory logic and, when needed, deterministic fallback prompts. None of those sources replaces a real posting or personal evidence."
            items={[
              { kind: "database", detail: "The role title, sector, and any maintained skill array come from the catalog record." },
              { kind: "curated", detail: "Indexing and company links are limited by the maintained role taxonomy and sector-plausibility rules." },
              { kind: "guidance", detail: "Fallback skills and structural advice are general prompts, not a universal employer checklist." },
              { kind: "illustrative", detail: "Do not copy example achievements as facts; replace them with truthful, supportable evidence from your own work." },
            ]}
          />

          <div className="mt-12 reveal-on-scroll">
            <Card variant="dark" padding="lg" className="relative overflow-hidden text-center">
              <div className="relative z-10">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Ready to build your {title} resume?</h2>
                <Button as="a" href={`/build#role=${role}`} variant="primaryInverse" size="lg">
                  Build my {title} resume free
                </Button>
              </div>
            </Card>
          </div>
        </Container>
      </Section>

      <RelatedWorkflow
        eyebrow="Tailor with evidence"
        title="Move from general role guidance to one verified job description."
        description="Paste a current posting, compare its published requirements with your own evidence, and keep only claims you can support."
        href={`/build#role=${role}`}
        cta="Tailor this role"
        secondary={{ href: "/jobs", label: "Find current jobs" }}
      />
    </MarketingShell>
  );
}
