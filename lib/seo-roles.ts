// Curated company×role pairing for the programmatic /resume/{company}/{role}
// surface. The old approach crossed every company with the same 50 roles (45 of
// them alphabetical O*NET imports), which produced implausible doorway pages
// ("Actors resume for Verizon") and ~95% template overlap. Instead, every
// company gets a universal core of roles that nearly all large employers hire,
// plus a set matched to its industry. ~16 roles × 800 companies ≈ 13k pages,
// every one a plausible query someone actually searches.

// Roles nearly every large employer hires. First 5 are the manually-seeded
// roles with rich skills/bullets data.
export const UNIVERSAL_ROLE_SLUGS: string[] = [
  "software-engineer",
  "accountant",
  "data-analyst",
  "sales-executive",
  "human-resources-specialists",
  "marketing-managers",
  "customer-service-representatives",
  "financial-and-investment-analysts",
  "project-management-specialists",
  "general-and-operations-managers",
];

const TECH = [
  "software-developers", "web-developers", "information-security-analysts",
  "data-scientists", "computer-systems-analysts",
  "network-and-computer-systems-administrators", "database-administrators",
  "computer-and-information-systems-managers",
];
const FINANCE = [
  "financial-managers", "personal-financial-advisors", "loan-officers",
  "actuaries", "insurance-underwriters",
  "securities-commodities-and-financial-services-sales-agents",
  "claims-adjusters-examiners-and-investigators", "compliance-officers", "tellers",
];
const HEALTH = [
  "registered-nurse", "pharmacists", "pharmacy-technicians",
  "medical-and-health-services-managers", "medical-scientists-except-epidemiologists",
];
const INDUSTRIAL = [
  "industrial-engineers", "mechanical-engineers", "industrial-production-managers",
  "quality-control-analysts", "machinists", "welders-cutters-solderers-and-brazers",
  "logisticians", "supply-chain-managers",
];
const ENERGY = [
  "petroleum-engineers", "chemical-engineers", "environmental-engineers",
  "power-plant-operators", "geoscientists-except-hydrologists-and-geographers",
  "wind-turbine-service-technicians", "electricians",
];
const RETAIL = [
  "retail-salespersons", "first-line-supervisors-of-retail-sales-workers",
  "purchasing-managers", "supply-chain-managers", "food-service-managers",
];
const HOSPITALITY = ["lodging-managers", "chefs-and-head-cooks", "food-service-managers"];
const CONSTRUCTION = [
  "construction-managers", "civil-engineers", "real-estate-brokers",
  "cost-estimators", "architects-except-landscape-and-naval",
];
const MATERIALS = [
  "chemists", "chemical-engineers", "industrial-engineers",
  "quality-control-analysts", "environmental-engineers",
];
const MEDIA = [
  "public-relations-specialists", "editors", "writers-and-authors",
  "producers-and-directors", "graphic-designers",
  "market-research-analysts-and-marketing-specialists", "advertising-and-promotions-managers",
];
const TRANSPORT = [
  "logisticians", "transportation-storage-and-distribution-managers",
  "dispatchers-except-police-fire-and-ambulance", "heavy-and-tractor-trailer-truck-drivers",
];
const AVIATION = ["airline-pilots-copilots-and-flight-engineers", "flight-attendants", ...TRANSPORT];
const EDUCATION = ["teachers-and-instructors-all-other", "tutors", "training-and-development-specialists"];
const CONSULTING = ["management-analysts", "lawyers", "operations-research-analysts"];
const AGRI = ["farmers-ranchers-and-other-agricultural-managers", "agricultural-engineers"];

