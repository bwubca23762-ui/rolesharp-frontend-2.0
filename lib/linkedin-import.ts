import { ResumeContent } from "./types";

/**
 * Parse the text of a LinkedIn "Save to PDF" profile export into ResumeContent.
 *
 * Why this exists: 94% of signups never generated a resume. The blank page is
 * the likeliest reason, and every one of those users already has their history
 * written down somewhere. This turns that into a populated builder in one step.
 *
 * Nothing here invents content. Every field is lifted from the export or left
 * empty, which is the same contract the rest of the product makes: we
 * strengthen evidence the user supplied, we never manufacture it. A field we
 * cannot find is reported in `warnings` rather than filled with a plausible
 * guess.
 *
 * The input is whatever /api/check-resume/upload returns for the PDF, which
 * runs `pdftotext -layout`. Layout mode keeps the sidebar (Contact, Top Skills,
 * Languages, Certifications) as its own run of lines rather than interleaving
 * it with the main column, so section headers are reliable anchors. Everything
 * below is anchored on those headers instead of on absolute positions.
 */

export type LinkedinImport = {
  name: string;
  content: ResumeContent;
  /** Sections that were located, for telling the user what actually came across. */
  found: string[];
  /** Sections that were expected and missing, so the UI can prompt rather than silently drop. */
  warnings: string[];
};

const SECTION_HEADERS = [
  "contact",
  "top skills",
  "skills",
  "languages",
  "certifications",
  "honors-awards",
  "honors & awards",
  "summary",
  "experience",
  "education",
  "publications",
  "patents",
  "projects",
  "volunteer experience",
  "volunteering",
  "recommendations",
  "interests",
  "courses",
] as const;

