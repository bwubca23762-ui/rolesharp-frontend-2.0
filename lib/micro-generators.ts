import { hasMetric, stem, terms } from "./ats-score";

/**
 * The four standalone generators: summary, bullet points, work experience
 * tailored to a posting, and career summary.
 *
 * Each is deliberately deterministic. They restructure text the user pasted and
 * say what is missing; they never add a fact. That is the same contract the
 * cover letter and interview builders keep in lib/evidence-content.ts, and it
 * is the whole reason to trust the output: a bullet that invents "led a team of
 * 12" is a bullet the user has to defend in an interview.
 *
 * A model pass can be layered on later behind these same signatures. The rule
 * it inherits is the rule here: rewrite what exists, flag what does not, and
 * never fill a gap with something plausible.
 */

/** Openers that spend words without saying what the person actually did. */
const WEAK_OPENERS = [
  /^responsible for\s+/i,
  /^was responsible for\s+/i,
  /^tasked with\s+/i,
  /^duties included\s+/i,
  /^in charge of\s+/i,
  /^helped (?:with|to)\s+/i,
  /^worked on\s+/i,
  /^assisted (?:with|in)\s+/i,
  /^involved in\s+/i,
  /^participated in\s+/i,
];

/** Past-tense verbs that make a bullet read as something delivered. */
const ACTION_VERBS = new Set([
  "led", "built", "shipped", "cut", "grew", "reduced", "increased", "designed", "launched",
  "migrated", "automated", "negotiated", "resolved", "delivered", "owned", "introduced",
  "rebuilt", "scaled", "recovered", "trained", "mentored", "closed", "won", "saved",
  "streamlined", "consolidated", "replaced", "wrote", "created", "developed", "implemented",
  "managed", "coordinated", "analysed", "analyzed", "presented", "supported", "maintained",
  "improved",
]);

/**
 * "Responsible for managing X" strips to "Managing X" — shorter, but no
 * stronger, and the bullet then collects a note telling the user to do by hand
 * a conjugation of a word they already typed. Converting it is a
 * transformation of their text, not a new fact, so it stays inside the
 * contract at the top of this file.
 *
 * Only accepted when the derived form is a verb this file already recognises.
 * Regular verbs convert ("managing" -> "managed", "planning" -> "planned");
 * irregular ones derive nonsense ("running" -> "runned", "leading" ->
 * "leaded"), miss the set, and fall through to the note instead.
 */
function pastTenseOf(word: string): string | null {
  const stem = /^([a-z]+)ing$/i.exec(word)?.[1]?.toLowerCase();
  if (!stem) return null;
  const candidate = `${stem}ed`;
  return ACTION_VERBS.has(candidate) ? candidate : null;
}

const MAX_BULLET_CHARS = 240;

export type BulletReview = {
  original: string;
  improved: string;
  notes: string[];
};

