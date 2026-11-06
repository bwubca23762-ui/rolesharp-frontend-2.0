import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { randomUUID } from "crypto";

type DevUser = {
  id: string;
  email: string;
  passwordHash: string;
  premiumUntil: string | null;
  // Mirrors users.premium_source: drives the tier feature split in
  // lib/tier-features.ts. Without it, a local-dev student account resolves to
  // the full paid feature set.
  premiumSource: "paid" | "student" | null;
  emailVerifiedAt: string | null;
  credits: number;
  inviteCode: string;
  createdAt: string;
};

type DevResume = {
  id: string;
  userId: string;
  candidateName: string;
  content: any;
  atsScore: number;
  template: string;
  premiumUnlock: boolean;
  creditUsed: boolean;
  jdText: string;
  companyName: string | null;
  roleTitle: string | null;
  createdAt: string;
  coverLetter?: string | null;
  linkedin?: string | null;
  interview?: any;
};

type Store = {
  users: DevUser[];
  resumes: DevResume[];
};

if (process.env.NODE_ENV === "production" && process.env.LOCAL_DEV_MODE !== "true") {
  throw new Error("dev-store must not be imported in production");
}

const FILE = join(process.cwd(), ".local", "dev-store.json");
let mutationChain: Promise<unknown> = Promise.resolve();

const DEV_COMPANIES = [
  { slug: "stripe", name: "Stripe", country_code: "US", sector: "Payments", tier: "A" },
  { slug: "google", name: "Google", country_code: "US", sector: "Technology", tier: "A" },
  { slug: "amazon", name: "Amazon", country_code: "US", sector: "Technology", tier: "A" },
  { slug: "microsoft", name: "Microsoft", country_code: "US", sector: "Technology", tier: "A" },
  { slug: "tcs", name: "Tata Consultancy Services", country_code: "IN", sector: "IT Services", tier: "A" },
  { slug: "infosys", name: "Infosys", country_code: "IN", sector: "IT Services", tier: "A" },
  // Enough breadth that catalog-driven surfaces (the company directory, the
  // landing company wall) look locally the way they do in production instead
  // of rendering empty. Names only -- no logos, no scraped data.
  { slug: "apple", name: "Apple", country_code: "US", sector: "Technology", tier: "A" },
  { slug: "meta", name: "Meta", country_code: "US", sector: "Technology", tier: "A" },
  { slug: "netflix", name: "Netflix", country_code: "US", sector: "Media", tier: "A" },
  { slug: "nvidia", name: "Nvidia", country_code: "US", sector: "Semiconductors", tier: "A" },
  { slug: "salesforce", name: "Salesforce", country_code: "US", sector: "Software", tier: "A" },
  { slug: "adobe", name: "Adobe", country_code: "US", sector: "Software", tier: "A" },
  { slug: "shopify", name: "Shopify", country_code: "CA", sector: "Commerce", tier: "A" },
  { slug: "spotify", name: "Spotify", country_code: "SE", sector: "Media", tier: "A" },
  { slug: "sap", name: "SAP", country_code: "DE", sector: "Software", tier: "A" },
  { slug: "siemens", name: "Siemens", country_code: "DE", sector: "Industrial", tier: "A" },
  { slug: "revolut", name: "Revolut", country_code: "GB", sector: "Fintech", tier: "A" },
  { slug: "atlassian", name: "Atlassian", country_code: "AU", sector: "Software", tier: "A" },
  { slug: "canva", name: "Canva", country_code: "AU", sector: "Design", tier: "A" },
  { slug: "wipro", name: "Wipro", country_code: "IN", sector: "IT Services", tier: "A" },
  { slug: "flipkart", name: "Flipkart", country_code: "IN", sector: "Commerce", tier: "A" },
  { slug: "zoho", name: "Zoho", country_code: "IN", sector: "Software", tier: "A" },
];

const DEV_ROLES = [
  { slug: "software-engineer", title: "Software Engineer", sector: "IT", required_skills: ["JavaScript", "Python", "System Design", "Git", "Testing"], typical_bullets: ["Reduced API latency by 40% via caching", "Shipped features used by 1M+ users"] },
  { slug: "data-analyst", title: "Data Analyst", sector: "Analytics", required_skills: ["SQL", "Excel", "Python", "Tableau", "Statistics"], typical_bullets: ["Built dashboards cutting reporting time 60%", "Drove business decisions with KPI analysis"] },
  { slug: "accountant", title: "Accountant", sector: "Finance", required_skills: ["Excel", "Reconciliation", "GAAP", "Financial Reporting"], typical_bullets: ["Closed month-end books 2 days faster", "Reduced reconciliation errors by 30%"] },
  { slug: "product-manager", title: "Product Manager", sector: "Product", required_skills: ["Roadmapping", "Stakeholder Management", "User Research", "Analytics"], typical_bullets: ["Raised activation by 18% through onboarding redesign", "Prioritized roadmap for cross-functional teams"] },
];

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Store;
  } catch {
    return { users: [], resumes: [] };
  }
}

