import { terms } from "./ats-score";
import type { ResumeContent } from "./types";
import { buildStarGuidance, type StarEntry } from "./interview-star";

// Panel simulator (Phase 4): three interviewer personas ask the SAME
// practice question at three altitudes — screening, probe, strategic.
// Everything here is deterministic (no model call), which keeps the free
// tier free and the cached-TTS rule intact. Follow-ups are templated from
// the resume's own evidence anchors — nothing is invented; a question with
// no anchor gets the honest generic follow-up rather than a fake one.

export type PanelFollowUp = {
  personaId: string;
  name: string;
  altitude: "screening" | "probe" | "strategic";
  question: string;
  /** The evidence anchor the follow-up probes, when one exists. */
  anchorBullet: string | null;
};

const GENERIC_SCREENING = "Give me the two-minute version — what did you actually do, and what came of it?";
const GENERIC_PROBE = "What was the hardest call in that work, and what would you do differently now?";
const GENERIC_STRATEGIC = "Zoom out for me — why did that work matter beyond your own task list?";

export function panelFollowUps(
  question: string,
  content: ResumeContent,
): { followUps: PanelFollowUp[]; star: StarEntry | null } {
  const { entries } = buildStarGuidance(content, [question]);
  let anchor = entries[0] ?? null;
  if (!anchor) {
    // The panel's job is evidence rehearsal: when the question shares no
    // terms with a bullet, drill the candidate's strongest evidenced bullet
    // instead — still the resume's own words, never invented. A resume with
    // no bullets at all gets the honest generic follow-ups.
    const fallbackBullet = content.experiences
      .flatMap((experience) => experience.bullets)
      .map((b) => b.trim())
      .find((b) => b.length >= 8 && /\d/u.test(b))
      ?? content.experiences.flatMap((experience) => experience.bullets).map((b) => b.trim()).find((b) => b.length >= 8)
      ?? null;
    if (fallbackBullet) {
      const experience = content.experiences.find((e) => e.bullets.map((b) => b.trim()).includes(fallbackBullet))!;
      anchor = {
        question,
        experienceTitle: experience.title,
        company: experience.company,
        bullet: fallbackBullet,
        hasMetric: /\d/u.test(fallbackBullet),
        situation: `As ${experience.title} at ${experience.company},`,
        action: fallbackBullet,
        resultPrompt: "Rehearse the full outcome: what changed, over what period, and how it was measured.",
      };
    }
  }
  const bullet = anchor?.bullet ?? null;

  const screening = anchor
    ? `Walk me through "${anchor.experienceTitle}" in two minutes — what did you do, and what came of it?`
    : GENERIC_SCREENING;
  const probe = anchor
    ? anchor.hasMetric
      ? `In "${anchor.experienceTitle}" — what was the hardest call you made, and what did that ${metricWord(anchor.bullet)} actually cost to get?`
      : `In "${anchor.experienceTitle}" — what was the hardest call you made there, and what would you do differently now?`
    : GENERIC_PROBE;
  const strategic = anchor
    ? `Zoom out from "${anchor.experienceTitle}" — why did that work matter to the business, and what would you scale from it next?`
    : GENERIC_STRATEGIC;

  return {
    followUps: [
      { personaId: "recruiter", name: "The screener", altitude: "screening", question: screening, anchorBullet: bullet },
      { personaId: "hiring_manager", name: "The hiring manager", altitude: "probe", question: probe, anchorBullet: bullet },
      { personaId: "executive", name: "The executive", altitude: "strategic", question: strategic, anchorBullet: bullet },
    ],
    star: anchor,
  };
}

function metricWord(bullet: string): string {
  const number = bullet.match(/[\d][\d,.%]*\s*(?:%|k|m|x)?/i)?.[0];
  return number ? `number (${number.trim()})` : "number";
}

// ---- Altitude Adaptation Score (deterministic; no model call) ----
// Three postures, one per persona: screening answers are brief and
// concrete; probe answers are evidence-dense; executive answers are
// outcome-framed. The score rewards the candidate for CHANGING posture
// between personas — giving the same answer three times is the failure
// mode panels actually punish. This is a rehearsal signal, never a
// prediction of what a real panel will decide.

export type AltitudeAnswer = { personaId: string; answer: string };

export type AltitudeReadout = {
  score: number;
  postures: { personaId: string; posture: string; hit: boolean; note: string }[];
  sameAnswerPenalty: boolean;
  coaching: string[];
};

const EXEC_OUTCOME = /\b(impact|outcome|revenue|strategy|strategic|scaled|long-term|roadmap|priorit|delegat|vision|north star|business)\b/i;

export function altitudeAdaptation(answers: AltitudeAnswer[]): AltitudeReadout {
  const byId = new Map(answers.map((a) => [a.personaId, a.answer.trim()]));
  const recruiter = byId.get("recruiter") ?? "";
  const manager = byId.get("hiring_manager") ?? "";
  const executive = byId.get("executive") ?? "";

  // Screening: the two-minute version — long enough to be real, short
  // enough to respect the format. Raw words, not keyword terms: fillers
  // still cost a screener's attention.
  const recruiterWords = recruiter.split(/\s+/).filter(Boolean).length;
  const managerTerms = terms(manager);
  const execTerms = terms(executive);

  // Screening: the two-minute version — long enough to be real, short
  // enough to respect the format.
  const screenHit = recruiterWords >= 20 && recruiterWords <= 120;
  // Probe: evidence-dense — a number, a named tool/system, or resume-backed
  // vocabulary.
  const probeHit = /\d/.test(manager) || managerTerms.length >= 30;
  // Strategic: outcome framing over task detail.
  const execHit = EXEC_OUTCOME.test(executive) && execTerms.length >= 15;

  const postures = [
    { personaId: "recruiter", posture: "brief and concrete", hit: screenHit, note: `${recruiterWords} words — aim for 20–120` },
    { personaId: "hiring_manager", posture: "evidence-dense", hit: probeHit, note: /\d/.test(manager) ? "used a number" : "no number, light vocabulary — bring a metric or named system" },
    { personaId: "executive", posture: "outcome-framed", hit: execHit, note: EXEC_OUTCOME.test(executive) ? "framed as business outcome" : "stayed at task level — name the business impact" },
  ];

  // The same shape three times in a row is the panel failure mode. Compare
  // the first 80 characters — genuinely different altitudes diverge fast.
  const distinct = new Set([recruiter, manager, executive].filter(Boolean).map((a) => a.slice(0, 80).toLowerCase()));
  const sameAnswerPenalty = answers.length >= 3 && distinct.size === 1;

  let score = postures.filter((p) => p.hit).length * 30;
  if (postures.every((p) => p.hit)) score = 100;
  if (sameAnswerPenalty) score = Math.max(0, score - 30);

  const coaching: string[] = [];
  for (const posture of postures) {
    if (!posture.hit) coaching.push(`${posture.personaId === "recruiter" ? "The screener" : posture.personaId === "hiring_manager" ? "The hiring manager" : "The executive"} wanted a ${posture.posture} answer: ${posture.note}.`);
  }
  if (sameAnswerPenalty) coaching.push("You gave near-identical answers at every altitude — panels read that as a rehearsed script. Adjust depth and framing per interviewer.");
  if (coaching.length === 0) coaching.push("You adjusted depth and framing for each interviewer. Hold that flexibility in the real panel.");

  return { score, postures, sameAnswerPenalty, coaching };
}
