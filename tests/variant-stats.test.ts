import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_RELIABLE_SAMPLE,
  responseRate,
  summarizeVariants,
  type VariantOutcomeRow,
} from "../lib/applications/variant-stats";

function row(overrides: Partial<VariantOutcomeRow>): VariantOutcomeRow {
  return {
    label: "Resume A",
    total: 0,
    sent: 0,
    interviews: 0,
    offers: 0,
    rejections: 0,
    lastUsed: null,
    ...overrides,
  };
}

test("response rate counts any movement past applied, and is null before anything is sent", () => {
  assert.equal(responseRate(0, 0, 0, 0), null);
  assert.equal(responseRate(10, 2, 1, 3), 60);
  // Offers and rejections are both replies — they count together.
  assert.equal(responseRate(4, 0, 0, 1), 25);
});

test("small samples are flagged as noise, not ranked", () => {
  const summaries = summarizeVariants([
    row({ label: "Resume A", sent: 3, interviews: 3, rejections: 0 }),
    row({ label: "Resume B", sent: 20, interviews: 2, rejections: 10 }),
  ]);
  const a = summaries.find((s) => s.label === "Resume A")!;
  const b = summaries.find((s) => s.label === "Resume B")!;
  assert.equal(a.sampleTooSmall, true);
  // A perfect 3/3 record must NOT be crowned leader over a larger sample.
  assert.equal(a.leading, false);
  assert.equal(b.sampleTooSmall, false);
  assert.equal(b.responseRate, 60);
  assert.ok(a.responseRate! > b.responseRate!);
});

test("a leader is only declared with two eligible variants and a strict lead", () => {
  const single = summarizeVariants([row({ label: "Solo", sent: 10, interviews: 4, rejections: 2 })]);
  assert.equal(single[0].leading, false);

  const tie = summarizeVariants([
    row({ label: "A", sent: 10, interviews: 2, rejections: 3 }),
    row({ label: "B", sent: 10, interviews: 2, rejections: 3 }),
  ]);
  assert.equal(tie.every((s) => !s.leading), true);

  const leader = summarizeVariants([
    row({ label: "A", sent: 10, interviews: 2, rejections: 3 }),
    row({ label: "B", sent: 10, interviews: 4, rejections: 3 }),
  ]);
  assert.equal(leader.find((s) => s.label === "B")!.leading, true);
  assert.equal(leader.find((s) => s.label === "A")!.leading, false);
});

test("small-sample constant stays honest and counts round to whole percents", () => {
  assert.equal(MIN_RELIABLE_SAMPLE, 5);
  assert.equal(responseRate(3, 1, 0, 0), 33);
});
