import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { notFound, permanentRedirect } from "next/navigation";
import { getCompanyBySlug, getRoleBySlug, companiesForRole, rolesForCompanySector } from "@/lib/db";
import { hasIndexableRoleEvidence, isPairAllowed, roleSlugsForSector } from "@/lib/seo-roles";
import { companyDisplayName } from "@/lib/company-display";
import { env } from "@/lib/env";
import { seoCountryName } from "@/lib/country-display";
import { companyRoleMetadata } from "@/lib/seo-metadata";
import { Breadcrumb, Button, MarketingShell } from "@/components/ui/primitives";
import { DirectoryEvidenceNote, DirectoryMethodCard } from "@/components/marketing";
import AskAiLinks from "@/app/ask-ai-links";

type Params = { params: Promise<{ company: string; role: string }> };

// Search Console still has URLs from the older role catalogue. Preserve a
// useful destination for the three legacy slugs confirmed in its failed 404
// validation sample. Data Scientist has an exact current role slug; Product
// Manager and UX Designer do not, so send those to the matching company hub,
// which lists the company's currently supported roles and jobs.
const LEGACY_ROLE_DESTINATIONS: Record<string, (company: string) => string> = {
  "data-scientist": (company) => `/resume/${company}/data-scientists`,
  "product-manager": (company) => `/companies/${company}`,
  "ux-designer": (company) => `/companies/${company}`,
};

