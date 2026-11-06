import test from "node:test";
import assert from "node:assert/strict";
import { buildResignationLetter, lastWorkingDay } from "../lib/resignation-letter";

const BASE = {
  name: "Priya Raman",
  role: "Senior Data Analyst",
  company: "Fictional Payments",
  manager: "Anil Kumar",
  noticeDate: "2026-08-16",
  noticePeriod: "2 weeks",
  tone: "neutral" as const,
};

test("the last working day is counted from the date on the letter", () => {
  assert.equal(lastWorkingDay("2026-08-16", "2 weeks"), "2026-08-30");
  assert.equal(lastWorkingDay("2026-08-16", "30 days"), "2026-09-15");
  assert.equal(lastWorkingDay("2026-08-16", "3 months"), "2026-11-16");
});

test("month arithmetic clamps instead of rolling into the next month", () => {
  // 31 January + 1 month is 28 February, not 3 March.
  assert.equal(lastWorkingDay("2026-01-31", "1 month"), "2026-02-28");
  assert.equal(lastWorkingDay("2028-01-31", "1 month"), "2028-02-29");
  assert.equal(lastWorkingDay("2026-12-31", "2 months"), "2027-02-28");
});

test("an unreadable notice period produces no date rather than a wrong one", () => {
  assert.equal(lastWorkingDay("2026-08-16", "a couple of weeks"), "");
  assert.equal(lastWorkingDay("not a date", "2 weeks"), "");

  const { letter, warnings } = buildResignationLetter({ ...BASE, noticePeriod: "when I feel like it" });
  assert.ok(!/last working day will be/.test(letter));
  assert.ok(warnings.some((warning) => /Could not read/.test(warning)));
  assert.ok(warnings.some((warning) => /does not state a last working day/.test(warning)));
});

test("the letter states the role, the company, and the computed last day", () => {
  const { letter } = buildResignationLetter(BASE);
  assert.match(letter, /16 August 2026/);
  assert.match(letter, /Dear Anil Kumar,/);
  assert.match(letter, /resign from my position as Senior Data Analyst at Fictional Payments\./);
  assert.match(letter, /My last working day will be 30 August 2026, in line with my 2 weeks notice period\./);
  assert.match(letter, /Sincerely,\n\nPriya Raman$/);
});

test("no reason for leaving is invented, and the omission is explained", () => {
  const { letter, warnings } = buildResignationLetter(BASE);
  assert.doesNotMatch(letter, /personal reasons|new opportunity|pursue|career growth|moving on/i);
  assert.ok(warnings.some((warning) => /No reason for leaving is given/.test(warning)));

  const stated = buildResignationLetter({ ...BASE, reason: "I am relocating to Chennai" });
  assert.match(stated.letter, /I am relocating to Chennai\./);
  assert.ok(!stated.warnings.some((warning) => /No reason for leaving/.test(warning)));
});

test("gratitude is only as specific as what the user wrote", () => {
  const generic = buildResignationLetter({ ...BASE, tone: "grateful" });
  // Warm, but it does not claim anything about the manager or the team.
  assert.match(generic.letter, /I am grateful for my time at Fictional Payments/);
  assert.doesNotMatch(generic.letter, /Anil Kumar has been|wonderful team|best manager/i);

  const specific = buildResignationLetter({
    ...BASE,
    tone: "grateful",
    thanks: "The billing team taught me most of what I know about reconciliation",
  });
  assert.match(specific.letter, /The billing team taught me most of what I know about reconciliation\./);
});

test("a brief letter drops the handover paragraph unless one was written", () => {
  const brief = buildResignationLetter({ ...BASE, tone: "brief" });
  assert.doesNotMatch(brief.letter, /hand my work over/);

  const withHandover = buildResignationLetter({ ...BASE, tone: "brief", handover: "I will finish the Q3 reconciliation before I go" });
  assert.match(withHandover.letter, /I will finish the Q3 reconciliation before I go\./);
});

test("the notice-period warning says what the letter cannot know", () => {
  const { warnings } = buildResignationLetter(BASE);
  assert.ok(warnings.some((warning) => /notice often runs from the day the resignation is accepted/.test(warning)));
});

test("an explicit last day wins over the computed one and drops that warning", () => {
  const { letter, warnings } = buildResignationLetter({ ...BASE, lastDay: "2026-09-04" });
  assert.match(letter, /4 September 2026/);
  assert.ok(!warnings.some((warning) => /after the date on the letter/.test(warning)));
});

test("a missing manager name is flagged rather than guessed at", () => {
  const { letter, warnings } = buildResignationLetter({ ...BASE, manager: "" });
  assert.match(letter, /Dear Manager,/);
  assert.ok(warnings.some((warning) => /Use the name of the person/.test(warning)));
});
