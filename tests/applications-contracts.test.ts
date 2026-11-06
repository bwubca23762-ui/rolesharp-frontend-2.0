import assert from "node:assert/strict";
import test from "node:test";
import {
  ApplicationCreateSchema,
  ApplicationListQuerySchema,
  ApplicationPatchSchema,
  normalizeApplicationStatus,
} from "../lib/applications/contracts";

const validCreate = {
  company: "Northstar Health",
  role: "Product Designer",
  status: "saved",
  jobUrl: "https://jobs.example.test/roles/42",
  jobId: "10000000-0000-4000-8000-000000000001",
  provider: "example",
  providerJobId: "role-42",
  resumeId: "20000000-0000-4000-8000-000000000001",
};

test("application create contract accepts owned-identity-shaped input and rejects unsafe fields", () => {
  assert.equal(ApplicationCreateSchema.safeParse(validCreate).success, true);
  assert.equal(ApplicationCreateSchema.safeParse({ ...validCreate, jobUrl: "javascript:alert(1)" }).success, false);
  assert.equal(ApplicationCreateSchema.safeParse({ ...validCreate, providerJobId: undefined }).success, false);
  assert.equal(ApplicationCreateSchema.safeParse({ ...validCreate, resumeId: "not-a-uuid" }).success, false);
  assert.equal(ApplicationCreateSchema.safeParse({ ...validCreate, userId: "cross-owner" }).success, false);
});

test("application patch contract rejects empty, malformed, and unknown mutations", () => {
  assert.equal(ApplicationPatchSchema.safeParse({ status: "interview" }).success, true);
  assert.equal(ApplicationPatchSchema.safeParse({ resumeId: null, followUpAt: null }).success, true);
  assert.equal(ApplicationPatchSchema.safeParse({}).success, false);
  assert.equal(ApplicationPatchSchema.safeParse({ status: "provider_accepted" }).success, false);
  assert.equal(ApplicationPatchSchema.safeParse({ notes: "x".repeat(2_001) }).success, false);
  assert.equal(ApplicationPatchSchema.safeParse({ operationalStatus: "sent" }).success, false);
});

test("resume variant label accepts the candidate's own short tags and rejects junk", () => {
  assert.equal(ApplicationCreateSchema.safeParse({ ...validCreate, resumeVariantLabel: "Resume A — skills-forward" }).success, true);
  assert.equal(ApplicationPatchSchema.safeParse({ resumeVariantLabel: null }).success, true);
  assert.equal(ApplicationPatchSchema.safeParse({ resumeVariantLabel: "  B  " }).success, true);
  // Empty string is not a label — the client sends null to clear instead.
  assert.equal(ApplicationPatchSchema.safeParse({ resumeVariantLabel: "" }).success, false);
  assert.equal(ApplicationPatchSchema.safeParse({ resumeVariantLabel: "x".repeat(61) }).success, false);
  // 60 chars exactly is the cap.
  assert.equal(ApplicationPatchSchema.safeParse({ resumeVariantLabel: "x".repeat(60) }).success, true);
  // Unknown fields stay rejected.
  assert.equal(ApplicationPatchSchema.safeParse({ variantId: "auto-assigned" }).success, false);
});

test("application pagination and legacy recruiting outcomes remain stable", () => {
  assert.deepEqual(ApplicationListQuerySchema.parse({}), { limit: 50 });
  assert.deepEqual(ApplicationListQuerySchema.parse({ limit: "100", cursor: "opaque" }), {
    limit: 100,
    cursor: "opaque",
  });
  assert.equal(ApplicationListQuerySchema.safeParse({ limit: 101 }).success, false);
  assert.equal(normalizeApplicationStatus("submitted"), "applied");
  assert.equal(normalizeApplicationStatus("screening"), "interview");
  assert.equal(normalizeApplicationStatus("provider_accepted"), "saved");
});