async function writeStore(store: Store) {
  await mkdir(dirname(FILE), { recursive: true });
  const temporary = `${FILE}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(store, null, 2));
  await rename(temporary, FILE);
}

function mutateStore<T>(mutation: (store: Store) => Promise<T> | T): Promise<T> {
  const operation = mutationChain.then(async () => {
    const store = await readStore();
    const value = await mutation(store);
    await writeStore(store);
    return value;
  });
  mutationChain = operation.catch(() => undefined);
  return operation;
}

function makeInviteCode() {
  return randomUUID().slice(0, 8);
}

export async function createDevUser(email: string, passwordHash: string) {
  return mutateStore((store) => {
    const id = randomUUID();
    const user: DevUser = {
      id,
      email: email.toLowerCase(),
      passwordHash,
      premiumUntil: null,
      premiumSource: null,
      emailVerifiedAt: new Date().toISOString(),
      credits: 3,
      inviteCode: makeInviteCode(),
      createdAt: new Date().toISOString(),
    };
    store.users.push(user);
    return user;
  });
}

export async function getDevUserByEmail(email: string) {
  const store = await readStore();
  return store.users.find((u) => u.email === email.toLowerCase()) ?? null;
}

export async function getDevUserById(id: string) {
  const store = await readStore();
  return store.users.find((u) => u.id === id) ?? null;
}

export async function deleteDevUser(id: string) {
  return mutateStore((store) => {
    const before = store.users.length;
    store.users = store.users.filter((user) => user.id !== id);
    store.resumes = store.resumes.filter((resume) => resume.userId !== id);
    return store.users.length !== before;
  });
}

export async function grantDevPremium(userId: string, days: number) {
  return mutateStore((store) => {
    const user = store.users.find((u) => u.id === userId);
    if (!user) return null;
    const base = user.premiumUntil && new Date(user.premiumUntil) > new Date()
      ? new Date(user.premiumUntil)
      : new Date();
    base.setDate(base.getDate() + days);
    user.premiumUntil = base.toISOString();
    return user;
  });
}

export async function listDevUserResumes(userId: string) {
  const store = await readStore();
  return store.resumes
    .filter((r) => r.userId === userId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((r) => ({
      id: r.id,
      candidate_name: r.candidateName,
      ats_score: r.atsScore,
      template: r.template,
      premium_unlock: r.premiumUnlock,
      created_at: r.createdAt,
      headline: r.content?.headline,
      company_name: r.companyName,
      role_title: r.roleTitle,
    }));
}

export async function saveDevResume(input: Omit<DevResume, "createdAt">) {
  return mutateStore((store) => {
    const idx = store.resumes.findIndex((r) => r.id === input.id);
    const row: DevResume = { ...input, createdAt: idx >= 0 ? store.resumes[idx].createdAt : new Date().toISOString() };
    if (idx >= 0) store.resumes[idx] = row;
    else store.resumes.push(row);
    return row;
  });
}

async function getDevResume(id: string) {
  const store = await readStore();
  return store.resumes.find((r) => r.id === id) ?? null;
}

export async function getDevUserResume(id: string, userId: string) {
  const resume = await getDevResume(id);
  return resume?.userId === userId ? resume : null;
}

export async function deleteDevUserResume(id: string, userId: string) {
  return mutateStore((store) => {
    const idx = store.resumes.findIndex((r) => r.id === id && r.userId === userId);
    if (idx < 0) return false;
    store.resumes.splice(idx, 1);
    return true;
  });
}

export async function updateDevResume(id: string, patch: Partial<DevResume>) {
  return mutateStore((store) => {
    const row = store.resumes.find((r) => r.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  });
}

export async function countDevResumesSince(userId: string, sinceMs: number) {
  const store = await readStore();
  return store.resumes.filter((r) => r.userId === userId && +new Date(r.createdAt) >= sinceMs).length;
}

export async function spendDevCredit(userId: string) {
  return mutateStore((store) => {
    const user = store.users.find((u) => u.id === userId);
    if (!user || user.credits <= 0) return false;
    user.credits -= 1;
    return true;
  });
}

export async function getDevCredits(userId: string) {
  return (await getDevUserById(userId))?.credits ?? 0;
}

export async function getDevInviteCode(userId: string) {
  return (await getDevUserById(userId))?.inviteCode ?? "";
}

export async function searchDevCompanies(term: string, country?: string) {
  const t = term.trim().toLowerCase();
  return DEV_COMPANIES
    .filter((c) => !country || c.country_code === country.toUpperCase())
    .filter((c) => c.name.toLowerCase().includes(t) || c.slug.toLowerCase().includes(t))
    .slice(0, 10);
}

export async function listDevCompanies(limit = 30) {
  return DEV_COMPANIES.slice(0, limit)
    .map(({ slug, name, country_code, sector }) => ({ slug, name, country_code, sector }));
}

export async function listDevRoles(limit = 30) {
  return DEV_ROLES.slice(0, limit).map(({ slug, title, sector }) => ({ slug, title, sector }));
}

// One published personal site so /u/[handle] can be rendered and reviewed
// without a database — the same reason DEV_ROLES exists. show_contact is false
// here on purpose: the default a reviewer sees should be the shipped default.
const DEV_SITE = {
  handle: "amina",
  resume_id: "00000000-0000-4000-8000-000000000001",
  display_name: "Amina Osei",
  show_contact: false,
  indexable: false,
  portfolio: [
    { title: "Billing flow redesign", url: "https://example.com/billing-case-study", description: "Case study: cutting failed renewals by 18% without changing the price." },
    { title: "Northwind design system", description: "Four product surfaces on one component set. No public link." },
  ],
  case_studies: [
    {
      title: "Failed renewals: diagnosis to fix",
      problem: "Renewal failures spiked each billing cycle and support could not tell which customers were affected until they complained.",
      approach: "Mapped the retry flow, instrumented the three failure states, and redesigned the dunning emails to fire per state instead of on a fixed schedule.",
      result: "Failed renewals dropped 18% over the following quarter, measured against the two prior cycles.",
      url: "https://example.com/billing-case-study",
    },
  ],
  published_at: "2026-08-16T00:00:00.000Z",
  content: {
    headline: "Senior Product Designer",
    contact: { email: "amina@example.com", phone: "+49 30 000000", location: "Berlin, Germany", linkedin: "linkedin.com/in/amina" },
    summary: "Product designer working on billing and onboarding in B2B SaaS. Most of my work is reducing the number of steps between a customer deciding and a customer finishing.",
    skills: ["Design systems", "User research", "Prototyping", "Figma", "B2B SaaS"],
    experiences: [
      {
        title: "Senior Product Designer",
        company: "Northwind",
        period: "2023 — present",
        bullets: [
          "Led the billing-flow redesign that reduced failed renewals by 18%.",
          "Rolled out a design system across 4 product surfaces.",
        ],
      },
    ],
    education: [{ degree: "BA Interaction Design", school: "University of Leeds", year: "2018" }],
    projects: [],
    certifications: [],
    languages: ["English — native", "German — B2"],
    achievements: [],
  },
};

export async function listDevIndexableSites() {
  // Mirrors the real query: published AND indexable. The seed site is not
  // indexable, so this list is empty — which is the shipped default and the
  // right thing for a reviewer to see.
  return DEV_SITE.published_at && DEV_SITE.indexable
    ? [{ handle: DEV_SITE.handle, display_name: DEV_SITE.display_name, headline: DEV_SITE.content.headline, published_at: DEV_SITE.published_at }]
    : [];
}

export async function getDevPublishedSite(handle: string) {
  return DEV_SITE.published_at && DEV_SITE.handle === handle ? DEV_SITE : null;
}

export async function listDevRolesWithSkills(limit = 60) {
  return DEV_ROLES.slice(0, limit).map(({ slug, title, sector, required_skills }) => ({
    slug, title, sector, required_skills, preferred_skills: [] as string[],
  }));
}

export async function searchDevRoles(term: string, limit = 20) {
  const t = term.trim().toLowerCase();
  return DEV_ROLES.filter((r) => r.title.toLowerCase().includes(t)).slice(0, limit).map(({ slug, title, sector }) => ({ slug, title, sector }));
}

export async function getDevRoleBySlug(slug: string) {
  return DEV_ROLES.find((r) => r.slug === slug) ?? null;
}

export async function getDevCompanyBySlug(slug: string) {
  return DEV_COMPANIES.find((c) => c.slug === slug) ?? null;
}
