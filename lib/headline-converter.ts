// ── LinkedIn Headline Generator (T10) + CV↔Resume Converter helpers (T8) ──
// Same contract as micro-generators: restructure what the user pasted, never
// invent a fact. Deterministic, no LLM.

const WEAK_HEADLINE_WORDS = [
  "passionate", "enthusiast", "guru", "ninja", "wizard", "rockstar", "evangelist",
  "thought leader", "visionary", "expert in all",
];

export type HeadlineResult = {
  headlines: string[];
  notes: string[];
};

/**
 * Generates LinkedIn headline candidates from the user's current title/role
 * and skills. LinkedIn caps headlines at 220 chars; we aim for 60-120.
 * Formula: [Role] | [Top skill] | [Proof point or value statement]
 */
export function buildHeadlines(input: {
  role: string;
  skills: string;
  achievement?: string;
}): HeadlineResult {
  const role = input.role.trim().replace(/\.$/, "");
  const skills = input.skills.split(/[,;/\n]/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40).slice(0, 5);
  const proof = input.achievement?.trim().replace(/\.$/, "") ?? "";
  const topSkills = skills.slice(0, 3).join(" · ");
  const twoSkills = skills.slice(0, 2).join(" · ");
  const headlines: string[] = [];
  const notes: string[] = [];

  if (role) {
    headlines.push(role);
    if (topSkills) headlines.push(`${role} | ${topSkills}`);
    if (twoSkills) headlines.push(`${role} specializing in ${twoSkills}`);
    if (proof) {
      headlines.push(`${role} — ${proof}`);
      if (topSkills) headlines.push(`${role} | ${topSkills} | ${proof}`);
    }
    // Skills-first variant (for people whose target role differs from their current title)
    if (skills[0]) headlines.push(`${skills[0]} specialist · ${role}${proof ? ` · ${proof}` : ""}`);
  }

  // Scan current headline for weak words.
  const flagged = WEAK_HEADLINE_WORDS.filter((w) =>
    `${role} ${input.skills} ${proof}`.toLowerCase().includes(w),
  );
  if (flagged.length) notes.push(`Consider removing "${flagged.join("\", \"")}" — recruiters search for concrete skills and titles, not buzzwords.`);

  return { headlines: headlines.filter(Boolean).slice(0, 6), notes };
}

// ── CV ↔ Resume converter helpers ──

/** Sections that belong on a CV (academic) but not a standard US resume. */
const CV_ONLY_SECTIONS = [
  "publications", "conference papers", "conference presentations", "poster presentations",
  "grants", "fellowships", "awards and honors", "research interests", "teaching experience",
  "courses taught", "references", "dissertation", "thesis", "academic service",
];

/** Sections a US resume expects that a CV may lack. */
const RESUME_EXPECTED = [
  "summary", "experience", "work experience", "professional experience",
  "education", "skills", "projects",
];

function sectionHeaders(text: string): string[] {
  return text
    .split(/\n/)
    .filter((line) => line.trim().length > 2 && line.trim().length < 60 && line === line.toUpperCase() || /^(publications|education|experience|skills|summary|projects|awards|certifications)/i.test(line.trim()))
    .map((l) => l.trim());
}

export type ConversionPlan = {
  direction: "cv-to-resume" | "resume-to-cv";
  removeSections: string[];
  addSections: string[];
  shortenAdvice: string[];
  keepSections: string[];
};

/**
 * Analyzes a pasted document and produces a conversion plan — what to move,
 * cut, and compress. The user does the rewriting; this is the checklist.
 */
export function buildConversionPlan(docText: string, direction: "cv-to-resume" | "resume-to-cv"): ConversionPlan {
  const headers = sectionHeaders(docText);
  const lower = headers.map((h) => h.toLowerCase());
  const removeSections: string[] = [];
  const addSections: string[] = [];
  const keepSections: string[] = [];
  const shortenAdvice: string[] = [];

  if (direction === "cv-to-resume") {
    for (const sec of CV_ONLY_SECTIONS) {
      const found = lower.find((h) => h.includes(sec));
      if (found) removeSections.push(sec.charAt(0).toUpperCase() + sec.slice(1));
    }
    for (const sec of RESUME_EXPECTED) {
      if (!lower.some((h) => h.includes(sec))) addSections.push(sec.charAt(0).toUpperCase() + sec.slice(1));
    }
    const wordCount = docText.split(/\s+/).length;
    if (wordCount > 600) shortenAdvice.push(`This document is ~${wordCount.toLocaleString()} words. A US resume targets 400–600 words (1 page early-career, 2 pages max with 10+ years). Cut publications to your single most relevant one if you must cite it.`);
    shortenAdvice.push("Convert prose paragraphs under each role into 3–5 bullets starting with an action verb.");
    shortenAdvice.push("Drop the line 'References available upon request' — it is assumed.");
  } else {
    // resume-to-cv: academic format wants MORE detail, not less
    for (const sec of RESUME_EXPECTED) {
      if (!lower.some((h) => h.includes(sec))) addSections.push(sec.charAt(0).toUpperCase() + sec.slice(1));
    }
    addSections.push("Publications", "Conference Presentations");
    shortenAdvice.push("CVs have no page limit — expand each role to include full responsibilities, courses taught, and methods used.");
    shortenAdvice.push("Add sections academic readers expect: Research Interests, Grants, Conference Presentations.");
  }

  for (const h of headers) {
    const hl = h.toLowerCase();
    const removed = removeSections.some((s) => hl.includes(s.toLowerCase()));
    if (!removed && !keepSections.includes(h)) keepSections.push(h);
  }

  return { direction, removeSections, addSections, shortenAdvice, keepSections };
}
