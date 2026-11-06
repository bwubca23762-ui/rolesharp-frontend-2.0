const BRAND_SUFFIX = " | RoleSharp";
const TITLE_TARGET = 60;
const DESCRIPTION_TARGET = 155;

const ROLE_TITLE_FALLBACKS: Record<string, string> = {
  "Advertising and Promotions Managers": "Advertising Manager",
  "Airline Pilots, Copilots, and Flight Engineers": "Airline Pilot",
  "Architects, Except Landscape and Naval": "Architect",
  "Claims Adjusters, Examiners, and Investigators": "Claims Adjuster",
  "Computer and Information Systems Managers": "IT Manager",
  "Computer Systems Analysts": "Systems Analyst",
  "Customer Service Representatives": "Customer Service Rep",
  "Dispatchers, Except Police, Fire, and Ambulance": "Dispatcher",
  "Financial and Investment Analysts": "Financial Analyst",
  "First-Line Supervisors of Retail Sales Workers": "Retail Supervisor",
  "General and Operations Managers": "Operations Manager",
  "Geoscientists, Except Hydrologists and Geographers": "Geoscientist",
  "Heavy and Tractor-Trailer Truck Drivers": "Truck Driver",
  "Human Resources Specialists": "HR Specialist",
  "Industrial Production Managers": "Production Manager",
  "Information Security Analysts": "Cybersecurity Analyst",
  "Market Research Analysts and Marketing Specialists": "Market Research Analyst",
  "Medical and Health Services Managers": "Healthcare Manager",
  "Medical Scientists, Except Epidemiologists": "Medical Scientist",
  "Network and Computer Systems Administrators": "Systems Administrator",
  "Operations Research Analysts": "Operations Analyst",
  "Personal Financial Advisors": "Financial Advisor",
  "Project Management Specialists": "Project Manager",
  "Public Relations Specialists": "PR Specialist",
  "Quality Control Analysts": "Quality Analyst",
  "Securities, Commodities, and Financial Services Sales Agents": "Financial Services Sales",
  "Software Quality Assurance Analysts and Testers": "Software QA Analyst",
  "Teachers and Instructors, All Other": "Teacher",
  "Training and Development Specialists": "Training Specialist",
  "Transportation, Storage, and Distribution Managers": "Logistics Manager",
  "Welders, Cutters, Solderers, and Brazers": "Welder",
  "Wind Turbine Service Technicians": "Wind Turbine Technician",
  "Farmers, Ranchers, and Other Agricultural Managers": "Agricultural Manager",
};

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function firstWithinLimit(candidates: string[], limit: number): string {
  return candidates.find((candidate) => candidate.length <= limit) ?? candidates[candidates.length - 1];
}

export function brandedSeoTitle(title: string): string {
  return title.length + BRAND_SUFFIX.length <= TITLE_TARGET ? `${title}${BRAND_SUFFIX}` : title;
}

function countryLocation(country: string): string {
  if (/^the\s+/i.test(country)) return country;
  return /^(Netherlands|Philippines|United Arab Emirates|United Kingdom|United States)$/i.test(country)
    ? `the ${country}`
    : country;
}

function countryTitle(country: string): string {
  const withoutArticle = country.replace(/^the\s+/i, "");
  const shortNames: Record<string, string> = {
    "United Arab Emirates": "UAE",
    "United Kingdom": "UK",
    "United States": "US",
  };
  return shortNames[withoutArticle] ?? withoutArticle;
}

export function compactRoleTitle(formalTitle: string, curatedTitle?: string | null): string {
  const curated = clean(curatedTitle);
  if (curated) return curated;
  const formal = clean(formalTitle);
  return ROLE_TITLE_FALLBACKS[formal] ?? formal;
}

export function companyRoleMetadata(input: {
  company: string;
  role: string;
  roleSeoTitle?: string | null;
  country?: string | null;
}) {
  const company = clean(input.company);
  const role = compactRoleTitle(input.role, input.roleSeoTitle);
  const country = clean(input.country);
  const market = country ? ` — ${countryTitle(country)}` : "";
  const where = country ? ` in ${countryLocation(country)}` : "";

  const title = brandedSeoTitle(firstWithinLimit([
    `${company} ${role} Resume${market} (2026)`,
    `${role} Resume for ${company}${market}`,
    `${company} ${role} Resume${market}`,
  ], TITLE_TARGET));

  const description = firstWithinLimit([
    `Build a free ${role} resume for a ${company} application${where}. Compare a current posting with your evidence and download a tailored PDF.`,
    `Free ${role} resume guide for ${company}${where}. Tailor truthful experience to a current posting and download a clean PDF.`,
    `${role} resume guide for ${company}${where}, grounded in the live job posting and your supportable experience.`,
  ], DESCRIPTION_TARGET);

  return { title, description, role };
}

export function companyHubMetadata(input: {
  company: string;
  country?: string | null;
}) {
  const company = clean(input.company);
  const country = clean(input.country);
  const market = country ? ` — ${countryTitle(country)}` : "";
  const where = country ? ` in ${countryLocation(country)}` : "";

  const title = brandedSeoTitle(firstWithinLimit([
    `${company} Resume Guides${market} (2026)`,
    `${company} Resume Guide${market}`,
  ], TITLE_TARGET));
  const description = firstWithinLimit([
    `Explore resume guides for ${company}${where}. Choose a plausible role, then tailor your evidence to the employer's current job posting.`,
    `Resume guides for ${company}${where}. Choose a role and verify every suggested term against the live job description.`,
  ], DESCRIPTION_TARGET);

  return { title, description };
}

