import test from "node:test";
import assert from "node:assert/strict";
import { resumeMarketRules, SAFE_DEFAULT_RESUME_RULES, VERIFIED_RESUME_MARKET_RULES } from "../lib/resume-market-rules";
import { resumePhotoPolicy } from "../lib/resume-photo";
import { buildCompanyContext } from "../lib/company-context";

test("verified markets retain sources and review dates", () => {
  for (const [code, rules] of Object.entries(VERIFIED_RESUME_MARKET_RULES)) {
    assert.ok(rules.sources.length > 0, `${code} must have a primary source`);
    assert.match(rules.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("country conventions never force a photo", () => {
  for (const rules of Object.values(VERIFIED_RESUME_MARKET_RULES)) {
    assert.notEqual(resumePhotoPolicy(rules).status, "required");
    assert.notEqual(resumePhotoPolicy(rules).status, "prohibited");
  }
});

test("unsupported markets receive the conservative sourced-data default", () => {
  assert.equal(resumeMarketRules("IN"), SAFE_DEFAULT_RESUME_RULES);
  assert.equal(resumeMarketRules("AE").photoPolicy.status, "optional");
  assert.equal(resumeMarketRules("SG").evidenceLevel, "limited");
});

test("company ATS claims require explicit provenance", () => {
  const unverified = buildCompanyContext({ name: "Example", sector: "Technology", ats_system: "Example ATS" });
  assert.equal(unverified?.atsSystem, undefined);
  assert.equal(unverified?.guidanceSource, "sector_inference");

  const verified = buildCompanyContext({
    name: "Example",
    ats_system: "Example ATS",
    ats_system_source_url: "https://careers.example.test/apply",
    ats_system_verified_at: "2026-07-22T00:00:00Z",
    style_profile: { tone: ["precise"] },
  });
  assert.equal(verified?.atsSystem, "Example ATS");
  assert.equal(verified?.guidanceSource, "catalog_profile");
});
