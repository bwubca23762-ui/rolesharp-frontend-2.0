import { hasMetric, stem } from "./ats-score";
import { REQUIREMENT_NOISE } from "./micro-generators";
import { WEAK_PHRASES, extractBullets, type CheckResult } from "./resume-checker";

/**
 * The recruiter read: the same analysis the score already ran, said the way a
 * recruiter would say it out loud.
 *
 * Two rules make this worth showing next to the number.
 *
 * 1. Every observation about the writing cites the line it came from. A note
 *    that cannot point at a line is a note about the document as a whole
 *    (a missing phone number, a layout risk) and says so plainly.
 * 2. A gap is asked about, never asserted. "The posting keeps saying Kubernetes
 *    and I can't find it — have you done it?" is honest. "You lack Kubernetes
 *    experience" is a claim about the person that the document cannot support.
 *
 * Deterministic on purpose. A model pass can rephrase these behind the same
 * signature later; it inherits both rules.
 */

export type RecruiterNote = {
  kind: "strength" | "concern" | "question";
  point: string;
  /** The resume line this refers to, verbatim apart from whitespace and truncation. */
  quote?: string;
};

export type RecruiterFeedback = {
  firstImpression: string;
  notes: RecruiterNote[];
};

const QUOTE_CHARS = 160;

function snip(line: string): string {
  const clean = line.replace(/^[-•*‣▪●○◦·–—]\s+/, "").replace(/\s+/g, " ").trim();
  return clean.length > QUOTE_CHARS ? `${clean.slice(0, QUOTE_CHARS).trimEnd()}…` : clean;
}

function headlineOf(text: string): string {
  return text.split("\n").map((line) => line.trim()).find((line) => line.length >= 3) ?? "";
}

/** Requirements worth asking about: real skills, not the words a posting uses
 * to frame them, and not something the resume already answers in another form. */
function askableGaps(missing: string[], resumeText: string): string[] {
  const present = new Set((resumeText.toLowerCase().match(/[a-z][a-z0-9+#.]{2,}/g) ?? []).map(stem));
  return missing.filter((term) => !REQUIREMENT_NOISE.has(term.toLowerCase()) && !present.has(stem(term)));
}

export function recruiterFeedback(resumeText: string, result: CheckResult): RecruiterFeedback {
  const text = resumeText.replace(/\r/g, "").trim();
  const detected = result.detected;

  // A report or a dissertation chapter gets no recruiter read. Pretending to
  // review a document that is not a resume is how the whole feature loses trust.
  if (result.checks.find((check) => check.id === "document-type")?.status === "fail") {
    return {
      firstImpression: "I could not review this as a resume. What was uploaded reads as a report or document chapter, so there is nothing here I could take to a hiring manager.",
      notes: [],
    };
  }

  const bullets = extractBullets(text);
  const quantified = bullets.filter((bullet) => hasMetric(bullet));
  const unquantified = bullets.filter((bullet) => !hasMetric(bullet));
  const weak = bullets.filter((bullet) => WEAK_PHRASES.some((phrase) => bullet.toLowerCase().includes(phrase)));
  const overlong = bullets.filter((bullet) => bullet.length > 230);

  const seen = [
    headlineOf(text) ? `"${snip(headlineOf(text))}" at the top` : "no name or headline I could pick out at the top",
    detected.experience || detected.projects ? "a work history I can follow" : "no experience or projects section I could pin down",
    bullets.length
      ? `${quantified.length} of ${bullets.length} bullets with a number in them`
      : "no bullets I could pick out",
  ];
  const firstImpression = `Six seconds, nothing read closely — that is the first pass on a stack of applications. In that time I saw ${seen.join(", ")}.`;

  const notes: RecruiterNote[] = [];

  // A real recruiter does not read the same line back to you three times. Each
  // line gets one comment — the most specific one that applies to it.
  const spoken = new Set<string>();
  const claim = (candidates: string[]): string | undefined => {
    const line = candidates.find((candidate) => !spoken.has(candidate));
    if (line) spoken.add(line);
    return line;
  };

  const strongest = claim(quantified);
  if (strongest) {
    notes.push({
      kind: "strength",
      point: "This is where I slowed down. It says what changed and by how much, which is the part of a resume I can actually weigh.",
      quote: snip(strongest),
    });
  }
  if (bullets.length >= 4 && quantified.length / bullets.length >= 0.5) {
    notes.push({
      kind: "strength",
      point: `Half or more of your bullets carry a number — ${quantified.length} of ${bullets.length}. I can build a case for you from this without asking you to fill in blanks first.`,
    });
  }
  if (detected.email && detected.phone) {
    notes.push({ kind: "strength", point: "I can reach you without hunting. Email and phone are both where I look for them." });
  }
  if (detected.skills && result.keywordGroups.some((group) => group.label === "Hard skills" && group.coverage >= 60)) {
    notes.push({ kind: "strength", point: "Your skills section carries most of the terms I would be searching on, so you would surface in my keyword search rather than sitting unread." });
  }

  const phrased = claim(weak);
  if (phrased) {
    notes.push({
      kind: "concern",
      point: "This describes the job you were given, not what you did with it. Every applicant for this role was handed the same responsibility — the difference is the outcome.",
      quote: snip(phrased),
    });
  }
  const sprawling = claim(overlong);
  if (sprawling) {
    notes.push({
      kind: "concern",
      point: `I stop at about two lines per bullet on a first pass. This one runs ${sprawling.length} characters, so whatever is at the end of it I never read.`,
      quote: snip(sprawling),
    });
  }
  // The bullets with no number are asked about below rather than asserted at
  // here; this is the one place the shortfall is worth stating as a whole.
  if (bullets.length >= 3 && quantified.length / bullets.length < 0.5) {
    notes.push({
      kind: "concern",
      point: `${quantified.length} of your ${bullets.length} bullets carry a number. The rest tell me what you were doing, not how it went, and those are the ones I cannot defend when someone asks me why you.`,
    });
  }
  if (!detected.phone) {
    notes.push({ kind: "concern", point: "There is no phone number in the document. When I want to move on someone quickly, that costs a day." });
  }
  if (!detected.linkedin) {
    notes.push({ kind: "concern", point: "No LinkedIn URL. I will look you up regardless — without the link I might find the wrong person and move on." });
  }
  if (!detected.summary) {
    notes.push({ kind: "concern", point: "There is no summary line, so I have to infer the role you want from your last job title. If you are changing direction, I will get that wrong." });
  }
  if (detected.tableRisk) {
    notes.push({ kind: "concern", point: "The layout looks like tables or columns. What I see in the tracking system after it parses is often not what you laid out." });
  }
  if (detected.privacyRisk) {
    notes.push({ kind: "concern", point: "There are personal details here — date of birth, marital status, or an ID number — that I am not allowed to consider and would rather never have seen." });
  }

  for (let asked = 0; asked < 3; asked++) {
    const bullet = claim(unquantified);
    if (!bullet) break;
    notes.push({
      kind: "question",
      point: "How much, how many, how long, or how often? Give me the number you would say out loud if I asked on a call.",
      quote: snip(bullet),
    });
  }
  for (const keyword of askableGaps(result.missingKeywords, text).slice(0, 3)) {
    notes.push({
      kind: "question",
      point: `The target keeps saying "${keyword}" and I cannot find it anywhere in here. Have you done it and left it off, or is it genuinely not your background?`,
    });
  }

  return { firstImpression, notes };
}
