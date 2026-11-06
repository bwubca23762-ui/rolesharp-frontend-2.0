import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { z } from "zod";
import { canonicalJson } from "../lib/jobs-workflow/canonical-json";

const Fixture = z.object({
  version: z.literal(1), reportAsOf: z.string().datetime(), trainCutoff: z.string().datetime(),
  generator: z.object({ users: z.number().int().min(1), impressionsPerUser: z.number().int().min(1), startAt: z.string().datetime() }).strict(),
}).strict();

type Outcome = { type: "dismissed" | "opened" | "saved" | "manual_applied" | "approved_email" | "interview"; at: string; id: string };
type Row = {
  userId: string; canonicalJobKey: string; rank: number; impressionAt: string;
  fit: number; confidence: number; blocked: boolean; eligible: boolean; outcome?: Outcome;
  versionsAt: { profile: string; job: string; score: string; features: string };
};

const labels: Record<Outcome["type"], number> = {
  dismissed: 0, opened: 1, saved: 2, manual_applied: 3, approved_email: 3, interview: 4,
};
const explicit = new Set<Outcome["type"]>(["dismissed", "saved", "manual_applied", "approved_email", "interview"]);

function expand(fixture: z.infer<typeof Fixture>): Row[] {
  const rows: Row[] = [];
  const start = Date.parse(fixture.generator.startAt);
  for (let user = 0; user < fixture.generator.users; user += 1) {
    for (let rank = 1; rank <= fixture.generator.impressionsPerUser; rank += 1) {
      const impression = new Date(start + user * 86400_000 + rank * 3600_000);
      const fit = Math.max(35, 96 - (rank - 1) * 3 - (user % 3));
      const confidence = Math.min(100, fit + 4 + (rank % 3));
      const outcomeType: Outcome["type"] | undefined = rank === 1 ? "interview"
        : rank === 2 ? "approved_email" : rank === 3 ? "saved"
          : rank === 4 ? "manual_applied" : rank === 5 ? "dismissed" : undefined;
      const versionTime = new Date(impression.getTime() - 86400_000).toISOString();
      rows.push({
        userId: `user-${String(user + 1).padStart(3, "0")}`,
        canonicalJobKey: `provider:fixture:${String(user + 1).padStart(3, "0")}-${String(rank).padStart(2, "0")}`,
        rank, impressionAt: impression.toISOString(), fit, confidence, blocked: false, eligible: true,
        ...(outcomeType ? { outcome: {
          type: outcomeType, at: new Date(impression.getTime() + (rank + 1) * 86400_000).toISOString(),
          id: `event-${String(user + 1).padStart(3, "0")}-${String(rank).padStart(2, "0")}`,
        } } : {}),
        versionsAt: { profile: versionTime, job: versionTime, score: versionTime, features: versionTime },
      });
    }
  }
  return rows;
}

function average(values: readonly number[]): number | null {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6)) : null;
}

function validateRows(rows: readonly Row[], reportAsOf: number) {
  const prohibited = /(?:age|gender|sex|race|ethnicity|religion|disability|marital|message|recipient|resume|token|body)/iu;
  const serializedKeys = Object.keys(rows[0] ?? {}).join(" ");
  if (prohibited.test(serializedKeys)) throw new Error("prohibited calibration field");
  for (const row of rows) {
    const impression = Date.parse(row.impressionAt);
    if (!Number.isFinite(impression) || impression > reportAsOf - 30 * 86400_000) throw new Error("calibration impression violates 30-day horizon");
    for (const timestamp of Object.values(row.versionsAt)) {
      if (Date.parse(timestamp) > impression) throw new Error("calibration feature leakage");
    }
    if (row.outcome && Date.parse(row.outcome.at) > impression + 30 * 86400_000) throw new Error("calibration outcome exceeds observation horizon");
  }
}