// Keyword → role-set matching over the messy company sector strings (mix of
// GICS labels and free-form Wikidata industry values, e.g. "Information
// Technology", "e-commerce", "petroleum trading", "Q116690267").
const SECTOR_RULES: { pattern: RegExp; roles: string[] }[] = [
  { pattern: /(information technology|^it\b|it services|tech|software|internet|computer|artificial intelligence|blockchain|crypto|semiconductor|telecom|web hosting|online|e-commerce|electronics|video game|cyber|security)/, roles: TECH },
  { pattern: /(financ|bank|insur|invest|fintech|asset management|venture capital|securities|estate planning|risk management|accounting|mergers)/, roles: FINANCE },
  { pattern: /(health|pharma|medical|hospital|wellness|biotech|medicine|care)/, roles: HEALTH },
  { pattern: /(industrial|manufactur|automotive|aerospace|defen[cs]e|weapons|shipbuild|machinery|conglomerate|packaging|equipment|appliance|furniture|paint)/, roles: INDUSTRIAL },
  { pattern: /(energy|petroleum|oil|gas|utilit|electric|solar|renewable|geothermal|mining|drilling|power)/, roles: ENERGY },
  { pattern: /(retail|consumer|e-commerce|grocery|supermarket|food (industry|trade|manufacturer)|beverage|apparel|cosmetics|tobacco|goods)/, roles: RETAIL },
  { pattern: /(hotel|hospitality|restaurant|travel|vacation|tourism|catering|coffee|brewing)/, roles: HOSPITALITY },
  { pattern: /(real estate|real property|construction|building|dredging|infrastructure|housing)/, roles: CONSTRUCTION },
  { pattern: /(materials|chemical|steel|aluminium|aluminum|cement|glass|paper|grain|commodit)/, roles: MATERIALS },
  { pattern: /(media|entertainment|communication services|advertis|marketing|broadcast|film|television|music|publish|news|photograph|art|fashion|sport)/, roles: MEDIA },
  { pattern: /(transport|logistic|shipping|freight|rail|delivery|supply chain)/, roles: TRANSPORT },
  { pattern: /(airline|aviation|airport|aircraft)/, roles: AVIATION },
  { pattern: /(education|university|school|edtech|learning)/, roles: EDUCATION },
  { pattern: /(consult|professional services|legal|law|staffing|recruit|business service|market research|management services)/, roles: CONSULTING },
  { pattern: /(agri|farm|meat|dairy|crop)/, roles: AGRI },
];

// Broad extras for companies whose sector is unknown/unmatchable, so their
// hubs still offer more than the universal core.
const DEFAULT_EXTRA = ["management-analysts", "market-research-analysts-and-marketing-specialists", "logisticians"];

// Role slugs a given company sector supports (universal core + sector sets).
// Deterministic and cheap — pure string matching, no DB access.
export function roleSlugsForSector(sector: string | null | undefined): string[] {
  const s = (sector ?? "").toLowerCase();
  const out = [...UNIVERSAL_ROLE_SLUGS];
  let matched = false;
  for (const rule of SECTOR_RULES) {
    if (rule.pattern.test(s)) {
      matched = true;
      for (const slug of rule.roles) if (!out.includes(slug)) out.push(slug);
    }
  }
  if (!matched) for (const slug of DEFAULT_EXTRA) if (!out.includes(slug)) out.push(slug);
  return out;
}

export function isPairAllowed(sector: string | null | undefined, roleSlug: string): boolean {
  return roleSlugsForSector(sector).includes(roleSlug);
}

// Programmatic company×role pages are indexable only when the role has a
// maintained skill list and illustrative bullet patterns. Empty O*NET/ESCO
// imports otherwise produce hundreds of near-identical pages with generic
// fallback copy, which Google has been crawling without indexing.
export function hasIndexableRoleEvidence(role: {
  required_skills?: unknown;
  typical_bullets?: unknown;
} | null | undefined): boolean {
  const skills = role?.required_skills;
  const bullets = role?.typical_bullets;
  return Array.isArray(skills) && skills.length >= 3
    && Array.isArray(bullets) && bullets.length >= 1;
}

// Every role slug that appears in any curated set — the role-hub universe.
export function allCuratedRoleSlugs(): string[] {
  const out = [...UNIVERSAL_ROLE_SLUGS, ...DEFAULT_EXTRA];
  for (const rule of SECTOR_RULES) for (const slug of rule.roles) if (!out.includes(slug)) out.push(slug);
  return out;
}
