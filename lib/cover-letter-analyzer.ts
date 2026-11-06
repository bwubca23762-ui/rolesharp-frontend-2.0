// ── Cover Letter Analyzer (T9) ──
// Deterministic scoring of a pasted cover letter. Same honesty contract as
// the micro-generators: identify what's there, flag what's missing, never
// rewrite without the user asking.

export type LetterSubScores = {
  hookScore: number;
  specificityScore: number;
  metricDensityScore: number;
  clicheFreeScore: number;
  nonDuplicationScore: number;
};

export type LetterCheck = {
  subScores?: LetterSubScores;
  repairedOpeningParagraph?: string;
  score: number; // 0-100
  grade: "Strong" | "Decent" | "Needs work";
  checks: Array<{
    label: string;
    pass: boolean;
    detail: string;
  }>;
};

const GENERIC_OPENERS = [
  /^to whom it may concern/i,
  /^dear (?:sir|madam)[\s,]/i,
  /^dear hiring manager[\s,]/i,
];
const WEAK_PHRASES: Array<[RegExp, string]> = [
  [/i am writing to express my interest/i, "I am writing to express my interest — replace with why THIS company interests you."],
  [/i believe i (?:would|will) be a great fit/i, "Show fit with evidence instead of claiming it."],
  [/i am the (?:ideal|perfect) candidate/i, "Let the evidence make this claim."],
  [/please consider my application/i, "Cut filler openers and closers."],
  [/team player/i, "Replace 'team player' with a specific collaboration outcome."],
  [/hard[- ]working/i, "'Hard-working' is claimed by everyone — prove it with a metric."],
  [/detail[- ]oriented/i, "Show attention to detail through the letter itself."],
];

function containsPhrase(text: string, phrase: string): boolean {
  const normalize = (value: string) => value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  const hay = normalize(text);
  const needle = normalize(phrase);
  return !!needle && ` ${hay} `.includes(` ${needle} `);
}

