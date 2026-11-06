import { terms } from "./ats-score";

// LinkedIn sync (Phase 4): a deterministic diff between the profile the
// candidate pasted into the checker and the resume in their workspace.
// Recruiter search runs on LinkedIn text; the resume holds the evidence.
// The plan says which evidenced terms are missing from LinkedIn, which
// profile terms the resume does not back, and what to fix first. No
// scraping, no LinkedIn API, no model call — pure text diff.

export type LinkedinSyncPlan = {
  headline: { text: string; chars: number; flagged: boolean; note: string };
  missingOnLinkedIn: string[];
  missingOnResume: string[];
  sectionGaps: string[];
};

const HEADLINE_LIMIT = 220;
const CLICHE = /\b(aspiring|seeking opportunities|looking for opportunities|open to work|passionate about)\b/iu;
const MIN_TERM_LENGTH = 3;
const MAX_TERMS_PER_SIDE = 14;

export function linkedinSyncPlan(profileText: string, resumeText: string): LinkedinSyncPlan {
  const profile = profileText.replace(/\r/g, "");
  const lines = profile.split("\n").map((line) => line.trim()).filter(Boolean);
  const headline = lines[0] ?? "";
  const profileTerms = new Set(terms(profile));
  const resumeTerms = new Set(terms(resumeText));

  // Resume-evidenced vocabulary the profile never mentions — recruiters
  // searching LinkedIn will not surface the candidate for these.
  const missingOnLinkedIn: string[] = [];
  for (const term of resumeTerms) {
    if (term.length < MIN_TERM_LENGTH || profileTerms.has(term)) continue;
    if (missingOnLinkedIn.length >= MAX_TERMS_PER_SIDE) break;
    missingOnLinkedIn.push(term);
  }
  missingOnLinkedIn.sort((a, b) => a.localeCompare(b));

  // Profile vocabulary the resume never backs — fine to say on LinkedIn, but
  // the resume should carry evidence for anything the candidate interviews in.
  const missingOnResume: string[] = [];
  for (const term of profileTerms) {
    if (term.length < MIN_TERM_LENGTH || resumeTerms.has(term)) continue;
    if (missingOnResume.length >= MAX_TERMS_PER_SIDE) break;
    missingOnResume.push(term);
  }
  missingOnResume.sort((a, b) => a.localeCompare(b));

  const sectionGaps: string[] = [];
  if (!/\babout\b/iu.test(profile)) sectionGaps.push("No About section — recruiter search reads it; your resume summary should not be pasted in raw.");
  if (!/\bexperience\b/iu.test(profile)) sectionGaps.push("No Experience section detected — without it, LinkedIn cannot match you to titles.");
  if (!/\bskills\b/iu.test(profile)) sectionGaps.push("No Skills section detected — skills are a direct recruiter filter on LinkedIn.");
  if (!/\bducation\b/iu.test(profile)) sectionGaps.push("No Education section detected — some role filters require it.");

  const flagged = CLICHE.test(headline) || headline.length === 0;
  const note = headline.length === 0
    ? "No headline detected — the first line of the paste becomes your headline; paste the full profile starting from the top."
    : CLICHE.test(headline)
      ? "The headline reads as 'seeking', not 'doing' — recruiters filter on function and value, not availability."
      : `${headline.length} of ${HEADLINE_LIMIT} characters used.`;

  return {
    headline: { text: headline.slice(0, 300), chars: headline.length, flagged, note },
    missingOnLinkedIn,
    missingOnResume,
    sectionGaps,
  };
}
