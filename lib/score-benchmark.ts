import snapshot from "@/content/score-benchmark.json";

/**
 * Where the percentile comes from.
 *
 * It used to come from a lookup table: score >= 90 meant "92nd percentile",
 * score >= 85 meant "84th", and so on down a ladder that nobody measured. The
 * checker then rendered it as "Top 8% risk-adjusted", which reads as a claim
 * about how this resume compares to other people's. It was not one. It was a
 * second presentation of the score with a more flattering unit.
 *
 * Now it is either a real number computed from resumes RoleSharp has actually
 * scored, or it is nothing. `scripts/compute-score-benchmark.ts` writes the
 * snapshot; until it has been run against a corpus of at least MINIMUM_SAMPLE
 * resumes, `benchmarkPercentile` returns null and the checker shows no
 * comparison at all.
 *
 * MINIMUM_SAMPLE is 200 because below that a single percentile point is a
 * couple of documents, and a claim that moves that much on one upload is not
 * worth making. The corpus was 29 resumes when this was written, so the
 * shipped snapshot is empty on purpose.
 */

export type ScoreBenchmark = {
  /** ISO date the snapshot was computed, or "" when there is no snapshot. */
  computedAt: string;
  sampleSize: number;
  /** One entry per score 0-100: the share of the corpus scoring at or below it. */
  atOrBelow: number[];
};

export const MINIMUM_SAMPLE = 200;

export const SCORE_BENCHMARK: ScoreBenchmark = snapshot as ScoreBenchmark;

/**
 * The share of scored resumes this score beats, or null when the corpus is too
 * small to say. Null is a real answer here, not a failure: the checker renders
 * nothing rather than falling back to a number that means nothing.
 */
export function benchmarkPercentile(score: number, benchmark: ScoreBenchmark = SCORE_BENCHMARK): number | null {
  if (benchmark.sampleSize < MINIMUM_SAMPLE) return null;
  if (benchmark.atOrBelow.length !== 101) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const value = benchmark.atOrBelow[clamped];
  return Number.isFinite(value) ? value : null;
}

/** Turn a list of scores into a snapshot. Shared by the script and its test. */
export function buildBenchmark(scores: number[], computedAt: string): ScoreBenchmark {
  const usable = scores.filter((score) => Number.isFinite(score)).map((score) => Math.max(0, Math.min(100, Math.round(score))));
  if (!usable.length) return { computedAt, sampleSize: 0, atOrBelow: [] };

  const counts = new Array<number>(101).fill(0);
  for (const score of usable) counts[score] += 1;

  const atOrBelow = new Array<number>(101).fill(0);
  let running = 0;
  for (let score = 0; score <= 100; score++) {
    running += counts[score];
    atOrBelow[score] = Math.round((running / usable.length) * 100);
  }
  return { computedAt, sampleSize: usable.length, atOrBelow };
}
