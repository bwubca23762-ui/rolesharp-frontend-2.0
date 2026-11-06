import { ResumeContent } from "./types";

/**
 * Parse the plain text of any resume (as extracted by /api/check-resume/upload)
 * into structured ResumeContent.
 *
 * This is the "format-wise" import: whatever template the original file used,
 * the content lands as labelled sections the builder/maker can edit and any
 * RoleSharp template can re-render. Same honesty contract as the LinkedIn
 * importer: nothing is invented, every field is lifted from the text or left
 * empty, and anything expected-but-missing is reported in `warnings`.
 *
 * Generic resumes differ from LinkedIn exports: headers vary wildly ("Work
 * History", "PROFESSIONAL EXPERIENCE"), contact details sit in the preamble,
 * and experience entries may use any bullet character. So header matching is
 * fuzzy, and experience anchoring falls back to pipe/tab separators before the
 * date-range heuristic.
 */

export type ResumeImport = {
  name: string;
  content: ResumeContent;
  /** Sections located, so the UI can say what actually came across. */
  found: string[];
  /** Expected-but-missing sections, so the UI prompts instead of silently dropping. */
  warnings: string[];
};

const SECTION_ALIASES: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: "summary", patterns: [/^(professional\s+)?(summary|profile|objective)(\s*:?$)/i, /^about\s+me\s*:?$/i] },
  { canonical: "skills", patterns: [/^(technical\s+|core\s+|key\s+)?skills(\s*(&\s*(abilities|competencies)))?\s*:?$/i, /^areas?\s+of\s+(expertise|knowledge)\s*:?$/i] },
  { canonical: "experience", patterns: [/^(work|professional|employment|relevant)?\s*(experience|history)\s*:?$/i, /^employment\s*:?$/i, /^career\s+history\s*:?$/i] },
  { canonical: "education", patterns: [/^education(al)?(\s+(background|qualifications))?\s*:?$/i, /^(academic|educational)\s+(background|qualifications?)\s*:?$/i] },
  { canonical: "projects", patterns: [/^(personal\s+|key\s+|selected\s+)?projects?\s*:?$/i] },
  { canonical: "certifications", patterns: [/^certifications?\s*:?$/i, /^(licenses?|licences?)(\s+(&\s*)?(and\s+)?certifications?)?\s*:?$/i, /^courses?\s+(&\s*(and\s+)?)?certifications?\s*:?$/i] },
  { canonical: "languages", patterns: [/^languages?\s*:?$/i] },
  { canonical: "achievements", patterns: [/^(achievements?|accomplishments?|honors?|awards?|honors?\s+(&\s*(and\s+)?)?awards?)\s*:?$/i] },
];

const DATE_RANGE =
  /^((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}\s*[-–—to]+\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:\d{4}|present|current|now|date)/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const LINKEDIN_URL = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%-]+/i;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL = /(?:https?:\/\/)?(?:www\.)?[\w-]+\.[a-z]{2,}\/[^\s,]+/i;
const PAGE_FOOTER = /^page\s+\d+\s+(\of\s+\d+)?$/i;

function canonicalSection(line: string): string | null {
  const normalized = line.trim().replace(/[:•·]\s*$/, "").replace(/\s+/g, " ");
  if (normalized.length > 60 || normalized.length < 4) return null;
  // A header line never ends in sentence punctuation or bullets.
  if (/[.!?,]$/.test(normalized)) return null;
  for (const { canonical, patterns } of SECTION_ALIASES) {
    if (patterns.some((p) => p.test(normalized))) return canonical;
  }
  return null;
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0 && !PAGE_FOOTER.test(line));
}

function sectionize(lines: string[]): { preamble: string[]; sections: Map<string, string[]> } {
  const sections = new Map<string, string[]>();
  const preamble: string[] = [];
  let current: string | null = null;

  for (const line of lines) {
    const canonical = canonicalSection(line);
    if (canonical) {
      current = canonical;
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current) sections.get(current)!.push(line);
    else preamble.push(line);
  }
  return { preamble, sections };
}

function stripBullet(line: string): string {
  return line.replace(/^[•·▪◦‣*\-–—o]\s+/u, "").trim();
}

