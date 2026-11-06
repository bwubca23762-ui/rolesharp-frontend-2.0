import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { deriveOutcome, toCalibrationRows, type OutcomeCandidateRow } from "../lib/job-match/outcomes";
import { reportFromRows } from "../scripts/job-match-calibration";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// Phase 3: the calibration harness learns from what actually happened. The
// integrity rules that protect the synthetic fixture protect real rows too:
// outcome precedence follows the harness's own label order, a match with no
// candidate action stays an impression (silence is never "dismissed"), rank
// is derived from the run's own fit order, and no candidate-identifying
// field leaves the process — the report is aggregates only.

function candidate(overrides: Partial<OutcomeCandidateRow> = {}): OutcomeCandidateRow {
  return {
    user_id: "u1", campaign_id: "c1", canonical_job_key: "provider:x:1",
    fit_score: 80, confidence_score: 70, blockers: [], status: "eligible",
    ranked_at: "2026-08-01T00:00:00.000Z", score_version: 2,
    tracker_status: null, tracker_updated_at: null,
    approval_status: null, approval_at: null,
    ...overrides,
  };
}

test("outcome precedence follows the harness label order: interview > approval > applied > saved", () => {
  // Tracker interview beats everything.
  assert.equal(deriveOutcome(candidate({ tracker_status: "interview" }))?.type, "interview");
  assert.equal(deriveOutcome(candidate({ tracker_status: "offer" }))?.type, "interview");
  // An approval outranks a mere saved row.
  const both = deriveOutcome(candidate({ tracker_status: "saved", approval_status: "consumed" }));
  assert.equal(both?.type, "approved_email");
  assert.equal(deriveOutcome(candidate({ tracker_status: "applied" }))?.type, "manual_applied");
  assert.equal(deriveOutcome(candidate({ tracker_status: "saved" }))?.type, "saved");
  // Rejected/cancelled tracker states are not outcomes — the match itself
  // never became a decision.
  assert.equal(deriveOutcome(candidate({ tracker_status: "rejected" })), undefined);
  assert.equal(deriveOutcome(candidate({ approval_status: "invalidated" })), undefined);
  assert.equal(deriveOutcome(candidate({})), undefined, "silence must never be labelled");
});

test("rows are shaped into the harness contract with derived per-run ranks", () => {
  const rows = toCalibrationRows([
    candidate({ canonical_job_key: "provider:x:3", fit_score: 60 }),
    candidate({ canonical_job_key: "provider:x:1", fit_score: 90 }),
    candidate({ canonical_job_key: "provider:x:2", fit_score: 75 }),
    candidate({ user_id: "u2", campaign_id: "c1", canonical_job_key: "provider:x:9", fit_score: 99 }),
    candidate({ canonical_job_key: "provider:x:4", fit_score: null, ranked_at: "2026-08-02T00:00:00.000Z" }),
  ]);
  assert.equal(rows.length, 4, "unscored rows were never really presented");
  const u1 = rows.filter((r) => r.userId === "u1").sort((a, b) => a.rank - b.rank);
  assert.deepEqual(u1.map((r) => [r.rank, r.fit]), [[1, 90], [2, 75], [3, 60]]);
  // Blocked/explicitly excluded matches carry the flag; the horizon and
  // leakage guards inside the harness validate the rest.
  const blocked = toCalibrationRows([candidate({ status: "excluded", blockers: [{ kind: "x" }] })]);
  assert.equal(blocked[0].blocked, true);
  assert.equal(blocked[0].eligible, false);
});

test("the harness core runs unchanged over real-shaped rows (aggregates only)", () => {
  const candidates = Array.from({ length: 40 }, (_, i) =>
    candidate({
      user_id: `u${i % 4}`, campaign_id: "c1",
      canonical_job_key: `provider:x:${i}`,
      fit_score: 55 + (i % 40), confidence_score: 50 + (i % 45),
      tracker_status: i % 8 === 0 ? "saved" : null,
      ranked_at: "2026-01-15T00:00:00.000Z",
    }));
  const rows = toCalibrationRows(candidates);
  // requireSufficientData=false: a small real sample must REPORT its gates,
  // not throw — the operator reads the gates, the fixture keeps throwing.
  const report = reportFromRows(rows, Date.parse("2026-02-20T00:00:00.000Z"), Date.parse("2026-02-10T00:00:00.000Z"), false);
  assert.equal(report.schemaVersion, 1);
  assert.ok(report.counts.impressions > 0);
  assert.equal(report.gates.sufficientData, false);
  // The synthetic fixture path keeps its strict gate.
  assert.throws(() => reportFromRows(rows, Date.parse("2026-02-20T00:00:00.000Z"), Date.parse("2026-02-10T00:00:00.000Z")), /insufficient calibration data/u);
  assert.ok(source("scripts/job-match-calibration.ts").includes("--from-db"));
});