function judgedRows(rows: readonly Row[], reportAsOf: number) {
  const best = new Map<string, Row>();
  for (const row of rows) {
    if (!row.eligible || !row.outcome || Date.parse(row.outcome.at) > reportAsOf) continue;
    const key = `${row.userId}\0${row.canonicalJobKey}`;
    const current = best.get(key);
    if (!current || labels[row.outcome.type] > labels[current.outcome!.type]
      || (labels[row.outcome.type] === labels[current.outcome!.type]
        && `${row.outcome.at}:${row.outcome.id}` < `${current.outcome!.at}:${current.outcome!.id}`)) best.set(key, row);
  }
  return [...best.values()].sort((left, right) => left.userId.localeCompare(right.userId) || left.rank - right.rank || left.canonicalJobKey.localeCompare(right.canonicalJobKey));
}

function ndcg(values: readonly number[]) {
  const dcg = (labelsToUse: readonly number[]) => labelsToUse.slice(0, 10).reduce((sum, label, index) => sum + (2 ** label - 1) / Math.log2(index + 2), 0);
  const ideal = [...values].sort((a, b) => b - a);
  const denominator = dcg(ideal);
  return denominator === 0 ? null : dcg(values) / denominator;
}

function grid(rows: readonly Row[], fitValues: readonly number[], confidenceValues: readonly number[], floors: [number, number]) {
  return fitValues.flatMap((fit) => confidenceValues.filter((confidence) => fit >= floors[0] && confidence >= floors[1]).map((confidence) => {
    const byUser = new Map<string, Row[]>();
    rows.filter((row) => row.fit >= fit && row.confidence >= confidence).forEach((row) => byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]));
    const relevantRates: number[] = []; const applicationRates: number[] = [];
    let hardBlocked = 0; let total = 0;
    for (const userRows of byUser.values()) {
      if (!userRows.length) continue;
      relevantRates.push(userRows.filter((row) => labels[row.outcome!.type] >= 2).length / userRows.length);
      applicationRates.push(userRows.filter((row) => labels[row.outcome!.type] >= 3).length / userRows.length);
      hardBlocked += userRows.filter((row) => row.blocked).length; total += userRows.length;
    }
    return {
      fit, confidence, users: byUser.size, candidates: total,
      relevantRate: average(relevantRates), applicationRate: average(applicationRates),
      hardRuleViolationRate: total ? Number((hardBlocked / total).toFixed(6)) : null,
    };
  }));
}

export function calibrationReport(raw: unknown) {
  const fixture = Fixture.parse(raw);
  const reportAsOf = Date.parse(fixture.reportAsOf);
  const cutoff = Date.parse(fixture.trainCutoff);
  const rows = expand(fixture);
  return reportFromRows(rows, reportAsOf, cutoff);
}

