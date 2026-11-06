import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { notFound } from "next/navigation";
import { getCompanyBySlug, isSeoCompanySlug, listSeoCompaniesByCountry, rolesForCompanySector, q } from "@/lib/db";
import { env } from "@/lib/env";
import { getDevCompanyBySlug, listDevRoles } from "@/lib/local-dev-store";
import { Container, Section, Card, Button, Badge, Eyebrow, MarketingShell, Breadcrumb } from "@/components/ui/primitives";
import { seoCountryName } from "@/lib/country-display";
import { flagEmoji } from "@/lib/country-codes";
import { companyHubMetadata, countryCompanyDirectoryMetadata } from "@/lib/seo-metadata";
import { DirectoryEvidenceNote, DirectoryMethodCard, RelatedWorkflow } from "@/components/marketing";

type Params = { params: Promise<{ company: string }> };

// Local-dev parity: the landing marquee and company finder link the dev-seed
// catalog (lib/dev-store.ts), so the detail page must read from the same
// store in local mode — otherwise every one of those links 404s.
const lookupCompany = (slug: string) =>
  env.localDevMode
    ? getDevCompanyBySlug(slug).catch(() => null)
    : getCompanyBySlug(slug).catch(() => null);

const rolesForSector = (sector: string | null | undefined) =>
  env.localDevMode
    ? listDevRoles(60).then((roles) => roles.filter((role) => !sector || role.sector === sector)).catch(() => [])
    : rolesForCompanySector(sector).catch(() => []);

// Company guides are static reference content — they change when the catalog
// row changes, which is rare. ISR (1h) keeps the first-request render out of
// every subsequent request's path instead of re-querying per visit.
export const revalidate = 3600;

function titleCase(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const MARKET_LINKS = [
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "in", name: "India" },
  { code: "de", name: "Germany" },
  { code: "sg", name: "Singapore" },
  { code: "ae", name: "UAE" },
];

function articleFor(value: string) {
  return /^[aeiou]/i.test(value) ? "an" : "a";
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { company } = await params;
  // 2-letter country code → country listing page
  if (company.length === 2 && /^[a-z]{2}$/i.test(company)) {
    const code = company.toUpperCase();
    const [row, companies] = await Promise.all([
      q<{ name: string }>("select name from countries where code=$1", [code]).catch(() => []),
      listSeoCompaniesByCountry(code).catch(() => []),
    ]);
    const country = row[0];
    if (!country || companies.length === 0) return { robots: { index: false, follow: true } };
    const seo = countryCompanyDirectoryMetadata(country.name, companies.length);
    return {
      title: { absolute: seo.title },
      description: seo.description,
      alternates: { canonical: `/companies/${company}` },
      openGraph: { title: seo.title, description: seo.description, type: "website", url: `/companies/${company}`, images: ["/opengraph-image"] },
    };
  }
  const row = await lookupCompany(company);
  if (!row) return { robots: { index: false, follow: true } };
  const indexable = env.localDevMode || await isSeoCompanySlug(company).catch(() => false);
  const name = row?.name ?? titleCase(company);
  const seo = companyHubMetadata({
    company: name,
    country: seoCountryName(row?.country_code),
  });
  const { title, description } = seo;
  return {
    title: { absolute: title },
    description,
    keywords: [`${name} resume`, `${name} resume template`, `how to get a job at ${name}`, `${name} ats resume`, `${name} careers resume`],
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    alternates: { canonical: `/companies/${company}` },
    openGraph: { title, description, type: "website", url: `/companies/${company}`, images: ["/opengraph-image"] },
  };
}

