/**
 * The resignation letter.
 *
 * Same contract as the other generators: it assembles what the user gave and
 * never invents. That matters more here than anywhere else on the site, because
 * this document goes in a personnel file and can be forwarded to people the
 * writer never meets. A generator that helpfully fills in "for personal
 * reasons", or invents a warm sentence about a manager, is putting words in
 * someone's mouth in the one place they cannot take them back.
 *
 * So: no reason unless one is given, no gratitude unless it is written, and the
 * things a letter cannot know — what the contract says the notice period runs
 * from, whether the last day is a working day — come back as warnings rather
 * than as confident sentences.
 */

export type ResignationTone = "grateful" | "neutral" | "brief";

export type ResignationInput = {
  name: string;
  role: string;
  company: string;
  manager?: string;
  /** The day the letter is handed in, as YYYY-MM-DD. */
  noticeDate?: string;
  /** "2 weeks", "30 days", "3 months" — used to work out the last day. */
  noticePeriod?: string;
  /** Overrides the computed date when the user already knows it. */
  lastDay?: string;
  tone: ResignationTone;
  /** Optional, in the user's own words. Neither is written for them. */
  reason?: string;
  thanks?: string;
  handover?: string;
};

export type ResignationLetter = {
  letter: string;
  /** Things the letter cannot settle and the writer has to check. */
  warnings: string[];
};

const PERIOD = /^\s*(\d{1,3})\s*(day|week|month)s?\s*$/i;

/** "2 weeks" from 2026-08-16 → 2026-08-30. Returns "" when it cannot tell. */
export function lastWorkingDay(noticeDate: string, noticePeriod: string): string {
  const match = PERIOD.exec(noticePeriod);
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(noticeDate)) return "";
  const [year, month, day] = noticeDate.split("-").map(Number);
  // UTC throughout: a local-time Date would shift the day across a timezone
  // boundary, and being one day out on this particular date is not a rounding
  // error, it is a contract breach.
  const start = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(start.getTime())) return "";
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === "day") start.setUTCDate(start.getUTCDate() + amount);
  else if (unit === "week") start.setUTCDate(start.getUTCDate() + amount * 7);
  else {
    // Month arithmetic overflows: 31 January + 1 month is not 3 March. Clamp to
    // the last day of the target month, which is what a notice period means.
    const targetMonth = start.getUTCMonth() + amount;
    const clamped = new Date(Date.UTC(start.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
    start.setUTCDate(Math.min(start.getUTCDate(), clamped));
    start.setUTCMonth(targetMonth);
  }
  return start.toISOString().slice(0, 10);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function readableDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function sentence(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function lines(value: string | undefined): string[] {
  return (value ?? "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 6);
}

export function buildResignationLetter(input: ResignationInput): ResignationLetter {
  const name = input.name.trim();
  const role = input.role.trim();
  const company = input.company.trim();
  const manager = input.manager?.trim();
  const warnings: string[] = [];

  const computed = input.noticeDate && input.noticePeriod
    ? lastWorkingDay(input.noticeDate, input.noticePeriod)
    : "";
  const lastDay = input.lastDay?.trim() || computed;
  if (input.noticePeriod && !computed && !input.lastDay?.trim()) {
    warnings.push(`Could not read "${input.noticePeriod}" as a notice period, so the letter has no last day in it. Write it as a number and a unit, like "2 weeks", "30 days", or "3 months".`);
  }

  const opening = [
    `I am writing to formally resign from my position as ${role || "my current role"}${company ? ` at ${company}` : ""}.`,
    lastDay
      ? `My last working day will be ${readableDate(lastDay)}${input.noticePeriod ? `, in line with my ${input.noticePeriod.trim()} notice period` : ""}.`
      : "",
  ].filter(Boolean).join(" ");

  const reason = input.reason?.trim() ? sentence(input.reason) : "";
  const thanksLines = lines(input.thanks).map(sentence);
  const handover = input.handover?.trim() ? sentence(input.handover) : "";

  const body: string[] = [];
  if (reason) body.push(reason);

  if (input.tone === "grateful") {
    body.push(
      thanksLines.length
        ? `I am grateful for my time at ${company || "the company"}. ${thanksLines.join(" ")}`
        : `I am grateful for my time at ${company || "the company"} and for what I have been able to learn here.`,
    );
  } else if (thanksLines.length) {
    // The user wrote something specific; a neutral or brief letter still says
    // it rather than dropping what they took the trouble to write.
    body.push(thanksLines.join(" "));
  }

  if (input.tone !== "brief") {
    body.push(
      handover
        || "I will do everything I can to hand my work over cleanly before I leave, and I am happy to help with the transition in whatever way is most useful.",
    );
  } else if (handover) {
    body.push(handover);
  }

  const letter = [
    input.noticeDate ? readableDate(input.noticeDate) : "",
    manager ? `Dear ${manager},` : "Dear Manager,",
    opening,
    ...body,
    "Sincerely,",
    name || "[Your name]",
  ].filter(Boolean).join("\n\n");

  if (!lastDay) {
    warnings.push("This letter does not state a last working day. That is the one date the reader needs, so add it before sending.");
  }
  if (computed && !input.lastDay?.trim()) {
    warnings.push(`${readableDate(computed)} is ${input.noticePeriod?.trim()} after the date on the letter. Check your contract — notice often runs from the day the resignation is accepted, not the day it is handed in, and check the date is a working day.`);
  }
  if (!reason) {
    warnings.push("No reason for leaving is given, which is deliberate. You are not usually required to state one, and anything written here can be forwarded to people you will never meet.");
  }
  if (!manager) {
    warnings.push("Addressed to \"Dear Manager\" because no name was given. Use the name of the person who will actually receive it.");
  }

  return { letter, warnings };
}