/** The harness core over already-expanded rows — shared by the synthetic fixture and the real-outcome (--from-db) path. */
export function reportFromRows(rows: Row[], reportAsOfMs: number, cutoffMs: number, requireSufficientData = true) {
  const reportAsOf = reportAsOfMs;
  validateRows(rows, reportAsOf);
  const cutoff = cutoffMs;
  const judged = judgedRows(rows, reportAsOf);
  const users = [...new Set(rows.map((row) => row.userId))].sort();
  const judgedByUser = new Map<string, Row[]>();
  judged.forEach((row) => judgedByUser.set(row.userId, [...(judgedByUser.get(row.userId) ?? []), row]));
  const precision: number[] = []; const ndcgs: number[] = [];
  let zeroCandidateUsers = 0; let zeroIdcgUsers = 0;
  for (const user of users) {
    const userRows = judgedByUser.get(user) ?? [];
    if (!userRows.length) { zeroCandidateUsers += 1; continue; }
    precision.push(userRows.slice(0, 10).filter((row) => labels[row.outcome!.type] >= 2).length / Math.min(10, userRows.length));
    const value = ndcg(userRows.map((row) => labels[row.outcome!.type]));
    if (value === null) zeroIdcgUsers += 1; else ndcgs.push(value);
  }
  const bands = [[0, 49], [50, 69], [70, 84], [85, 100]].map(([minimum, maximum]) => {
    const perUser: number[] = []; let numerator = 0; let denominator = 0; let excludedUsers = 0;
    for (const user of users) {
      const values = (judgedByUser.get(user) ?? []).filter((row) => row.fit >= minimum! && row.fit <= maximum!);
      if (!values.length) { excludedUsers += 1; continue; }
      const relevant = values.filter((row) => labels[row.outcome!.type] >= 2).length;
      numerator += relevant; denominator += values.length; perUser.push(relevant / values.length);
    }
    return { band: `[${minimum},${maximum}]`, observedRelevanceRate: average(perUser), numerator, denominator, excludedUsers };
  });
  const explicitDecisions = new Set(judged.filter((row) => explicit.has(row.outcome!.type)).map((row) => `${row.userId}\0${row.canonicalJobKey}`)).size;
  const result = {
    schemaVersion: 1, reportAsOf: new Date(reportAsOf).toISOString(), trainCutoff: new Date(cutoff).toISOString(),
    counts: {
      users: users.length, impressions: rows.length, judgedCandidates: judged.length, explicitDecisions,
      trainImpressions: rows.filter((row) => Date.parse(row.impressionAt) < cutoff).length,
      evaluationImpressions: rows.filter((row) => Date.parse(row.impressionAt) >= cutoff).length,
    },
    ranking: { precisionAt10Macro: average(precision), ndcgAt10Macro: average(ndcgs), zeroCandidateUsers, zeroIdcgUsers },
    coverage: {
      usersWithJudgedCandidate: judgedByUser.size, allEvaluatedUsers: users.length,
      userCoverage: Number((judgedByUser.size / users.length).toFixed(6)),
      judgedCandidates: judged.length, eligibleImpressions: rows.filter((row) => row.eligible).length,
      candidateCoverage: Number((judged.length / rows.filter((row) => row.eligible).length).toFixed(6)),
    },
    bands,
    grids: {
      digest: grid(judged, [70, 75, 80, 85, 90], [60, 65, 70, 75, 80, 85, 90], [70, 60]),
      review: grid(judged, [70, 75, 80, 85, 90], [60, 65, 70, 75, 80, 85, 90], [75, 65]),
      automaticSend: grid(judged, [70, 75, 80, 85, 90], [60, 65, 70, 75, 80, 85, 90], [85, 80]),
    },
    gates: {
      sufficientData: rows.length >= 1000 && explicitDecisions >= 200 && users.length >= 50,
      provisionalPrecisionPass: (average(precision) ?? 0) >= 0.8,
      zeroHardRuleViolations: judged.every((row) => !row.blocked),
      thresholdsRemainFixed: true,
    },
  };
  if (requireSufficientData && !result.gates.sufficientData) throw new Error("insufficient calibration data");
  return result;
}

/** Real-outcome mode (--from-db): aggregate only — no candidate-identifying field ever leaves this process. */
async function mainFromDb(limit: number) {
  const { loadOutcomeCandidates, toCalibrationRows } = await import("../lib/job-match/outcomes");
  const rows = toCalibrationRows(await loadOutcomeCandidates(limit));
  const now = Date.now();
  const report = reportFromRows(rows, now, now - 7 * 86400_000, false);
  process.stdout.write(`${canonicalJson({ ...report, source: "real-outcomes", derivedRank: "fit-order-within-user-campaign-run" })}\n`);
}

function main() {
  const fromDbIndex = process.argv.indexOf("--from-db");
  if (fromDbIndex >= 0) {
    const limitArg = process.argv[fromDbIndex + 1];
    const limit = limitArg && /^\d+$/u.test(limitArg) ? Number(limitArg) : 50_000;
    void mainFromDb(limit).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
    return;
  }
  const fixturePath = resolve("tests/fixtures/job-match-calibration-v1.json");
  const expectedPath = resolve("tests/fixtures/job-match-calibration-v1.expected.json");
  const shaPath = resolve("tests/fixtures/job-match-calibration-v1.sha256");
  const bytes = readFileSync(fixturePath);
  const expectedSha = readFileSync(shaPath, "utf8").trim();
  const actualSha = createHash("sha256").update(bytes).digest("hex");
  assert.equal(actualSha, expectedSha, "calibration fixture SHA-256 drift");
  const report = calibrationReport(JSON.parse(bytes.toString("utf8")));
  const stable = `${canonicalJson(report)}\n`;
  if (process.argv.includes("--write-expected")) writeFileSync(expectedPath, stable);
  else assert.equal(stable, readFileSync(expectedPath, "utf8"), "calibration report drift");
  process.stdout.write(stable);
}

if (process.argv[1]?.endsWith("job-match-calibration.ts")) main();