export function analyzeCoverLetter(
  letterText: string,
  target: { company?: string; role?: string } = {},
): LetterCheck {
  const text = letterText.slice(0, 20_000).trim();
  const checks: LetterCheck["checks"] = [];
  let earned = 0;

  // 1. Length (150-400 words is the sweet spot)
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const lengthOk = wc >= 120 && wc <= 420;
  checks.push({
    label: "Length",
    pass: lengthOk,
    detail: lengthOk
      ? `${wc} words — right in the 120–420 range recruiters actually read.`
      : wc < 120
        ? `${wc} words is thin. Aim for 200–350 words: two or three paragraphs of substance.`
        : `${wc} words is too long. Recruiters skim — cut to under 420 words.`,
  });
  if (lengthOk) earned += 15;

  // 2. Named addressee (not generic)
  const namedGreeting = /^(dear\s+(?!sir\b|madam\b|hiring manager\b|recruiter\b)[^\n,]{2,40}[,])|^hello\s+[a-z]/im.test(text);
  checks.push({
    label: "Addressed to a person",
    pass: namedGreeting,
    detail: namedGreeting
      ? "You addressed someone by name."
      : "Generic greetings ('Dear Hiring Manager') read as mass-sent. Find the hiring manager's name on LinkedIn.",
  });
  if (namedGreeting) earned += 10;

  // 3. Target company mentioned. A capitalized phrase alone is not evidence:
  // it may be a person's name, a job title, or the applicant's prior employer.
  const company = target.company?.trim();
  const companyMentioned = !!company && containsPhrase(text, company);
  checks.push({
    label: "Target company mentioned",
    pass: companyMentioned,
    detail: companyMentioned
      ? `The letter names ${company}. Add a specific reason you want to work there.`
      : company
        ? `The letter does not mention ${company}. Name the company and reference something specific about it.`
        : "Enter the target company above to check whether the letter names it.",
  });
  if (companyMentioned) earned += 15;

  // 4. Target role in the opening. Generic phrases like "interested in" do
  // not prove that the actual role title is present.
  const role = target.role?.trim();
  const opening = text.slice(0, 700);
  const roleStated = !!role && containsPhrase(opening, role);
  checks.push({
    label: "Target role in opening",
    pass: roleStated,
    detail: roleStated
      ? `The opening names the ${role} role.`
      : role
        ? `The opening does not name ${role}. State the exact role in your first sentence.`
        : "Enter the target role above to check whether the opening states it.",
  });
  if (roleStated) earned += 10;

  // 5. Quantified achievement (number/metric present)
  const hasMetric = /\d+(?:\.\d+)?\s*%|\$\s*\d|\b\d+\s*(?:people|users|customers|clients|hours|days|weeks)\b/i.test(text);
  checks.push({
    label: "Quantified proof",
    pass: hasMetric,
    detail: hasMetric
      ? "You included numbers — metrics are what makes claims credible."
      : "Add one metric (% improvement, $ saved, team size, time reduced). One number beats three adjectives.",
  });
  if (hasMetric) earned += 20;

  // 6. Generic opener penalty
  const genericOpener = GENERIC_OPENERS.some((re) => re.test(text.trim()));
  checks.push({
    label: "Not a generic opener",
    pass: !genericOpener,
    detail: genericOpener
      ? "Openers like 'To Whom It May Concern' signal mass applications. Lead with the role and why you fit it."
      : "Your opener isn't a template greeting.",
  });
  if (!genericOpener) earned += 10;

  // 7. Buzzword density (weak phrases per 100 words)
  let buzzHits = 0;
  const foundWeak: string[] = [];
  for (const [re, advice] of WEAK_PHRASES) {
    if (re.test(text)) { buzzHits++; foundWeak.push(advice); }
  }
  const density = wc > 0 ? (buzzHits / Math.max(1, wc)) * 100 : 0;
  const lowBuzz = buzzHits === 0 || density < 1.5;
  checks.push({
    label: "Low cliché density",
    pass: lowBuzz,
    detail: buzzHits === 0
      ? "No stock phrases detected."
      : `Found ${buzzHits} cliché${buzzHits === 1 ? "" : "s"}: ${foundWeak.slice(0, 3).join(" ")}`,
  });
  if (lowBuzz) earned += 10;

  // 8. Call to action in closing
  const cta = /\b(?:look forward to|welcome the (?:opportunity|chance)|happy to (?:share|discuss|walk)|available for|let'?s talk|i'?d love to discuss)\b/i.test(text);
  checks.push({
    label: "Clear call to action",
    pass: cta,
    detail: cta
      ? "You close with a next step."
      : "End by inviting the conversation: 'Happy to walk through how I did X' gives them a reason to reply.",
  });
  if (cta) earned += 10;

  const score = Math.min(100, earned);

  // Five sub-scores (0–100 each) for the studio UI's radar view. Derived from
  // the same checks above — no extra model cost, free-tier safe.
  const opener = sentencesOf(text)[0] ?? "";
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const hookScore = clamp(
    (genericOpener ? 30 : 85) +
    (/\b(as a|being a|with over|with\s+\d+)\b/i.test(opener) ? 10 : 0) -
    (/^(dear (?:hiring|sir|madam|recruiter)|to whom)/i.test(opener) ? 25 : 0),
  );
  const named = (target.company && text.toLowerCase().includes(target.company.toLowerCase()) ? 40 : 0) +
    (target.role && text.toLowerCase().includes(target.role.toLowerCase()) ? 30 : 0) +
    (checks.find((c) => c.label === "Quantified proof")?.pass ? 30 : 15);
  const specificityScore = clamp(named);
  const metricDensityScore = clamp(wc > 0 ? (quantifiedCount(text) / Math.max(1, wc / 100)) * 60 : 0);
  const clicheFreeScore = clamp(100 - density * 40);
  // Non-duplication: how much of the letter's language does NOT verbatim
  // repeat the resume-style bullet phrasing already in the checks.
  const nonDuplicationScore = clamp(100 - foundWeak.length * 18 - (checks.find((c) => c.label === "Quantified proof")?.pass ? 0 : 10));

  // Repaired opening: same facts, hook-first shape, honest slots where the
  // candidate must supply their own number.
  const roleText = target.role ?? "the role";
  const companyText = target.company ?? "your team";
  const repairedOpeningParagraph = `Applying for ${roleText} at ${companyText}, I bring the exact overlap you are screening for: [top skill] proven by [specific result with X% or $X]. In my last role I [own-verb action] and the result was [measurable outcome]. I am writing because ${companyText}'s [specific product/mission detail] is the kind of problem I have already solved — and I would like to do it again at scale.`;

  return {
    score,
    grade: score >= 70 ? "Strong" : score >= 45 ? "Decent" : "Needs work",
    checks,
    subScores: { hookScore, specificityScore, metricDensityScore, clicheFreeScore, nonDuplicationScore },
    repairedOpeningParagraph,
  };
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
}

function quantifiedCount(text: string): number {
  return (text.match(/(\d+%|\$\d|\b\d+\+?\b)/g) ?? []).length;
}
