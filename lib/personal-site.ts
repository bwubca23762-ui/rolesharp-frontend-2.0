/**
 * The personal site: a resume the owner has chosen to put on the open web.
 *
 * Everything in this module exists because that sentence is dangerous. A resume
 * carries a full name, an email, a phone number, a home city and an employment
 * history, and a personal website is the one place in this product where that
 * goes somewhere a stranger can read it. So the defaults are the feature:
 *
 *   - nothing is public until the owner publishes it, explicitly
 *   - CONTACT DETAILS ARE OFF by default, and stay off unless switched on
 *   - the page is noindex by default; being findable is a separate decision
 *     from being reachable, and only the owner gets to make it
 *
 * publicProfile() is the single gate. The public page renders what this returns
 * and never touches the stored content directly, so there is one place to audit
 * when the question is "what can a stranger see?".
 */

/** Route segments and product words nobody may take as a handle. Claiming
 * /u/admin or /u/support is impersonation with a nice URL. */
const RESERVED = new Set([
  "admin", "api", "app", "about", "account", "auth", "billing", "blog", "build", "checker",
  "contact", "dashboard", "help", "jobs", "login", "logout", "me", "new", "pricing", "privacy",
  "refund", "root", "security", "settings", "signup", "support", "terms", "u", "user", "users",
  "rolesharp", "staff", "system", "test", "www",
]);

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

export type HandleError = "too_short" | "too_long" | "bad_characters" | "bad_edges" | "reserved";

/** Lowercase, trimmed. Handles are compared in this form so "Jane" and "jane"
 * cannot be two different people. */
export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

export function handleError(raw: string): HandleError | null {
  const handle = normalizeHandle(raw);
  if (handle.length < HANDLE_MIN) return "too_short";
  if (handle.length > HANDLE_MAX) return "too_long";
  // Letters, digits and single separators only: anything else either breaks the
  // URL or invites a lookalike of somebody else's handle.
  if (!/^[a-z0-9-]+$/.test(handle)) return "bad_characters";
  if (handle.startsWith("-") || handle.endsWith("-") || handle.includes("--")) return "bad_edges";
  if (RESERVED.has(handle)) return "reserved";
  return null;
}

export const HANDLE_MESSAGES: Record<HandleError, string> = {
  too_short: `Use at least ${HANDLE_MIN} characters.`,
  too_long: `Use at most ${HANDLE_MAX} characters.`,
  bad_characters: "Letters, numbers and hyphens only.",
  bad_edges: "Cannot start or end with a hyphen, or contain two in a row.",
  reserved: "That one is reserved.",
};

export type PortfolioItem = { title: string; url?: string; description?: string };

export const PORTFOLIO_MAX = 12;

/**
 * Only http(s) links survive. A portfolio is owner-entered text rendered on a
 * public page, so `javascript:` and `data:` URLs are the obvious hazard, and a
 * scheme allowlist is the only version of this check that cannot be talked
 * around. Anything else keeps its title and loses the link.
 */
export function safeUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function cleanPortfolio(items: PortfolioItem[] | null | undefined): PortfolioItem[] {
  return (items ?? [])
    .map((item) => ({
      title: (item.title ?? "").trim().slice(0, 120),
      url: safeUrl(item.url),
      description: (item.description ?? "").trim().slice(0, 400) || undefined,
    }))
    .filter((item) => item.title.length > 0)
    .slice(0, PORTFOLIO_MAX);
}

type Contact = {
  email?: string;
  phone?: string;
  linkedin?: string;
  location?: string;
  links?: string[];
};

type SiteResume = {
  headline: string;
  contact?: Contact;
  summary: string;
  skills: string[];
  experiences: { title: string; company: string; period?: string; bullets: string[] }[];
  education: { degree: string; school: string; year?: string; detail?: string }[];
  projects: { name: string; detail: string }[];
  certifications: string[];
  languages: string[];
  achievements: string[];
};

export type PublicProfile = {
  displayName: string;
  headline: string;
  summary: string;
  /** Empty unless the owner turned contact details on. */
  contact: Contact;
  skills: string[];
  experiences: SiteResume["experiences"];
  education: SiteResume["education"];
  projects: SiteResume["projects"];
  certifications: string[];
  languages: string[];
  achievements: string[];
  /** Owner-entered work links. Cleaned on the way out, never trusted as stored. */
  portfolio: PortfolioItem[];
  /** Owner-entered case studies. Cleaned on the way out, never trusted as stored. */
  caseStudies: CaseStudyItem[];
};

export type SiteOptions = {
  displayName: string;
  showContact: boolean;
  portfolio?: PortfolioItem[] | null;
  caseStudies?: CaseStudyItem[] | null;
};

export function publicProfile(resume: SiteResume, { displayName, showContact, portfolio, caseStudies }: SiteOptions): PublicProfile {
  return {
    displayName,
    headline: resume.headline,
    summary: resume.summary,
    // The whole contact object is rebuilt rather than deleted from, so a field
    // added to the resume shape later is hidden by default instead of leaking
    // the moment somebody extends the type.
    contact: showContact
      ? {
          email: resume.contact?.email,
          phone: resume.contact?.phone,
          linkedin: resume.contact?.linkedin,
          location: resume.contact?.location,
          links: resume.contact?.links,
        }
      : {},
    skills: resume.skills,
    experiences: resume.experiences,
    education: resume.education,
    projects: resume.projects,
    certifications: resume.certifications,
    languages: resume.languages,
    achievements: resume.achievements,
    portfolio: cleanPortfolio(portfolio),
    caseStudies: cleanCaseStudies(caseStudies),
  };
}

export const SITE_DEFAULTS = { showContact: false, indexable: false, published: false } as const;

// ---- Case studies (073_lifecycle_expansion): structured portfolio entries
// with a problem→approach→result arc. Same anti-fabrication rule as the
// resume: metric slots stay bracketed, never invented. ----

export type CaseStudyItem = {
  title: string;
  problem: string;
  approach: string;
  result: string;
  /** Optional proof link (repo, write-up, dashboard). */
  url?: string;
};

export const CASE_STUDY_MAX = 6;

/** Normalizes owner-entered case studies: trims, caps counts and lengths,
 *  drops entries without a title, strips any html-ish input. */
export function cleanCaseStudies(input: unknown): CaseStudyItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, CASE_STUDY_MAX)
    .map((raw) => {
      const item = raw as Partial<CaseStudyItem>;
      const text = (v: unknown, max: number) =>
        typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().slice(0, max) : "";
      return {
        title: text(item.title, 120),
        problem: text(item.problem, 600),
        approach: text(item.approach, 600),
        result: text(item.result, 600),
        url: /^https?:\/\//.test(String(item.url ?? "")) ? String(item.url).slice(0, 500) : undefined,
      };
    })
    .filter((item) => item.title.length > 0);
}