/**
 * Contact details live in the preamble, either one-per-line or joined on
 * separators. Name and headline are the remaining leading lines: the first
 * non-contact line is the name when a second line reads like a title.
 */
function parseIdentity(preamble: string[]) {
  let name = "";
  let headline = "";
  const locationParts: string[] = [];
  const links: string[] = [];
  let email = "";
  let phone = "";
  let linkedin = "";

  const contactish = (line: string) =>
    EMAIL.test(line) || PHONE.test(line) || LINKEDIN_URL.test(line) || /^[\w\s./-]+:\s*/.test(line);

  const nonContact: string[] = [];
  for (const line of preamble) {
    const emailMatch = line.match(EMAIL);
    if (emailMatch && !email) email = emailMatch[0];
    const phoneMatch = line.match(PHONE);
    if (phoneMatch && !phone && !EMAIL.test(phoneMatch[0])) phone = phoneMatch[0].trim();
    const linkedinMatch = line.match(LINKEDIN_URL);
    if (linkedinMatch && !linkedin) linkedin = linkedinMatch[0];
    for (const url of line.split(/[\s|,]+/)) {
      if (URL.test(url) && !LINKEDIN_URL.test(url) && !links.includes(url) && links.length < 10) links.push(url);
    }
    if (/^[A-Z][\w\s.'-]+,\s*[A-Z]/.test(line) && line.split(",").length >= 2 && !contactish(line)) {
      locationParts.push(line);
      continue;
    }
    nonContact.push(line);
  }

  // The name is the shortest leading line that is not obviously a headline.
  // Headlines contain role words; names rarely exceed four words and carry no verbs.
  const looksLikeTitle = (line: string) =>
    /\b(engineer|developer|manager|analyst|designer|consultant|specialist|architect|administrator|technician|accountant|marketer|recruiter|scientist|lead|senior|junior|head of|director|intern)\b/i.test(line);
  if (nonContact.length >= 2) {
    if (!looksLikeTitle(nonContact[0]) && (looksLikeTitle(nonContact[1]) || nonContact[0].split(/\s+/).length <= 4)) {
      name = nonContact[0];
      headline = nonContact[1];
    } else {
      headline = nonContact[0];
    }
  } else if (nonContact.length === 1) {
    if (looksLikeTitle(nonContact[0])) headline = nonContact[0];
    else name = nonContact[0];
  }

  return {
    name: name.slice(0, 120),
    headline: headline.slice(0, 500),
    location: locationParts.join(", ").slice(0, 500),
    email: email.slice(0, 500),
    phone,
    linkedin: linkedin.slice(0, 500),
    links,
  };
}

function parseExperience(lines: string[]): ResumeContent["experiences"] {
  const experiences: ResumeContent["experiences"] = [];
  const HAS_DATES = /(?:19|20)\d{2}|\bpresent\b|\bcurrent\b/i;

  // Pass 1: one-line entries ("Acme Corp | Senior Engineer | 2022 - Present").
  // Their index and object are remembered so pass 3 can attach the bullets
  // that follow them.
  const ROLE_WORDS =
    /\b(engineer|developer|manager|analyst|designer|consultant|specialist|architect|administrator|technician|accountant|marketer|recruiter|scientist|intern|lead|director|officer|associate|executive|writer|editor)\b/i;
  const classifyParts = (parts: string[]): { title: string; company: string } => {
    const [a, b] = parts;
    // Whichever segment reads like a job title wins; company-first and
    // title-first layouts are both common, so position alone cannot decide.
    if (ROLE_WORDS.test(b) && !ROLE_WORDS.test(a)) return { title: b, company: a };
    if (ROLE_WORDS.test(a) && !ROLE_WORDS.test(b)) return { title: a, company: b };
    return { title: b || a, company: a };
  };
  const entryStarts: number[] = [];
  const inlineByLine = new Map<number, ResumeContent["experiences"][number]>();
  lines.forEach((line, i) => {
    if (!/\s+[|•·]\s+/.test(line)) return;
    const parts = line.split(/\s+[|•·]\s+/).map((p) => stripBullet(p).trim());
    // A trailing segment carrying dates marks this as a complete entry line.
    if (parts.length >= 3 && parts[0] && parts[1] && HAS_DATES.test(parts[parts.length - 1])) {
      const { title, company } = classifyParts(parts);
      const entry: ResumeContent["experiences"][number] = {
        title: title.slice(0, 500),
        company: company.slice(0, 500),
        period: parts.slice(2).join(" - ").slice(0, 500),
        bullets: [],
      };
      experiences.push(entry);
      inlineByLine.set(i, entry);
    }
  });

  // Pass 2: classic entries anchored on a date-range line of their own.
  lines.forEach((line, i) => {
    if (DATE_RANGE.test(line) && !inlineByLine.has(i)) entryStarts.push(i);
  });

  if (entryStarts.length > 0) {
    entryStarts.forEach((startIdx, order) => {
      const end = order + 1 < entryStarts.length ? entryStarts[order + 1] : lines.length;
      const periodLine = lines[startIdx].trim();
      const period = periodLine.slice(0, 500);

      // Title/company sit above the date line. Prefer a pipe/dash separator;
      // otherwise the two preceding lines are company then title (or vice versa).
      let title = "";
      let company = "";
      const above1 = lines[startIdx - 1] ?? "";
      const above2 = startIdx >= 2 ? lines[startIdx - 2] : "";
      const sepSplit = (candidate: string): [string, string] | null => {
        const parts = candidate.split(/\s+[|•·]\s+|\s+[–—]\s+(?=[A-Z])/).map((p) => p.trim());
        return parts.length === 2 && parts.every(Boolean) ? [parts[0], parts[1]] : null;
      };
      if (above1) {
        const sep = sepSplit(above1);
        if (sep) {
          [title, company] = sep;
        } else {
          title = above1;
          if (above2 && !DATE_RANGE.test(above2) && canonicalSection(above2) === null) company = above2;
        }
      }
      // A separator line below the dates wins over guessed ordering
      // ("Senior Engineer | Acme" under the range is common in Europass-style CVs).
      if ((!title || !company) && lines[startIdx + 1]) {
        const sepBelow = sepSplit(lines[startIdx + 1]);
        if (sepBelow) {
          if (!title) title = sepBelow[0];
          if (!company) company = sepBelow[1];
        }
      }

      const bullets = lines
        .slice(startIdx + 1, end)
        .map(stripBullet)
        .filter((line) => line.length > 1 && !DATE_RANGE.test(line))
        .slice(0, 50);

      if (title || company) {
        experiences.push({
          title: title.slice(0, 500),
          company: company.slice(0, 500),
          period,
          bullets: bullets.map((b) => b.slice(0, 4000)),
        });
      }
    });
    return experiences.slice(0, 50);
  }

  // Pass 3: bullets following an inline entry belong to it, up to the next
  // entry line (inline or date-anchored) or the next section header.
  if (inlineByLine.size > 0 && entryStarts.length === 0) {
    const inlineStarts = [...inlineByLine.keys()].sort((a, b) => a - b);
    inlineStarts.forEach((startIdx, order) => {
      const nextEntry = Math.min(
        order + 1 < inlineStarts.length ? inlineStarts[order + 1] : lines.length,
        ...entryStarts.filter((idx) => idx > startIdx),
        lines.length,
      );
      const entry = inlineByLine.get(startIdx)!;
      entry.bullets = lines
        .slice(startIdx + 1, nextEntry)
        .map(stripBullet)
        .filter((line) => line.length > 1)
        .slice(0, 50)
        .map((b) => b.slice(0, 4000));
    });
    return experiences.slice(0, 50);
  }

  // No dates anywhere: fall back to separator lines ("Title | Company | 2020-2022"
  // collapsed onto one line still carries the pipe). Skip lines already consumed.
  lines.forEach((line, i) => {
    if (inlineByLine.has(i)) return;
    const parts = line.split(/\s+[|•·]\s+/).map((p) => stripBullet(p).trim());
    if (parts.length >= 2 && parts[0] && parts[0].length < 100) {
      experiences.push({
        title: parts[0].slice(0, 500),
        company: parts[1].slice(0, 500),
        period: parts.slice(2).join(" - ").slice(0, 500),
        bullets: [],
      });
    }
  });
  return experiences.slice(0, 50);
}

function parseEducation(lines: string[]): ResumeContent["education"] {
  const education: ResumeContent["education"] = [];
  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!line) continue;
    const parts = line.split(/\s+[|•·]\s+|\s+[–—]\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const yearMatch = line.match(/((?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)\d{2}|present))?)/i);
      education.push({
        degree: parts[0].slice(0, 500),
        school: parts[1].slice(0, 500),
        year: yearMatch ? yearMatch[1].slice(0, 500) : undefined,
        detail: undefined,
      });
      continue;
    }
    // Single-line degrees: "B.Tech Computer Science, VIT University, 2020".
    const commaParts = line.split(",").map((p) => p.trim()).filter(Boolean);
    if (commaParts.length >= 2) {
      const yearMatch = line.match(/((?:19|20)\d{2})/);
      education.push({
        degree: commaParts[0].slice(0, 500),
        school: commaParts[1].slice(0, 500),
        year: yearMatch ? yearMatch[1].slice(0, 500) : undefined,
        detail: undefined,
      });
    }
  }
  return education.slice(0, 30);
}