export function countryCompanyDirectoryMetadata(countryName: string, employerCount: number | string) {
  const country = clean(countryName);
  const count = clean(String(employerCount));
  const title = brandedSeoTitle(firstWithinLimit([
    `${country} Company Resume Guides (${count})`,
    `Companies in ${country} — Resume Guides`,
  ], TITLE_TARGET));
  const description = firstWithinLimit([
    `Browse employer records in ${countryLocation(country)}, choose a plausible role, and tailor your resume to a current job posting.`,
    `Find company resume guides for ${countryLocation(country)} and verify every requirement against the employer's live posting.`,
  ], DESCRIPTION_TARGET);

  return { title, description };
}

export function roleHubMetadata(formalRole: string, curatedTitle?: string | null) {
  const role = compactRoleTitle(formalRole, curatedTitle);
  const title = brandedSeoTitle(firstWithinLimit([
    `${role} Resume Example, Skills & Template (2026)`,
    `${role} Resume Guide & Example (2026)`,
    `${role} Resume Guide`,
  ], TITLE_TARGET));
  const description = firstWithinLimit([
    `Build a free ${role} resume. Review general skill prompts and illustrative examples, then verify them against a current job description.`,
    `Free ${role} resume guide with general skill prompts, illustrative examples, and an evidence-grounded builder.`,
  ], DESCRIPTION_TARGET);

  return { title, description, role };
}

const BLOG_SEO_TITLES: Record<string, string> = {
  "ats-friendly-resume-2026": "ATS-Friendly Resume Guide: Step by Step (2026)",
  "ats-friendly-resume-without-sounding-generic": "ATS-Friendly Resume Without Generic Writing",
  "customer-success-resume-examples": "Customer Success Resume Examples",
  "fix-old-resume-or-build-new": "Fix an Old Resume or Build a New One?",
  "job-search-faq": "Job Search FAQ: 12 Questions Answered",
  "job-search-tracker-how-to-use": "How to Use a Job Search Tracker",
  "linkedin-vs-resume-what-recruiters-check-first-in-2026": "LinkedIn vs Resume: What Recruiters Check First",
  "one-page-vs-two-page-resume-what-ats-and-recruiters-prefer": "One-Page vs Two-Page Resume: ATS Guide",
  "product-manager-resume-keywords": "Product Manager Resume Keywords",
  "software-engineer-resume-summary-examples": "Software Engineer Resume Summary Examples",
  "tailor-resume-to-job-description": "Tailor a Resume to a Job Description",
  "tailor-student-resume-for-internships": "Tailor a Student Resume for Internships",
  "tailor-your-resume-for-a-data-analyst-role-at-microsoft": "Microsoft Data Analyst Resume Guide",
  "what-is-a-good-ats-score": "Good ATS Score in 2026: Ranges & Fixes",
  "workday-ats-resume-guide": "Workday ATS Resume: Format & Keywords (2026)",
};

export function blogSeoTitle(slug: string, fallbackTitle: string): string {
  return brandedSeoTitle(BLOG_SEO_TITLES[slug] ?? clean(fallbackTitle));
}

export function conciseSeoDescription(description: string): string {
  const value = clean(description);
  if (value.length <= DESCRIPTION_TARGET) return value;
  const window = value.slice(0, DESCRIPTION_TARGET);
  const sentenceEnd = Math.max(window.lastIndexOf("."), window.lastIndexOf("!"), window.lastIndexOf("?"));
  if (sentenceEnd >= 100) return window.slice(0, sentenceEnd + 1);
  const wordEnd = window.lastIndexOf(" ", DESCRIPTION_TARGET - 3);
  return `${window.slice(0, Math.max(1, wordEnd)).replace(/[,:;–—-]+$/, "")}…`;
}

export function comparisonSeoMetadata(competitorName: string) {
  const name = clean(competitorName);
  const title = brandedSeoTitle(`RoleSharp vs ${name}: Features & Pricing (2026)`);
  const description = conciseSeoDescription(
    `Compare RoleSharp and ${name} on pricing, resume tools, ATS features, templates, and job tailoring to choose the right resume builder.`,
  );
  return { title, description };
}

export function jobMarketSeoMetadata(kind: "Jobs" | "Internships", countryName: string, shortName = countryName) {
  const fullCountry = clean(countryName);
  const country = countryTitle(clean(shortName));
  const title = brandedSeoTitle(`${kind} in ${country} (2026)`);
  const description = kind === "Jobs"
    ? `Search fresh jobs in ${countryLocation(fullCountry)}. Filter by role, remote work, and salary, then tailor your resume to the exact posting.`
    : `Find fresh internships in ${countryLocation(fullCountry)}. Search by role or company, filter remote opportunities, and tailor your resume to the posting.`;
  return { title, description };
}

export const seoMetadataTargets = {
  title: TITLE_TARGET,
  description: DESCRIPTION_TARGET,
} as const;
