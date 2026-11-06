import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { calibrationReport } from "../scripts/job-match-calibration";

test("job-match calibration fixture meets deterministic safety gates", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/job-match-calibration-v1.json", "utf8"));
  const report = calibrationReport(fixture);
  assert.equal(report.counts.impressions, 1000);
  assert.equal(report.counts.explicitDecisions, 250);
  assert.ok((report.ranking.precisionAt10Macro ?? 0) >= 0.8);
  assert.equal(report.gates.zeroHardRuleViolations, true);
  assert.equal(report.gates.thresholdsRemainFixed, true);
});

test("calibration rejects insufficient data", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/job-match-calibration-v1.json", "utf8"));
  fixture.generator.users = 2;
  assert.throws(() => calibrationReport(fixture), /insufficient calibration data/u);
});
