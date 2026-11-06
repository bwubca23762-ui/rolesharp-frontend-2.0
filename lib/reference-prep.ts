import { splitInputLines } from "./micro-generators";

// Reference prep (Phase 4): a one-pager the candidate sends to their
// reference BEFORE the call. Claims-only: every suggested talking point is
// phrased from the candidate's own points and reminders — the prep never
// puts words about shared work in the reference's mouth that the candidate
// did not provide. References do better when they are not surprised.

export type ReferencePrepInput = {
  referenceName: string;
  referenceRole?: string;
  relationship: string;
  targetRole: string;
  company?: string;
  points?: string;
  reminders?: string;
};

export function buildReferencePrep(input: ReferencePrepInput): { output: string; warnings: string[] } {
  const name = input.referenceName.trim() || "there";
  const referenceRole = input.referenceRole?.trim() ?? "";
  const relationship = input.relationship.trim() || "worked together";
  const targetRole = input.targetRole.trim() || "the role";
  const company = input.company?.trim() ?? "";
  const points = splitInputLines(input.points ?? "").filter((p) => p.length > 2);
  const reminders = splitInputLines(input.reminders ?? "").filter((r) => r.length > 2);

  const warnings: string[] = [];
  if (points.length === 0) warnings.push("No talking points given — add the two or three things you hope they cover.");

  const pointLines = points.length > 0
    ? points.map((point, i) => `${i + 1}. ${point} — a one-line example you remember beats a general endorsement.`)
    : ["1. [the first thing you hope they cover] — a one-line example they remember beats a general endorsement."];

  const lines: string[] = [
    `Prep for our reference call — ${targetRole}${company ? ` at ${company}` : ""}`,
    "",
    `Hi ${name},`,
    "",
    `Thank you for agreeing to be my reference. A quick prep so nothing catches you off guard — everything below is just a reminder of work you saw first-hand.`,
    "",
    "THE ROLE I AM INTERVIEWING FOR",
    `${targetRole}${company ? ` at ${company}` : ""}. The interviewer may ask how we ${relationship} and what my work was actually like.${referenceRole ? ` You saw it directly as ${referenceRole}.` : ""}`,
    "",
    "TALKING POINTS THAT WOULD HELP (all your call — say only what you feel is true)",
    ...pointLines,
    "",
    ...(reminders.length > 0 ? ["REMAINDERS OF THE WORK WE DID", ...reminders.map((r) => `- ${r}`), ""] : []),
    "LOGISTICS",
    "- The company usually emails you directly to schedule a 15–20 minute call. If you have not heard anything within a week of my interview, tell me and I will nudge them.",
    "- Skip anything you are unsure about — 'I did not work with them on that' is a perfectly good answer.",
    "",
    "Thank you again. Happy to return the favor for you any time.",
    "",
    "— Sent as prep before the call. Use whatever feels true; drop the rest.",
  ];

  return { output: lines.join("\n"), warnings };
}