export function parseResumeText(text: string): ResumeImport {
  const lines = normalizeLines(text.slice(0, 200_000));
  const { preamble, sections } = sectionize(lines);
  const identity = parseIdentity(preamble);
  const found: string[] = [];
  const warnings: string[] = [];

  const joinSection = (key: string) =>
    (sections.get(key) ?? []).map(stripBullet).filter(Boolean).join(" ").trim().slice(0, 4000);

  const summary = joinSection("summary");
  const skills = (sections.get("skills") ?? [])
    .flatMap((line) => line.split(/[,;•|]/))
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 80)
    .slice(0, 100);
  const experiences = parseExperience(sections.get("experience") ?? []);
  const education = parseEducation(sections.get("education") ?? []);
  const projects = (sections.get("projects") ?? []).map(stripBullet).map((line) => {
    const [name = "Project", ...rest] = line.split(/\s+[|–—]\s+/).map((p) => p.trim());
    return { name: name.slice(0, 500), detail: (rest.join(" - ") || line).slice(0, 4000) };
  }).filter((p) => p.detail.length > 0).slice(0, 50);
  const certifications = (sections.get("certifications") ?? [])
    .flatMap((line) => (/\n/.test(line) ? [line] : [line]))
    .map(stripBullet)
    .filter((line) => line.length > 2 && line.length < 300)
    .slice(0, 100);
  const languages = (sections.get("languages") ?? [])
    .flatMap((line) => line.split(/[,;]/))
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 50)
    .slice(0, 50);
  const achievements = (sections.get("achievements") ?? []).map(stripBullet).filter(Boolean).slice(0, 100);

  if (summary) found.push("summary"); else warnings.push("No professional summary was found; write one or generate it.");
  if (experiences.length) found.push(`${experiences.length} ${experiences.length === 1 ? "role" : "roles"}`);
  else warnings.push("No work-experience entries were readable. Add them manually.");
  if (education.length) found.push(`${education.length} ${education.length === 1 ? "education entry" : "education entries"}`);
  if (skills.length) found.push(`${skills.length} ${skills.length === 1 ? "skill" : "skills"}`);
  else warnings.push("No skills list was found; add your top skills.");
  if (identity.email) found.push("email");
  if (projects.length) found.push("projects");
  if (certifications.length) found.push("certifications");
  if (languages.length) found.push("languages");
  if (achievements.length) found.push("achievements");

  const draft = {
    headline: identity.headline,
    contact: {
      email: identity.email || undefined,
      phone: identity.phone || undefined,
      linkedin: identity.linkedin || undefined,
      location: identity.location || undefined,
      links: identity.links,
    },
    summary,
    skills,
    experiences,
    education,
    projects,
    certifications,
    languages,
    achievements,
  };

  // Parsing is best-effort; the schema is the gate. Half-built content must not
  // reach the builder.
  const parsed = ResumeContent.safeParse(draft);
  if (!parsed.success) {
    throw new Error(`resume import produced invalid content: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }

  return { name: identity.name, content: parsed.data, found, warnings };
}