export default async function CompanyHub({ params }: Params) {
  const { company } = await params;

  // 2-letter country code → country listing with company grid
  if (company.length === 2 && /^[a-z]{2}$/i.test(company)) {
    const code = company.toUpperCase();
    const [country, companies] = await Promise.all([
      q<{ name: string }>("select name from countries where code=$1", [code]).then((r) => r[0] ?? null).catch(() => null),
      listSeoCompaniesByCountry(code).catch(() => []),
    ]);
    if (!country || companies.length === 0) notFound();
    const flag = flagEmoji(code);
    return (
      <MarketingShell className="reading-shell">
        <section className="reading-masthead">
          <Container className="relative z-10 py-16 md:py-24">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Companies", href: "/companies" }, { label: `${flag} ${country.name}` }]} />
            <Eyebrow>Company guides — {country.name}</Eyebrow>
            <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-6 max-w-3xl">
              {flag} {country.name} company resume guides
            </h1>
            <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-6">
              Browse {companies.length} employer records associated with {country.name}. Choose a company and role, then use the employer&apos;s current job posting as the source of truth for requirements, terminology, and application instructions.
            </p>
            <DirectoryEvidenceNote
              kind="database"
              detail="Company availability comes from RoleSharp's catalog. Inclusion is not an employer ranking, endorsement, or claim about current hiring volume."
            />
          </Container>
        </section>

        <Section asContainer={false} size="sm">
          <Container>
            <Card variant="outline" padding="md" className="mb-8 reveal-on-scroll">
              <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">Browse other markets</h2>
              <div className="flex flex-wrap gap-2">
                {MARKET_LINKS.filter((m) => m.code !== company.toLowerCase()).map((m) => (
                  <Badge key={m.code} variant="outline" className="cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors">
                    <a href={`/companies/${m.code}`} className="text-[var(--color-text)] dark:text-[var(--color-dark-text)] hover:text-[var(--color-primary)]">{m.name}</a>
                  </Badge>
                ))}
              </div>
            </Card>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {companies.map((c) => (
                <a key={c.slug} href={`/companies/${c.slug}`} className="group block h-full">
                  <div className="lift h-full rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] p-5 shadow-[var(--shadow-sm)] hover:border-[var(--color-primary)]/40">
                    <strong className="block font-display text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-1 group-hover:text-[var(--color-primary)] transition-colors">{c.name}</strong>
                    <span className="text-xs text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)]">
                      {(c.sector || "")}{c.tier === "A" ? " — Tier A" : ""}
                    </span>
                  </div>
                </a>
              ))}
            </div>

            <DirectoryMethodCard
              className="mt-10 reveal-on-scroll"
              title={`How to use the ${country.name} company directory`}
              description="This route helps narrow the catalog by country. It does not infer private employer criteria or replace the live posting you plan to answer."
              items={[
                { kind: "database", detail: "Company, country, sector, and catalog-tier values come from maintained database records." },
                { kind: "curated", detail: "Ordering and tier labels organize RoleSharp's catalog; they are not employer quality or hiring rankings." },
                { kind: "guidance", detail: "Country context is general orientation. Verify local application rules and employer instructions before submitting." },
                { kind: "illustrative", detail: "Any later bullet or skill example is a prompt for supported evidence, never a customer result or fact to copy." },
              ]}
            />
          </Container>
        </Section>

        <RelatedWorkflow
          eyebrow="Continue with verified context"
          title="Choose an employer, then tailor against one current job posting."
          description="Use the jobs directory or an employer's official careers page to find the live source before drafting job-specific language."
          href="/jobs"
          cta="Find current jobs"
          secondary={{ href: "/build", label: "Open the builder" }}
        />
      </MarketingShell>
    );
  }

  const c = await lookupCompany(company);
  if (!c) notFound();
  const name: string = c.name ?? titleCase(company);
  const ctry = seoCountryName(c.country_code);
  const sector: string | null = c.sector ?? null;
  // Only the sector-plausible roles — these are the resume pages that exist.
  const roles = await rolesForSector(c.sector);

  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: env.siteUrl },
      { "@type": "ListItem", position: 2, name: "Companies", item: `${env.siteUrl}/companies` },
      { "@type": "ListItem", position: 3, name, item: `${env.siteUrl}/companies/${company}` },
    ],
  };

  return (
    <MarketingShell className="reading-shell">
      <JsonLd data={ld} />
      <section className="reading-masthead">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Companies", href: "/companies" }, { label: name }]} />
          <Eyebrow>Company guide</Eyebrow>
          <div className="flex items-center gap-4 mb-6">
            <div
              aria-hidden
              className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] font-display text-lg font-bold text-[var(--color-primary)]"
            >
              {name.slice(0, 2).toUpperCase()}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[var(--color-text)] dark:text-[var(--color-dark-text)] max-w-3xl">
              {name} Resume Guides
            </h1>
          </div>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-6">
            Explore resume guidance for roles associated with <strong className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{name}</strong>
            {ctry ? ` in ${ctry}` : ""}{sector ? `, ${articleFor(sector)} ${sector} employer` : ""}. Select a plausible role below, then paste a current {name} job description so your edits stay grounded in published requirements rather than assumed hiring criteria.
          </p>
          <DirectoryEvidenceNote
            kind="database"
            detail="The company, country, sector, and available role links come from maintained catalog records. RoleSharp does not claim access to private screening rules."
            className="mb-8"
          />
          <div className="flex flex-wrap gap-4">
            <Button as="a" href={`/build#company=${company}`} size="lg">Build my {name} resume free</Button>
            <Button as="a" href="/checker" variant="outline" size="lg">Check existing resume</Button>
          </div>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="reveal-on-scroll">
            <Eyebrow>By role</Eyebrow>
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">{name} resume guides by role</h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-3 max-w-2xl">
              These links pair {name} with sector-plausible roles in the catalog. Open a guide for general structure and skill prompts, then verify every keyword against the actual job description.
            </p>
            <DirectoryEvidenceNote
              kind="curated"
              detail="Role availability is filtered for plausible company-sector combinations; it does not confirm that a specific vacancy is open."
              className="mb-6"
            />
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
              {roles.map((r) => (
                <li key={r.slug}>
                  <a
                    href={`/resume/${company}/${r.slug}`}
                    className="lift block h-full rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] p-4 text-sm font-medium text-[var(--color-text)] dark:text-[var(--color-dark-text)] shadow-[var(--shadow-sm)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] transition-colors"
                  >
                    {r.title} resume for {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <DirectoryMethodCard
            className="mt-10 reveal-on-scroll"
            title={`Evidence boundaries for ${name} guides`}
            description="The employer record helps organize the directory. Guidance on linked pages remains general until you supply a real posting and your own supportable experience."
            items={[
              { kind: "database", detail: "Company identity, country, sector, and role catalog data come from maintained records." },
              { kind: "curated", detail: "Company-role links use sector-plausibility rules to avoid publishing arbitrary combinations." },
              { kind: "guidance", detail: `RoleSharp does not attribute private recruiter preferences, ATS settings, or unpublished selection criteria to ${name}.` },
              { kind: "illustrative", detail: "Example skills and bullets are starting prompts. Keep only claims supported by your own evidence and the live posting." },
            ]}
          />

          <div className="mt-12 reveal-on-scroll">
            <Card variant="dark" padding="lg" className="relative overflow-hidden text-center">
              <div className="relative z-10">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Applying to {name}?</h2>
                <Button as="a" href={`/build#company=${company}`} variant="primaryInverse" size="lg">
                  Build my {name} resume free
                </Button>
              </div>
            </Card>
          </div>
        </Container>
      </Section>
    </MarketingShell>
  );
}