function tidy(line: string): string {
  const clean = line.replace(/^[-*•·]\s*/, "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const capitalised = clean.charAt(0).toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

export function splitInputLines(input: string, limit = 30): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Rewrite each pasted line into evidence form and say what is still missing.
 * The rewrite only ever removes filler and fixes shape. Anything that would
 * require knowing a fact the user did not give becomes a note instead.
 */
export function strengthenBullets(input: string): BulletReview[] {
  return splitInputLines(input).map((original) => {
    let working = original.replace(/^[-*•·]\s*/, "").trim();
    const notes: string[] = [];

    let strippedOpener = false;
    for (const opener of WEAK_OPENERS) {
      if (opener.test(working)) {
        working = working.replace(opener, "");
        strippedOpener = true;
        break;
      }
    }
    if (strippedOpener) notes.push("Removed a filler opener so the bullet starts with what you did.");

    // Applied to every bullet, not only the ones that lost an opener: a line
    // typed straight in as "Managing the reporting process" has the same
    // problem and the same fix.
    const opening = working.split(/\s+/)[0] ?? "";
    const past = pastTenseOf(opening.replace(/[^a-z]/gi, ""));
    if (past) {
      working = past + working.slice(opening.length);
      notes.push("Put the opening verb in the past tense, so the bullet reads as work delivered rather than work ongoing.");
    }

    const improved = tidy(working);
    const firstWord = improved.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";

    if (!ACTION_VERBS.has(firstWord)) {
      // Suggesting a specific verb would mean guessing at the work itself.
      notes.push("Start with a past-tense action verb, for example Led, Built, Cut, Reduced.");
    }
    if (!hasMetric(improved)) {
      notes.push("Add a number: how much, how many, how fast, or over what period.");
    }
    if (improved.length > MAX_BULLET_CHARS) {
      notes.push(`Shorten to one line; this is ${improved.length} characters.`);
    }

    return { original, improved, notes };
  });
}

export type SummaryInput = {
  role: string;
  years?: string;
  skills: string[];
  evidence: string[];
};

/**
 * A summary assembled only from the pieces provided. Every clause is dropped
 * when its input is absent rather than filled with a generic claim, which is
 * why a sparse input produces a short summary instead of a padded one.
 */
export function buildResumeSummary({ role, years, skills, evidence }: SummaryInput): string {
  const opening = [role.trim(), years?.trim() ? `with ${years.trim()} of experience` : ""]
    .filter(Boolean)
    .join(" ");

  const strongest = evidence.map((line) => tidy(line)).filter(Boolean).slice(0, 2);
  const skillList = skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 8);

  return [
    opening ? tidy(opening) : "",
    strongest.join(" "),
    skillList.length ? `Works with ${skillList.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export type CareerRole = { title: string; company: string; period?: string };

/** A multi-role narrative. Same rule: only what was supplied. */
export function buildCareerSummary(roles: CareerRole[], skills: string[]): string {
  const named = roles.filter((role) => role.title.trim() || role.company.trim());
  if (!named.length) return "";

  const current = named[0];
  const earliest = named[named.length - 1];
  const span = named.length > 1 && earliest.period && current.period
    ? ` Career spans ${earliest.period.split(/[-–—]/)[0].trim()} to ${current.period.split(/[-–—]/).pop()?.trim()}.`
    : "";

  const path = named
    .slice(0, 4)
    .map((role) => [role.title.trim(), role.company.trim()].filter(Boolean).join(" at "))
    .filter(Boolean);

  const skillList = skills.map((s) => s.trim()).filter(Boolean).slice(0, 8);

  return [
    `${tidy(current.title.trim() || "Professional").replace(/\.$/, "")}${current.company.trim() ? ` at ${current.company.trim()}` : ""}.`,
    path.length > 1 ? `Previously ${path.slice(1).join(", then ")}.` : "",
    span.trim(),
    skillList.length ? `Core skills: ${skillList.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export type TailoredExperience = {
  ranked: { bullet: string; matched: string[] }[];
  unsupported: string[];
};

/**
 * Words a posting uses to frame a requirement rather than to be one. The
 * shared ATS stoplist keeps them because they matter for keyword coverage
 * scoring, but listing "need" and "track" back to the user as gaps in their
 * experience makes the honest part of this tool look careless.
 */
export const REQUIREMENT_NOISE = new Set([
  "need", "needs", "want", "wants", "must", "should", "looking", "seeking", "ideal", "ideally",
  "plus", "bonus", "nice", "strong", "proven", "track", "record", "experience", "experienced",
  "ability", "able", "skills", "skill", "knowledge", "understanding", "familiar", "familiarity",
  "work", "working", "team", "teams", "role", "roles", "year", "years", "candidate", "candidates",
  "responsibilities", "requirements", "including", "etc", "join", "help", "using", "use",
  // Verbs a posting uses to describe the job ("you will own revenue reporting",
  // "partner with finance"). As a gap, "own" reads as gibberish.
  "own", "owns", "owned", "owning", "partner", "partners", "partnering", "hire", "hiring",
]);

/**
 * Rank the user's own bullets against a pasted posting and name the
 * requirements nothing in their history supports.
 *
 * The gap list is the point. Every competitor writes the missing bullet for
 * you; naming it instead is what keeps the resume defensible in the interview.
 */
export function tailorExperienceToPosting(bullets: string[], posting: string): TailoredExperience {
  const postingTerms = terms(posting);
  const wanted = [...new Set(postingTerms)];

  const ranked = bullets
    .map((line) => tidy(line))
    .filter(Boolean)
    .map((bullet) => {
      // Folded on both sides: a posting asking for "dashboard" against a bullet
      // that says "dashboards" was reported as an unmet requirement, which
      // reads as not having read the bullet. Same call recruiter-feedback and
      // the skill gap already make, same shared stem().
      const bulletTerms = new Set(terms(bullet).map(stem));
      const matched = wanted.filter((term) => bulletTerms.has(stem(term)));
      return { bullet, matched };
    })
    .sort((a, b) => b.matched.length - a.matched.length);

  const covered = new Set(ranked.flatMap((entry) => entry.matched).map(stem));
  const unsupported = wanted
    .filter((term) => !covered.has(stem(term)) && !REQUIREMENT_NOISE.has(term))
    .slice(0, 12);

  return { ranked, unsupported };
}
