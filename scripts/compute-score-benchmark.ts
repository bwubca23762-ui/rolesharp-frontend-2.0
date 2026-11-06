import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasDb, q } from "@/lib/db";
import { MINIMUM_SAMPLE, buildBenchmark } from "@/lib/score-benchmark";

/**
 * Recompute content/score-benchmark.json from resumes RoleSharp has scored.
 *
 * Run it against a database that actually has the corpus:
 *   DATABASE_URL=... npx tsx scripts/compute-score-benchmark.ts
 *
 * Until the corpus reaches MINIMUM_SAMPLE the snapshot it writes is still
 * honest — it records the sample size, and lib/score-benchmark.ts suppresses
 * the percentile rather than publishing one from too few documents. Committing
 * an under-sized snapshot is fine and is the point: it says how far off we are.
 */

async function main() {
  if (!hasDb()) {
    console.error("No DATABASE_URL. This script needs the corpus; it will not invent one.");
    process.exitCode = 1;
    return;
  }

  const rows = await q<{ ats_score: number }>(
    `select ats_score from resumes where ats_score is not null and ats_score between 0 and 100`,
  );
  const scores = rows.map((row) => Number(row.ats_score));
  // The date is passed in rather than stamped inside the library so the builder
  // stays pure and its test does not depend on the clock.
  const benchmark = buildBenchmark(scores, new Date().toISOString().slice(0, 10));

  const target = resolve(process.cwd(), "content/score-benchmark.json");
  writeFileSync(target, `${JSON.stringify(benchmark, null, 2)}\n`, "utf8");

  console.log(`Wrote ${target}`);
  console.log(`  sample size: ${benchmark.sampleSize}`);
  if (benchmark.sampleSize < MINIMUM_SAMPLE) {
    console.log(`  below the ${MINIMUM_SAMPLE}-resume minimum, so the checker will still show no percentile.`);
    console.log(`  ${MINIMUM_SAMPLE - benchmark.sampleSize} more scored resumes are needed before the claim can be made.`);
  } else {
    const median = benchmark.atOrBelow.findIndex((share) => share >= 50);
    console.log(`  median score: ${median}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
