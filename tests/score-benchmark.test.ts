import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MINIMUM_SAMPLE, SCORE_BENCHMARK, benchmarkPercentile, buildBenchmark } from "../lib/score-benchmark";
import { checkResume } from "../lib/resume-checker";

function corpus(size: number, at = 60): number[] {
  return Array.from({ length: size }, (_, index) => (index === 0 ? at : (index * 7) % 101));
}

test("a corpus below the minimum produces no percentile at all", () => {
  const small = buildBenchmark(corpus(MINIMUM_SAMPLE - 1), "2026-08-16");
  assert.equal(small.sampleSize, MINIMUM_SAMPLE - 1);
  // The snapshot still records what it saw; it is the claim that is withheld.
  assert.equal(benchmarkPercentile(72, small), null);
});

test("a corpus at the minimum produces a real percentile", () => {
  const enough = buildBenchmark(corpus(MINIMUM_SAMPLE), "2026-08-16");
  const value = benchmarkPercentile(100, enough);
  assert.equal(value, 100, "the top score should be at or above the whole corpus");
  assert.equal(benchmarkPercentile(0, enough)! > 0, true);
});

test("the percentile is monotonic — a better score never ranks lower", () => {
  const benchmark = buildBenchmark(corpus(500), "2026-08-16");
  let previous = -1;
  for (let score = 0; score <= 100; score++) {
    const value = benchmarkPercentile(score, benchmark);
    assert.ok(value !== null);
    assert.ok(value >= previous, `score ${score} ranked below ${score - 1}`);
    previous = value;
  }
});

test("an empty corpus is handled, not divided by", () => {
  const empty = buildBenchmark([], "2026-08-16");
  assert.deepEqual(empty, { computedAt: "2026-08-16", sampleSize: 0, atOrBelow: [] });
  assert.equal(benchmarkPercentile(80, empty), null);
});

test("scores outside 0-100 are clamped rather than indexed out of bounds", () => {
  const benchmark = buildBenchmark(corpus(MINIMUM_SAMPLE), "2026-08-16");
  assert.equal(benchmarkPercentile(-40, benchmark), benchmarkPercentile(0, benchmark));
  assert.equal(benchmarkPercentile(9000, benchmark), benchmarkPercentile(100, benchmark));
});

test("the shipped snapshot is empty, so the checker makes no comparison yet", () => {
  // The corpus was 29 resumes when this was written. Publishing a percentile
  // off 29 documents would be the same invention the hardcoded ladder was.
  assert.ok(SCORE_BENCHMARK.sampleSize < MINIMUM_SAMPLE, "a real snapshot has landed — update this test and the note in ROLESHARP-PROGRESS.md");

  const result = checkResume({
    resumeText: `Priya Raman
Senior Data Analyst | priya.raman@example.com | +91 98765 43210 | Bengaluru

Skills
SQL | Python | Tableau

Experience
Senior Data Analyst | Fictional Payments | 2022 - Present
• Cut monthly reconciliation time from 6 days to 2 days across 14 merchant accounts

Education
B.Sc Statistics | Example University | 2019`,
  });
  assert.equal(result.percentile, null);
  assert.ok(result.score > 0, "the score itself is unaffected");
});

test("the snapshot on disk is shaped the way the reader expects", () => {
  const raw = JSON.parse(readFileSync(new URL("../content/score-benchmark.json", import.meta.url), "utf8"));
  assert.equal(typeof raw.computedAt, "string");
  assert.equal(typeof raw.sampleSize, "number");
  assert.ok(Array.isArray(raw.atOrBelow));
  // Either no snapshot, or one entry per score 0-100. Anything else means the
  // generator wrote something the reader will silently reject.
  assert.ok(raw.atOrBelow.length === 0 || raw.atOrBelow.length === 101, `unexpected bucket count ${raw.atOrBelow.length}`);
});
