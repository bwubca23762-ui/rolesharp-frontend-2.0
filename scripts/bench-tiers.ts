import { DATASET } from "./bench-dataset";
import { tailor } from "../lib/tailor";
import { checkResumeContent } from "../lib/resume-checker";
import { FREE_ATS_TARGET, PREMIUM_ATS_TARGET } from "../lib/ats-targets";
import type { GenerateRequest, ResumeContent } from "../lib/types";

type Tier = "free" | "premium";
type Row = {
  id: string;
  role: string;
  tier: Tier;
  score: number;
  target: number;
  pass: boolean;
  keywordCoverage: number;
  metrics: number;
  bullets: number;
  elapsedMs: number;
  breakdown: Record<string, number>;
  model?: string;
  error?: string;
};

function requestFor(item: (typeof DATASET)[number]): GenerateRequest {
  return {
    profile: item.profile,
    roleTitleRaw: item.roleTitle,
    companyNameRaw: item.company,
    jdText: item.jdText,
    template: "basic",
  } as unknown as GenerateRequest;
}

async function runTier(item: (typeof DATASET)[number], tier: Tier): Promise<Row> {
  const premium = tier === "premium";
  const target = premium ? PREMIUM_ATS_TARGET : FREE_ATS_TARGET;
  const started = Date.now();
  try {
    const req = requestFor(item);
    const output = await tailor(req, null, item.company, premium ? "claude" : "gemini", premium);
    const check = checkResumeContent(output.content as ResumeContent, {
      jdText: item.jdText,
      targetRole: item.roleTitle,
      targetCompany: item.company,
    });
    return {
      id: item.id,
      role: item.role,
      tier,
      score: check.score,
      target,
      pass: check.score >= target,
      keywordCoverage: check.keywordGroups[0]?.coverage ?? 0,
      metrics: Number(check.detected.metrics ?? 0),
      bullets: Number(check.detected.realBulletCount ?? 0),
      elapsedMs: Date.now() - started,
      model: output.model,
      breakdown: Object.fromEntries(check.breakdown.map((part) => [part.label, part.score])),
    };
  } catch (error) {
    return {
      id: item.id,
      role: item.role,
      tier,
      score: 0,
      target,
      pass: false,
      keywordCoverage: 0,
      metrics: 0,
      bullets: 0,
      elapsedMs: Date.now() - started,
      breakdown: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function average(rows: Row[], pick: (row: Row) => number): number {
  if (!rows.length) return 0;
  return Math.round((rows.reduce((sum, row) => sum + pick(row), 0) / rows.length) * 10) / 10;
}

async function main() {
  const rows: Row[] = [];
  const onlyId = process.argv.find((arg) => arg.startsWith("--id="))?.slice(5);
  const dataset = onlyId ? DATASET.filter((item) => item.id === onlyId) : DATASET;
  if (!dataset.length) throw new Error(`No benchmark profile found for id=${onlyId}`);
  for (const item of dataset) {
    // The providers are independent, so compare both gates on the same input
    // concurrently while keeping dataset-level concurrency deliberately low.
    const pair = await Promise.all([runTier(item, "free"), runTier(item, "premium")]);
    rows.push(...pair);
    for (const row of pair) {
      console.log(`${row.id.padStart(2, "0")} ${row.tier.padEnd(7)} score=${String(row.score).padStart(3)} target=${row.target} keyword=${String(row.keywordCoverage).padStart(3)}% metrics=${row.metrics}/${row.bullets} time=${(row.elapsedMs / 1000).toFixed(1)}s model=${row.model ?? "unknown"}${row.error ? ` error=${row.error}` : ""}`);
    }
  }

  console.log("\nTIER SUMMARY");
  for (const tier of ["free", "premium"] as const) {
    const tierRows = rows.filter((row) => row.tier === tier && !row.error);
    console.log(JSON.stringify({
      tier,
      runs: tierRows.length,
      averageScore: average(tierRows, (row) => row.score),
      minimumScore: Math.min(...tierRows.map((row) => row.score)),
      maximumScore: Math.max(...tierRows.map((row) => row.score)),
      target: tier === "free" ? FREE_ATS_TARGET : PREMIUM_ATS_TARGET,
      targetPasses: tierRows.filter((row) => row.pass).length,
      averageKeywordCoverage: average(tierRows, (row) => row.keywordCoverage),
      averageMetrics: average(tierRows, (row) => row.metrics),
      averageSeconds: average(tierRows, (row) => row.elapsedMs / 1000),
      averageBreakdown: Object.fromEntries(
        ["Contact", "Resume proof", "Keyword match", "Impact", "ATS safety", "Searchability", "Readability"]
          .map((label) => [label, average(tierRows, (row) => row.breakdown[label] ?? 0)]),
      ),
    }));
  }
  console.log("\nBENCHMARK_JSON");
  console.log(JSON.stringify(rows));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
