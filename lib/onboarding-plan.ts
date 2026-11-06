import { splitInputLines } from "./micro-generators";

// 30-60-90 day plan (Phase 4): a starting scaffold for the first three
// months in a new role. Deterministic and claims-only — the plan weaves in
// exactly the goals and context the user provides, marks anything they did
// not provide as "confirm with your manager", and never invents company
// specifics. It is a structure to bring to the conversation, not a promise.

export type OnboardingPlanInput = {
  role: string;
  company: string;
  manager?: string;
  goals?: string;
  context?: string;
};

export function buildOnboardingPlan(input: OnboardingPlanInput): { output: string; warnings: string[] } {
  const role = input.role.trim() || "the role";
  const company = input.company.trim() || "the company";
  const manager = input.manager?.trim() ?? "";
  const goals = splitInputLines(input.goals ?? "").filter((g) => g.length > 2);
  const context = splitInputLines(input.context ?? "").filter((c) => c.length > 2);

  const warnings: string[] = [];
  if (goals.length === 0) warnings.push("No success goals given — the 60/90 sections use placeholders. Add the outcomes you were hired for.");
  if (!manager) warnings.push("No manager named — the plan says 'your manager' instead.");

  const goalList = goals.length > 0 ? goals : ["[the first outcome you were hired for]", "[the second outcome you were hired for]"];
  const contextList = context.length > 0 ? context : ["[the systems and docs your team lives in]"];

  const lines: string[] = [
    `30-60-90 day plan — ${role}${company ? ` at ${company}` : ""}`,
    "",
    "DAY 1–30 · Learn the landscape",
    `- Meet ${manager || "your manager"} in week 1: ask what a great first 90 days looks like for them, and which stakeholder to know first.`,
    "- Map the stakeholders: one conversation each with the people your work touches. Ask what they wish worked better.",
    `- Learn the landscape: ${contextList[0]}. Read before you propose.`,
    "- Ship one small, safe win end-to-end — a fix, a doc, a cleanup — to learn how work actually moves here.",
    "- Keep a day-one journal: every surprise, acronym, and question. It becomes your onboarding doc for the next person.",
    `Check-in (day 30): "Here is what I have learned, here is where I can add the most first. Does that match what you need?"`,
    "",
    "DAY 31–60 · Own a lane",
    `- Take full ownership of one area connected to your first goal: ${goalList[0]}.`,
    "- Establish the baseline: measure how the thing you own performs today, so day-90 claims have a before.",
    "- Set a weekly feedback loop with your manager — 15 minutes, same slot, no agenda theatre.",
    "- Build one relationship outside your team (a peer team, a customer, a support lane).",
    `- Draft the plan for your second goal: ${goalList[1] ?? "[the second outcome you were hired for]"}.`,
    `Check-in (day 60): "Here is the baseline, here is the plan, here is where I need a decision from you."`,
    "",
    "DAY 61–90 · Deliver and extend",
    `- Land a measurable improvement on ${goalList[0]} and document the before/after.`,
    "- Present a short written review: what you learned in 90 days, what you would do next, where you see waste or risk.",
    "- Propose your next 90 days in one page — priorities, not tasks.",
    "- Make one process permanently better (a checklist, a template, an automation) so your onboarding is not the last thing you improved.",
    `Check-in (day 90): "Here is the result against the baseline, here is what I propose next. Where do you agree and where would you push back?"`,
    "",
    "This scaffold is yours to mark up — the specifics that matter (systems, metrics, stakeholders) are the ones you and your manager name in week 1.",
  ];

  return { output: lines.join("\n"), warnings };
}
