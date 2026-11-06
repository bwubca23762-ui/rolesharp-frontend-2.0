// Offer-stage communications (gap report Tier B): thank-you notes and
// salary-negotiation emails, both deterministic builders. No model call —
// the free tier keeps them, and the honesty rule holds because every number
// in the output is one the user typed. The negotiation builder refuses to
// manufacture leverage: with no target above the offer, it produces a
// confirm-and-timeline letter instead of invented negotiation theater.

export type ThankYouInput = {
  interviewer: string;
  role: string;
  company: string;
  topic: string;
  nextStep?: string;
  senderName?: string;
};

export function buildThankYouNote(input: ThankYouInput): string {
  const interviewer = input.interviewer.trim() || "Thank you for the conversation";
  const topic = input.topic.trim() || "the work your team is doing";
  const opener = input.interviewer.trim() ? `Hi ${interviewer},` : "Hello,";
  const lines = [
    opener,
    "",
    `Thank you for the time today — I enjoyed the conversation about ${topic} and left more interested in the ${input.role.trim() || "role"}${input.company.trim() ? ` at ${input.company.trim()}` : ""}, not less.`,
    "",
    `Two things stayed with me: ${topic}, and how directly your team talked about what the role actually involves. That kind of clarity is rare, and it is the kind of team I want to work in.`,
    "",
    "Happy to share anything else that would be useful — work samples, references, or a follow-up call.",
    input.nextStep?.trim()
      ? `Looking forward to the ${input.nextStep.trim()}.`
      : "Looking forward to hearing about the next step whenever you have it — no rush.",
    "",
    "Best regards,",
    input.senderName?.trim() || "",
  ];
  return lines.filter((line, index) => !(line === "" && index === lines.length - 2 && !input.senderName?.trim())).join("\n");
}

export type NegotiationInput = {
  role: string;
  company: string;
  offerBase: number;
  targetBase: number;
  currency: string;
  evidence?: string[];
  senderName?: string;
  recruiter?: string;
};

const fmt = (amount: number, currency: string) => `${currency ? `${currency} ` : ""}${amount.toLocaleString("en-US")}`;

export function buildNegotiationEmail(input: NegotiationInput): { email: string; warnings: string[] } {
  const warnings: string[] = [];
  const recruiter = input.recruiter?.trim() ? `Hi ${input.recruiter.trim()},` : "Hello,";
  const currency = input.currency.trim().toUpperCase();
  const role = input.role.trim() || "role";
  const company = input.company.trim();
  const evidence = (input.evidence ?? []).map((line) => line.trim()).filter(Boolean).slice(0, 3);

  if (!input.targetBase || input.targetBase <= input.offerBase) {
    // No gap, no negotiation theater: confirm, get the timeline in writing,
    // and leave the door open — the honest counterpart.
    warnings.push("Your target is at or below the offer, so this is a confirm-and-clarify letter, not a counter. That is the honest move — don't negotiate against yourself, and don't manufacture a gap.");
    const email = [
      recruiter,
      "",
      `Thank you — I am happy with the ${role} offer${company ? ` from ${company}` : ""} at ${fmt(input.offerBase, currency)}.`,
      "",
      "Two small things before I sign: could you send the full compensation breakdown (base, bonus, equity, and benefits) in writing, and share the timeline for the next steps?",
      "",
      "Looking forward to joining.",
      "",
      "Best regards,",
      input.senderName?.trim() || "",
    ].join("\n");
    return { email, warnings };
  }

  const gap = input.targetBase - input.offerBase;
  const evidenceLines = evidence.length
    ? ["", "For context, the value I bring:", ...evidence.map((line) => `- ${line}`), ""].join("\n")
    : "";
  warnings.push(
    "One number is yours, one number is the market's: if you claim a market range, anchor it on a source you can cite (RoleSharp's salary pages, a posted range, or an offer in hand) — a number with no source reads as bluster.",
    `You are asking for ${fmt(gap, currency)} more. Decide your walk-away number before you send this.`,
  );
  const email = [
    recruiter,
    "",
    `Thank you for the ${role} offer${company ? ` from ${company}` : ""} — I am genuinely excited about the work and the team.`,
    "",
    `I would like to discuss the base salary. The offer is ${fmt(input.offerBase, currency)}; based on the responsibilities we discussed${evidence.length ? " and the results I would bring from day one" : ""}, I was targeting ${fmt(input.targetBase, currency)}.`,
    evidenceLines,
    "If the base is fixed, I am open to a conversation about the whole package — a signing bonus, an earlier review cycle, or equity — but the base is where I see the role's value, and I wanted to be direct rather than accept and regret it quietly.",
    "",
    "I remain enthusiastic and ready to move quickly once we land in the right place.",
    "",
    "Best regards,",
    input.senderName?.trim() || "",
  ].join("\n");
  return { email, warnings };
}