function titleCase(slug: string) {
  // Company slugs are now country-prefixed ({cc}-name); strip a leading 2-letter
  // country code so an unmatched "us-google" reads "Google", not "Us Google".
  return slug
    .replace(/^[a-z]{2}-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Deterministic, stable hash of a string -> non-negative int. Same slug always
// picks the same variant, keeping rendered guidance stable between crawls. The
// small copy variants are not treated as unique company evidence; indexability
// is gated separately on maintained role evidence and the curated company set.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// Role-themed fallback skills when the DB row has none. Order matters:
// finance/accounting must match before the sales branch — "accountants"
// contains "account", which used to hand accountant pages CRM/quota skills.
// Returns null when no theme matches; callers must suppress the section
// rather than render literal filler ("Relevant domain expertise").
function fallbackSkills(role: string): string[] | null {
  const r = role.toLowerCase();
  if (/(accountant|auditor|financ|actuar|underwrit|tax|treasur|bookkeep)/.test(r))
    return ["Financial reporting", "GAAP/IFRS compliance", "Account reconciliation", "Budgeting & forecasting", "Excel & ERP systems", "Audit preparation"];
  if (/(nurse|physician|pharmac|medical|health|clinic|therap)/.test(r))
    return ["Patient care & safety", "Clinical documentation", "Care-plan coordination", "Regulatory compliance (HIPAA)", "Electronic health records", "Multidisciplinary teamwork"];
  if (/(engineer|developer|software|backend|frontend)/.test(r))
    return ["System design", "Data structures & algorithms", "Code review & testing", "CI/CD", "Production debugging", "Cross-team collaboration"];
  if (/(data|scientist|analyst|ml|machine)/.test(r))
    return ["SQL", "Python", "Statistical analysis", "Data visualization", "A/B testing", "Stakeholder communication"];
  if (/(product|pm|project)/.test(r))
    return ["Product roadmapping", "User research", "Metrics & KPIs", "Stakeholder management", "Prioritization", "Go-to-market"];
  if (/(design|ux|ui)/.test(r))
    return ["User research", "Wireframing & prototyping", "Design systems", "Usability testing", "Figma", "Accessibility"];
  if (/(market|growth|content|seo|public relations|advertis)/.test(r))
    return ["Campaign strategy", "Analytics", "Content creation", "SEO/SEM", "Conversion optimization", "Brand messaging"];
  if (/(human resources|recruit|talent|training)/.test(r))
    return ["Talent acquisition", "Employee relations", "HRIS systems", "Onboarding & training", "Compensation & benefits", "Employment-law compliance"];
  if (/(logisti|supply chain|warehouse|transport|dispatch)/.test(r))
    return ["Supply-chain planning", "Inventory management", "Vendor negotiation", "WMS/TMS systems", "Route & capacity optimization", "KPI reporting"];
  if (/(sales|business development|customer)/.test(r))
    return ["Pipeline management", "Negotiation", "CRM (Salesforce)", "Quota attainment", "Relationship building", "Forecasting"];
  if (/(manager|director|operations|supervisor)/.test(r))
    return ["Team leadership", "Budget ownership", "Process improvement", "Cross-functional coordination", "Performance management", "Strategic planning"];
  return null;
}

// These guides currently combine company names with general role guidance but
// lack employer-specific hiring evidence. Keep them useful to visitors while
// preventing the repetitive page family from competing for search indexing.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { company, role } = await params;
  // Pull real DB context so the title/description differ per page where data exists.
  const [cRow, rRow] = await Promise.all([
    getCompanyBySlug(company).catch(() => null),
    getRoleBySlug(role).catch(() => null),
  ]);
  if (!cRow || !rRow || !isPairAllowed(cRow.sector, role)) {
    return { robots: { index: false, follow: false } };
  }
  if (!hasIndexableRoleEvidence(rRow)) {
    return { robots: { index: false, follow: true } };
  }
  const c = companyDisplayName(company, cRow?.name ?? titleCase(company));
  const r = rRow?.title ?? titleCase(role);
  const ctry = seoCountryName(cRow?.country_code);
  const seo = companyRoleMetadata({
    company: c,
    role: r,
    roleSeoTitle: rRow?.seo_title,
    country: ctry,
  });
  const { title, description } = seo;
  return {
    title: { absolute: title },
    description,
    keywords: [`${c} ${r} resume`, `${r} resume for ${c}`, `${c} resume template`, `${c} ats resume`, `how to get a job at ${c}`, `${r} resume example`, ...(ctry ? [`${c} ${r} resume ${ctry}`] : [])],
    robots: { index: false, follow: true },
    alternates: { canonical: `/resume/${company}/${role}` },
    openGraph: { title, description, type: "article", url: `/resume/${company}/${role}`, images: [`/resume/${company}/${role}/opengraph-image`] },
    twitter: { card: "summary_large_image", title, description, images: [`/resume/${company}/${role}/opengraph-image`] },
  };
}

export default async function CompanyRolePage({ params }: Params) {
  const { company, role } = await params;
  const [c, r] = await Promise.all([
    getCompanyBySlug(company).catch(() => null),
    getRoleBySlug(role).catch(() => null),
  ]);
  // A company-role page is only useful when both entities exist AND the role
  // is plausible for the company's industry (lib/seo-roles.ts). Implausible
  // cross-product pairs ("Actors resume for Verizon") are doorway pages —
  // never publish invented context.
  //
  // But the July 2026 sitemap published ~400 companies × the full role list
  // (~16k pair URLs) to Google, and the curated gate has since shrunk. Those
  // retired pairs are not "removed content" — their intent has living
  // equivalents — so a dead-but-real pair 308s to the same company's first
  // defended pair (Search Console's 16k "Not found (404)" backlog is exactly
  // these). Fake or unknown slugs still 404: unknown targets stay unknown.
  if (!c) notFound();
  if (!r) {
    const legacyDestination = LEGACY_ROLE_DESTINATIONS[role];
    if (legacyDestination) permanentRedirect(legacyDestination(company));
    notFound();
  }
  if (!isPairAllowed(c.sector, role)) {
    const firstAllowed = roleSlugsForSector(c.sector)[0];
    permanentRedirect(firstAllowed ? `/resume/${company}/${firstAllowed}` : "/resume-examples");
  }
  const cName = companyDisplayName(company, c?.name ?? titleCase(company));
  const rName = r?.title ?? titleCase(role);
  const sector: string | null = r?.sector ?? c?.sector ?? null;
  const ctry = seoCountryName(c?.country_code);

  // ---- deterministic variant selection (stable per slug pair) ----
  const seed = hashStr(`${company}::${role}`);
  const pick = <T,>(arr: T[], salt = 0) => arr[(seed + salt) % arr.length];

  // Maintained role skills when present, otherwise deterministic role-themed
  // guidance. The fallback is never presented as company-specific evidence.
  const databaseSkills: string[] = Array.isArray(r.required_skills) ? r.required_skills.filter(Boolean) : [];
  const hasDatabaseSkills = databaseSkills.length > 0;
  const skills: string[] = hasDatabaseSkills ? databaseSkills : (fallbackSkills(rName) ?? []);
  // Maintained role-record examples, if present. They remain illustrative
  // patterns and must not be copied as personal achievements.
  const bullets: string[] = Array.isArray(r?.typical_bullets) ? r.typical_bullets.filter(Boolean) : [];

  // Stable variants keep the programmatic catalog useful without inventing
  // recruiter behavior, applicant volume, or private employer criteria.
  const sectorPhrase = sector ? ` in the ${sector} sector` : "";
  const marketPhrase = ctry ? ` for an application in ${ctry}` : "";
  const introVariants: string[] = [
    `Use this ${cName} and ${rName} guide as a starting point, then verify every requirement against the current job posting${marketPhrase}. The posting and your own supportable experience — not the company name alone — should determine the final wording.`,
    `A ${rName} resume for ${cName}${sectorPhrase} should connect truthful evidence from your work to the responsibilities and qualifications published in the specific vacancy. This page provides general structure and role prompts, not private employer criteria.`,
    `Tailoring a ${rName} resume to ${cName} means comparing your real experience with one current ${rName} job description. Keep relevant terminology where it accurately describes your work, and leave out any requirement you cannot support.`,
    `Start with the live ${cName} posting, identify its stated responsibilities and qualifications, and map those items to evidence from your own ${rName} experience. This guide does not claim to know ${cName}'s internal screening settings or recruiter preferences.`,
  ];
  const intro = pick(introVariants);

  // General tailoring guidance; selected deterministically for stable pages.
  const tipPool: string[] = [
    `Use the exact ${rName} job title from the live ${cName} posting when it accurately describes the role you are targeting.`,
    `Lead experience bullets with the action you took, then add a result or scope measure only when your records support it.`,
    `Identify several responsibilities or qualifications stated in the posting${sector ? ` and note any relevant ${sector} terminology` : ""}; use them naturally where they match your experience.`,
    `Remove unrelated detail when it obscures evidence that directly supports the ${rName} requirements in the posting.`,
    `Show seniority through truthful scope, ownership, team context, and decision impact rather than assumed expectations from ${cName}.`,
    `Quantify relevant outcomes with supportable measures such as volume, latency, revenue, users, time, cost, or percentage.`,
    `Name relevant tools and frameworks${skills.length ? `, using prompts such as ${skills.slice(0, 3).join(", ")}` : ""}, but keep only those you have actually used and the posting requests or values.`,
    `Write a concise summary connecting your ${rName} evidence to the published role; avoid a generic objective or unsupported claim of fit.`,
  ];
  const rot = seed % tipPool.length;
  const tips = [...tipPool.slice(rot), ...tipPool.slice(0, rot)].slice(0, 5);

  // General parseability guidance. No format is described as universally
  // compatible, and the employer's instructions always take precedence.
  const atsTips: string[] = [
    `Follow the posting's file-format instructions. If it accepts PDF or DOCX, export a clean text-based file and verify that copied text remains readable.`,
    `Prefer a straightforward reading order and avoid placing essential information only inside images, charts, headers, or footers.`,
    `Spell out an acronym once when both the full term and abbreviation are relevant to the ${rName} posting.`,
    `Use familiar section headings such as "Experience", "Skills", and "Education" unless the application instructions require another structure.`,
  ];

  // FAQ answers preserve the company-role query while keeping claims bounded.
  const faqs: [string, string][] = [
    [`Is the ${cName} ${rName} resume builder free?`, `Yes. You can build and download a tailored ${rName} resume for ${cName} for free. Premium adds extra templates, a cover letter, interview prep and more.`],
    [`How do I tailor my ${rName} resume for a ${cName} application?`, `Paste the current ${cName} ${rName} job description into the builder. RoleSharp compares its published terminology and requirements with the evidence you provide, then shows a diagnostic match score. The score is not an employer decision or a view into ${cName}'s ATS configuration.`],
    [`What skills should a ${rName} resume for ${cName} highlight?`, skills.length
      ? `Use the live posting first. This guide's ${hasDatabaseSkills ? "maintained role record" : "general fallback guidance"} includes prompts such as ${skills.slice(0, 4).join(", ")}, but include a skill only when it is relevant and supported by your experience.`
      : `Use the skills and requirements listed in the live ${cName} ${rName} posting, and support each selected item with truthful evidence from your own experience.`],
    [`How long should a ${rName} resume be?`, `Use the length needed to present relevant, supportable evidence clearly. Follow any application instructions from ${cName}, prioritize the target role, and remove unrelated detail rather than relying on a universal page-count rule.`],
  ];

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: env.siteUrl },
        { "@type": "ListItem", position: 2, name: "Companies", item: `${env.siteUrl}/companies` },
        { "@type": "ListItem", position: 3, name: cName, item: `${env.siteUrl}/companies/${company}` },
        { "@type": "ListItem", position: 4, name: `${rName} resume`, item: `${env.siteUrl}/resume/${company}/${role}` },
      ],
    },
  ];

  // (6) Internal links: sibling roles this company actually publishes + the
  // same role at other companies that publish it. Seed-rotated so the link
  // blocks differ across pages instead of a sitewide identical footprint.
  const [siblingRoles, roleCompanies] = await Promise.all([
    rolesForCompanySector(c?.sector).catch(() => []),
    companiesForRole(role, company, 24).catch(() => []),
  ]);
  const siblings = siblingRoles.filter((s) => s.slug !== role);
  const sibRot = siblings.length ? seed % siblings.length : 0;
  const relatedRoles = [...siblings.slice(sibRot), ...siblings.slice(0, sibRot)].slice(0, 4);
  const coRot = roleCompanies.length ? seed % roleCompanies.length : 0;
  const relatedCompanies = [...roleCompanies.slice(coRot), ...roleCompanies.slice(0, coRot)].slice(0, 3);

  // Reciprocal internal links (programmatic-graph reinforcement): only link
  // what actually exists. Salary pages 404 below the sample bar
  // (dynamicParams=false), and interview banks 404 under 4 questions, so a
  // bare link for every company×role pair would manufacture dead ends.
  const [salaryCandidate, bankEligible] = await Promise.all([
    ctry
      ? import("@/lib/salary-pages").then((m) =>
          m.candidatesPromise(150).then((list) =>
            list.find((s) => s.roleSlug === role && s.countryCode.toLowerCase() === ctry.toLowerCase()) ?? null,
          ),
        ).catch(() => null)
      : Promise.resolve(null),
    import("@/lib/interview-bank").then((m) =>
      m.bankEligibleRoles(200).then((list) => list.some((r) => r.slug === role)),
    ).catch(() => false),
  ]);
  const jobsSlug = (c?.country_code ?? "us").toLowerCase();

  return (
    <MarketingShell className="container seo-page">
      <JsonLd data={ld} />
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Companies", href: "/companies" }, { label: cName, href: `/companies/${company}` }, { label: `${rName} resume` }]} />
      <section className="seo-hero">
        <div>
          <h1>{cName} {rName} Resume — Format & Example</h1>
          <p className="lead">
            Build an <strong>evidence-grounded {rName} resume for a {cName} application</strong>. Paste the current job description and compare its published requirements with truthful experience, skills, projects, and achievements from your own record.
          </p>
          <DirectoryEvidenceNote
            kind="guidance"
            detail={`This guide does not claim access to ${cName}'s private ATS settings, recruiter preferences, or unpublished hiring criteria.`}
          />
          <div className="page-actions">
            <Button as="a" size="lg" href={`/build#company=${company}&role=${role}`}>
              Build my {rName} resume free
            </Button>
            <Button as="a" variant="outline" size="lg" href="/checker">Check existing resume</Button>
          </div>
        </div>
        <aside className="seo-panel">
          <h2 style={{ fontSize: "1.25rem" }}>What this page helps with</h2>
          <ul className="info-list">
            <li>Identify published responsibilities and qualifications for {rName}.</li>
            <li>Connect the current {cName} posting to supportable resume evidence.</li>
            <li>Export a clean PDF, or unlock DOCX and job-search tools on Premium.</li>
          </ul>
        </aside>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <p style={{ margin: 0 }}>{intro}</p>
      </section>

      <DirectoryMethodCard
        className="mb-5"
        title={`Evidence boundaries for this ${cName} and ${rName} guide`}
        description="This programmatic page combines maintained catalog records, curated plausibility rules, and stable general guidance. It becomes job-specific only when you provide a current posting."
        items={[
          { kind: "database", detail: "Company and role identity, sector context, maintained skills, and any stored example bullets come from catalog records." },
          { kind: "curated", detail: "The page exists only when the company-role pair passes RoleSharp's sector-plausibility rules." },
          { kind: "guidance", detail: "Introductions, tips, fallback skills, and parseability advice are deterministic general guidance, not employer intelligence." },
          { kind: "illustrative", detail: "Example bullets are patterns, not customer outcomes or facts to copy. Replace them with evidence you can support." },
        ]}
      />

      <div className="prose-grid">
        {skills.length > 0 && (
        <section className="card">
          <h2>Skill and keyword prompts for a {rName} resume</h2>
          <DirectoryEvidenceNote
            kind={hasDatabaseSkills ? "database" : "guidance"}
            detail={hasDatabaseSkills
              ? "These prompts come from the maintained role record. Verify each one against the live posting and your own experience."
              : "No maintained role skill list was available, so these are deterministic role-themed fallback prompts."}
            className="mb-3"
          />
          <p className="text-[var(--muted-fg)]" style={{ marginTop: 0 }}>
            Use only the terms that accurately describe your experience and appear relevant to the current {cName} {rName} posting{sector ? ` or its ${sector} context` : ""}.
          </p>
          <ul className="info-list">{skills.map((s) => <li key={s}>{s}</li>)}</ul>
          {bullets.length > 0 && (
            <>
              <h3 style={{ marginBottom: 6 }}>Illustrative bullet patterns</h3>
              <DirectoryEvidenceNote
                kind="illustrative"
                detail="These examples come from the maintained role record but are not verified customer achievements. Do not copy them as facts."
                className="mb-3"
              />
              <ul className="info-list">{bullets.slice(0, 4).map((b) => <li key={b}>{b}</li>)}</ul>
            </>
          )}
        </section>
        )}

        <section className="card">
          <h2>How to tailor your resume for {cName}</h2>
          <ul className="info-list">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>General parseability tips for {rName} applications</h2>
        <DirectoryEvidenceNote
          kind="guidance"
          detail="ATS products and employer configurations vary. These practices reduce avoidable formatting risk but do not guarantee parsing or advancement."
          className="mb-3"
        />
        <ul className="info-list">{atsTips.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>

      <h2>Frequently asked questions</h2>
      {faqs.map(([q, a]) => (
        <details key={q} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
          <summary style={{ fontWeight: 600, cursor: "pointer" }}>{q}</summary>
          <p className="text-[var(--muted-fg)]" style={{ margin: "8px 0 0" }}>{a}</p>
        </details>
      ))}

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Related resume guides</h2>
        <div className="prose-grid" style={{ marginTop: 8 }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Other roles at {cName}</h3>
            <ul className="info-list">
              {relatedRoles.map((s) => (
                <li key={s.slug}><a href={`/resume/${company}/${s.slug}`}>{s.title} resume for {cName}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>{rName} resumes at other companies</h3>
            <ul className="info-list">
              {relatedCompanies.map((h) => (
                <li key={h.slug}><a href={`/resume/${h.slug}/${role}`}>{rName} resume for {h.name}</a></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="cta-band" style={{ marginTop: 28 }}>
        <h2 style={{ marginTop: 0 }}>Ready to apply to {cName}?</h2>
        <Button as="a" size="lg" href={`/build#company=${company}&role=${role}`}>Build my {rName} resume free</Button>
        <div style={{ marginTop: 14 }}>
          <a href={`/jobs/${jobsSlug}?q=${encodeURIComponent(rName)}`} className="text-sm font-semibold underline">
            See live {rName} postings
          </a>
          {salaryCandidate && (
            <a href={`/salaries/${role}/${salaryCandidate.countryCode.toLowerCase()}`} className="text-sm font-semibold underline" style={{ marginLeft: 14 }}>
              {rName} salary data
            </a>
          )}
          {bankEligible && (
            <a href={`/interview-questions/${role}`} className="text-sm font-semibold underline" style={{ marginLeft: 14 }}>
              {rName} interview questions
            </a>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <AskAiLinks topic={`${rName} resume for ${cName}`} />
      </div>
    </MarketingShell>
  );
}