// "January 2022 - Present (2 years 3 months)", "2019 - 2022", "Jun 2019 - Dec 2021"
const DATE_RANGE =
  /^((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?\d{4}\s*[-–—]\s*(present|current|((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?\d{4})/i;
const DURATION_SUFFIX = /\s*\((?:less than a year|\d+\s*(?:year|yr|month|mo)s?(?:\s+\d+\s*(?:month|mo)s?)?)\)\s*$/i;
const PAGE_FOOTER = /^page\s+\d+\s+of\s+\d+$/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const LINKEDIN_URL = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%-]+/i;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;
// A location reads as "City, Region, Country" or "City, Country".
const LOCATION_LINE = /^[\p{L}][\p{L}\s.'-]+(?:,\s*[\p{L}][\p{L}\s.'-]+){1,3}$/u;

function isSectionHeader(line: string) {
  const normalized = line.trim().toLowerCase().replace(/\s+/g, " ");
  return (SECTION_HEADERS as readonly string[]).includes(normalized);
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0 && !PAGE_FOOTER.test(line));
}

/** Group lines under the section header that precedes them. */
function sectionize(lines: string[]): { preamble: string[]; sections: Map<string, string[]> } {
  const sections = new Map<string, string[]>();
  const preamble: string[] = [];
  let current: string | null = null;

  for (const line of lines) {
    if (isSectionHeader(line)) {
      current = line.trim().toLowerCase().replace(/\s+/g, " ");
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current) sections.get(current)!.push(line);
    else preamble.push(line);
  }
  return { preamble, sections };
}

function cleanPeriod(line: string) {
  return line.replace(DURATION_SUFFIX, "").trim();
}

/**
 * Experience entries are anchored on the date range, which is the only line
 * with a reliable shape. Company and title sit above it, description below.
 */
function parseExperience(lines: string[]) {
  const experiences: ResumeContent["experiences"] = [];
  const dateIndexes = lines.map((line, i) => (DATE_RANGE.test(line) ? i : -1)).filter((i) => i >= 0);

  dateIndexes.forEach((dateIndex, order) => {
    const title = lines[dateIndex - 1] ?? "";
    const above = lines[dateIndex - 2] ?? "";
    // Two roles at one employer put another date range two lines up; in that
    // case the company was named once, further back.
    const company = above && !DATE_RANGE.test(above) ? above : "";

    const nextDate = dateIndexes[order + 1] ?? lines.length;
    // The body ends before the company/title lines belonging to the next entry.
    const bodyEnd = nextDate === lines.length ? lines.length : Math.max(dateIndex + 1, nextDate - 2);
    let body = lines.slice(dateIndex + 1, bodyEnd);
    // LinkedIn puts the office location immediately under the dates.
    if (body[0] && LOCATION_LINE.test(body[0]) && !body[0].endsWith(".")) body = body.slice(1);

    const bullets = body
      .map((line) => line.replace(/^[•·▪◦*-]\s*/, "").trim())
      .filter((line) => line.length > 1)
      .slice(0, 50);

    if (!title && !company) return;
    experiences.push({
      title: title.slice(0, 500),
      company: company.slice(0, 500),
      period: cleanPeriod(lines[dateIndex]).slice(0, 500),
      bullets: bullets.map((b) => b.slice(0, 4000)),
    });
  });

  return experiences.slice(0, 50);
}

/**
 * Education is "School" then "Degree, Field — (2015 - 2019)". The middle dot
 * and the parenthesised years are the reliable markers.
 */
function parseEducation(lines: string[]) {
  const education: ResumeContent["education"] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const hasYears = /\((\d{4})\s*[-–—]\s*(\d{4}|present)\)/i.test(line);
    const hasDegreeMarker = /·/.test(line) || hasYears;
    if (!hasDegreeMarker) continue;

    const school = lines[i - 1] ?? "";
    if (!school || isSectionHeader(school)) continue;

    const yearMatch = line.match(/\((\d{4}\s*[-–—]\s*(?:\d{4}|present))\)/i);
    // The separator between degree and dates is a middle dot in LinkedIn's own
    // export, but extraction tools render it as a bullet, a pipe, or a
    // replacement character depending on the font and encoding. Split on any of
    // them, then strip whatever punctuation survived on the end.
    const degree = line
      .split(/[·•∙|·�]/)[0]
      .replace(/\([^)]*\)/g, "")
      .replace(/[\s·•∙|·�,;-]+$/u, "")
      .trim();

    education.push({
      degree: degree.slice(0, 500),
      school: school.slice(0, 500),
      year: yearMatch ? yearMatch[1].replace(/\s+/g, " ").slice(0, 500) : undefined,
      detail: undefined,
    });
  }

  return education.slice(0, 30);
}

const MAIN_SECTIONS = new Set(["summary", "experience", "education"]);

/**
 * Name, headline and location sit between the sidebar and the first main
 * section, with no header of their own. Sectionizing alone would file them
 * under whichever sidebar section came last (usually Honors-Awards), so they
 * are lifted out first and removed from the lines the sections are built from.
 */
function splitIdentity(lines: string[]): { identity: string[]; rest: string[] } {
  const firstMain = lines.findIndex((line) => MAIN_SECTIONS.has(line.trim().toLowerCase().replace(/\s+/g, " ")));
  if (firstMain < 2) return { identity: [], rest: lines };

  const previous = lines[firstMain - 1] ?? "";
  // A location carries commas between words; "Internal award, 2024" does not
  // qualify because the segment after the comma has to start with a letter.
  const hasLocation = LOCATION_LINE.test(previous) && previous.includes(",");
  const take = Math.min(hasLocation ? 3 : 2, firstMain);
  const start = firstMain - take;

  return {
    identity: lines.slice(start, firstMain),
    rest: [...lines.slice(0, start), ...lines.slice(firstMain)],
  };
}

