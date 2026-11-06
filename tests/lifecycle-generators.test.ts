import assert from "node:assert/strict";
import test from "node:test";
import { buildOnboardingPlan } from "../lib/onboarding-plan";
import { buildReferencePrep } from "../lib/reference-prep";

test("30-60-90 plan weaves in goals and context, and marks what was not provided", () => {
  const full = buildOnboardingPlan({
    role: "Senior Data Analyst",
    company: "Northwind",
    manager: "Priya",
    goals: "Automate reconciliation exceptions\nTrusted weekly numbers pack",
    context: "The monthly close pipeline",
  });
  assert.match(full.output, /Automate reconciliation exceptions/u);
  assert.match(full.output, /The monthly close pipeline/u);
  assert.match(full.output, /Meet Priya/u);
  assert.match(full.output, /Senior Data Analyst at Northwind/u);
  assert.equal(full.warnings.length, 0);
  // Three phases, each with a check-in.
  assert.equal((full.output.match(/Check-in \(day/gu) ?? []).length, 3);

  const bare = buildOnboardingPlan({ role: "Data Analyst", company: "" });
  assert.ok(bare.warnings.length >= 2);
  assert.match(bare.output, /\[the first outcome you were hired for\]/u);
  assert.match(bare.output, /your manager/u);
  // No invented company specifics.
  assert.doesNotMatch(bare.output, /Northwind/u);
});

test("reference prep is claims-only: points and reminders come from the candidate", () => {
  const full = buildReferencePrep({
    referenceName: "Jordan",
    referenceRole: "Analytics Manager",
    relationship: "worked together for two years",
    targetRole: "Senior Data Analyst",
    company: "Fictional Payments",
    points: "The reconciliation tracker the team still uses",
    reminders: "The close automation we shipped in Q2",
  });
  assert.match(full.output, /Hi Jordan,/u);
  assert.match(full.output, /The reconciliation tracker the team still uses/u);
  assert.match(full.output, /as Analytics Manager/u);
  // Consent guard: the note tells the reference to skip anything untrue.
  assert.match(full.output, /say only what you feel is true/u);
  assert.match(full.output, /I did not work with them on that/u);
  assert.equal(full.warnings.length, 0);

  const bare = buildReferencePrep({ referenceName: "", relationship: "", targetRole: "Data Analyst", company: undefined });
  assert.match(bare.output, /Hi there,/u);
  assert.ok(bare.warnings.length >= 1);
  assert.match(bare.output, /\[the first thing you hope they cover\]/u);
});