function parseIdentity(identity: string[]) {
  const clean = identity.filter((line) => !EMAIL.test(line) && !LINKEDIN_URL.test(line) && !isSectionHeader(line));
  const last = clean[clean.length - 1] ?? "";
  const hasLocation = clean.length >= 3 && LOCATION_LINE.test(last) && last.includes(",");

  const location = hasLocation ? last : "";
  const rest = hasLocation ? clean.slice(0, -1) : clean;
  const headline = rest.length >= 2 ? rest[rest.length - 1] : "";
  const name = rest.length >= 2 ? rest[rest.length - 2] : (rest[0] ?? "");

  return {
    name: name.slice(0, 120),
    headline: headline.slice(0, 500),
    location: location.slice(0, 500),
  };
}

export function parseLinkedinProfile(text: string): LinkedinImport {
  const allLines = normalizeLines(text);
  const { identity: identityLines, rest } = splitIdentity(allLines);
  const { preamble, sections } = sectionize(rest);
  const found: string[] = [];
  const warnings: string[] = [];

  const identity = parseIdentity(identityLines.length ? identityLines : preamble);
  const contactLines = sections.get("contact") ?? preamble;
  const joined = contactLines.join(" ");

  const summaryLines = sections.get("summary") ?? [];
  const summary = summaryLines.join(" ").trim().slice(0, 4000);

  const experiences = parseExperience(sections.get("experience") ?? []);
  const education = parseEducation(sections.get("education") ?? []);

  const skills = (sections.get("top skills") ?? sections.get("skills") ?? [])
    .filter((line) => line.length <= 80)
    .slice(0, 100)
    .map((s) => s.slice(0, 500));

  const languages = (sections.get("languages") ?? []).slice(0, 50).map((s) => s.slice(0, 500));
  const certifications = (sections.get("certifications") ?? []).slice(0, 100).map((s) => s.slice(0, 500));
  const achievements = (sections.get("honors-awards") ?? sections.get("honors & awards") ?? [])
    .slice(0, 100)
    .map((s) => s.slice(0, 4000));

  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

  if (identity.headline) found.push("headline");
  if (summary) found.push("summary"); else warnings.push("No Summary section found; write one or generate it from your experience.");
  if (experiences.length) found.push(plural(experiences.length, "role", "roles"));
  else warnings.push("No Experience entries were readable. Add them manually.");
  if (education.length) found.push(plural(education.length, "education entry", "education entries"));
  if (skills.length) found.push(plural(skills.length, "skill", "skills"));
  if (languages.length) found.push("languages");
  if (certifications.length) found.push("certifications");
  if (achievements.length) found.push("honors and awards");

  const emailMatch = joined.match(EMAIL);
  const linkedinMatch = joined.match(LINKEDIN_URL);
  const phoneMatch = joined.match(PHONE);

  const draft = {
    headline: identity.headline,
    contact: {
      email: emailMatch ? emailMatch[0].slice(0, 500) : undefined,
      phone: phoneMatch ? phoneMatch[0].trim().slice(0, 500) : undefined,
      linkedin: linkedinMatch ? linkedinMatch[0].slice(0, 500) : undefined,
      location: identity.location || undefined,
      links: [],
    },
    summary,
    skills,
    experiences,
    education,
    projects: [],
    certifications,
    languages,
    achievements,
  };

  // Parsing is best-effort by design, so the schema is the gate: anything that
  // does not validate must not reach the builder as a half-built resume.
  const parsed = ResumeContent.safeParse(draft);
  if (!parsed.success) {
    throw new Error(`linkedin import produced invalid resume content: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }

  return { name: identity.name, content: parsed.data, found, warnings };
}

/** A LinkedIn export is recognisable by its sidebar plus a main section. */
export function looksLikeLinkedinExport(text: string): boolean {
  const lower = text.toLowerCase();
  const hasSidebar = lower.includes("top skills") || /\bcontact\b/.test(lower);
  const hasMain = lower.includes("experience") || lower.includes("summary");
  return hasSidebar && hasMain && LINKEDIN_URL.test(text);
}
