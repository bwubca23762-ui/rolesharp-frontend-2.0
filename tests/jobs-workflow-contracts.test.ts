import assert from "node:assert/strict";
import { test } from "node:test";
import { CampaignCreateInput, CampaignUpdateInput, CareerProfileInput } from "../lib/jobs-workflow/contracts";
import { BLOG_GENERATION_QUEUES, BlogGenerationQueueMessage, MailboxDispatchQueueMessage, NotificationOutboxQueueMessage, WorkflowQueueMessage, assertQueueAllowlist, JOBS_WORKFLOW_QUEUES } from "../lib/jobs-workflow/queues";
import { canonicalCompanyIdentity, canonicalizeOfficialApplicationUrl, providerFallbackJobKey } from "../lib/job-match/canonical-identity";
import { extractApplicationRecipient } from "../lib/job-match/job-extraction";
import { tailorResumeContent } from "../lib/jobs-workflow/packages";
import { readFile } from "node:fs/promises";

const uuid = "10000000-0000-4000-8000-000000000001";

test("workflow queue contracts accept durable identifiers only", () => {
  assert.equal(WorkflowQueueMessage.parse({ workItemId: uuid, version: 1 }).workItemId, uuid);
  assert.throws(() => WorkflowQueueMessage.parse({ workItemId: uuid, version: 1, body: "secret" }));
  assert.throws(() => MailboxDispatchQueueMessage.parse({ attemptId: uuid, version: 1, refreshToken: "secret" }));
  assert.throws(() => NotificationOutboxQueueMessage.parse({ outboxId: uuid, version: 1, recipient: "person@example.test" }));
  assert.equal(BlogGenerationQueueMessage.parse({ generationJobId: uuid, version: 1 }).generationJobId, uuid);
  assert.throws(() => BlogGenerationQueueMessage.parse({ generationJobId: uuid, version: 1, topic: "secret" }));
  assert.doesNotThrow(() => assertQueueAllowlist(["application-package", "jobs-digest", "jobs-match"], JOBS_WORKFLOW_QUEUES));
  assert.doesNotThrow(() => assertQueueAllowlist(["blog-generation"], BLOG_GENERATION_QUEUES));
  assert.throws(() => assertQueueAllowlist(["jobs-match", "resume"], JOBS_WORKFLOW_QUEUES));
});

test("work item completion and failure require a live lease", async () => {
  const claims = await readFile(new URL("../lib/jobs-workflow/claims.ts", import.meta.url), "utf8");
  assert.match(claims, /status='claimed' and lease_owner=\$2 and lease_expires_at>now\(\) returning id/);
  assert.match(claims, /status='claimed' and lease_owner=\$2 and lease_expires_at>now\(\) for update/);
});

test("all supported job markets seed multi-board provider routing", async () => {
  const [markets, migration] = await Promise.all([
    readFile(new URL("../lib/job-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/migrations/018_jobs_all_countries.sql", import.meta.url), "utf8"),
  ]);
  const supportedMarketCount = markets.match(/\{ code: "[A-Z]{2}", name:/gu)?.length ?? 0;
  const providerSeeds = migration.match(/array\['(?:auto|indeed)'\]::text\[\]/gu) ?? [];
  assert.equal(supportedMarketCount, 72);
  assert.equal(providerSeeds.length, supportedMarketCount);
  assert.ok(providerSeeds.every((seed) => seed === "array['auto']::text[]"));
});

test("profile and campaign contracts reject unknown/protected fields and unsafe limits", () => {
  const profile = {
    desiredTitles: ["Product Designer"], skills: [{ name: "Figma", state: "possessed" }],
    relevantExperienceMonths: 60, seniority: { level: "senior", track: "individual" },
    acceptedTracks: ["individual"], locations: ["Tokyo"], remotePolicies: ["remote"],
    authorization: "authorized", workTypes: ["full_time"],
  };
  assert.equal(CareerProfileInput.parse(profile).desiredTitles[0], "Product Designer");
  assert.throws(() => CareerProfileInput.parse({ ...profile, age: 29 }));

  const campaign = {
    mode: "role_apply", authorizationMode: "review_each", profileVersionId: uuid,
    criteria: { desiredTitles: ["Product Designer"] }, timezone: "Asia/Tokyo", dailyTime: "08:00",
    dailyLimit: 5, fitScoreFloor: 85, confidenceScoreFloor: 80, status: "draft",
    consentConfirmed: false,
  };
  assert.equal(CampaignCreateInput.parse(campaign).dailyLimit, 5);
  assert.throws(() => CampaignCreateInput.parse({ ...campaign, dailyLimit: 6 }));
  assert.throws(() => CampaignCreateInput.parse({
    ...campaign,
    authorizationMode: "campaign_policy",
    consentConfirmed: true,
  }));
  assert.throws(() => CampaignCreateInput.parse({ ...campaign, criteria: { ...campaign.criteria, ethnicity: "ignored" } }));
  assert.throws(() => CampaignCreateInput.parse({ ...campaign, timezone: "Mars/Olympus" }));
  assert.equal(CampaignUpdateInput.parse({ dailyLimit: 5 }).dailyLimit, 5);
  assert.equal(CampaignUpdateInput.parse({ dailyLimit: 10 }).dailyLimit, 10);
});

test("URL-first identity is deterministic and strips only versioned tracking fields", () => {
  const left = canonicalizeOfficialApplicationUrl("https://careers.example.com/jobs/42/?utm_source=x&b=2&a=1#apply");
  const right = canonicalizeOfficialApplicationUrl("https://careers.example.com/jobs/42?a=1&b=2");
  assert.ok(left && right);
  assert.equal(left.canonicalJobKey, right.canonicalJobKey);
  assert.equal(left.canonicalUrl, "https://careers.example.com/jobs/42?a=1&b=2");
  assert.equal(canonicalizeOfficialApplicationUrl("https://www.indeed.com/viewjob?jk=42"), null);
  assert.equal(providerFallbackJobKey("indeed", "42"), providerFallbackJobKey("indeed", "42"));
});

test("company automation requires verified identity and recipient must be posting-backed", () => {
  const verified = canonicalCompanyIdentity({ companyUrl: "https://www.example.com/careers", companyName: "Example" });
  const ambiguous = canonicalCompanyIdentity({ companyName: "Example" });
  assert.equal(verified.state, "verified");
  assert.equal(ambiguous.automationBlocked, true);
  assert.equal(extractApplicationRecipient("To apply, email your CV to jobs@example.com.").recipient, "source_backed");
  assert.equal(extractApplicationRecipient("Questions: hello@example.com. Apply through our careers portal.").recipient, "missing");
});

test("recipient extraction enforces the exact posting-backed safety matrix", () => {
  const extract = (description: string) => extractApplicationRecipient(description, {
    canonicalJobKey: `url:${"a".repeat(64)}`,
    sourceUrl: "https://careers.example.com/jobs/1",
    providerNamespace: "fixture",
    providerJobId: "1",
    capturedAt: "2026-07-31T00:00:00.000Z",
    expectedEmployerDomain: "example.com",
  });
  assert.equal(extract("To apply, email your CV to jobs@example.com.").record?.disposition, "auto_eligible");
  const noEmployerDomain = extractApplicationRecipient("To apply, email your CV to jobs@example.com.");
  assert.equal(noEmployerDomain.record?.disposition, "review_required");
  assert.ok(noEmployerDomain.record?.reasons.includes("employer_domain_unavailable"));
  assert.equal(extract("Apply by email: send your CV to jobs@example.com or hiring@example.com.").record?.disposition, "review_required");
  assert.equal(extract("To apply, email your resume to jobs@gmail.com.").record?.disposition, "review_required");
  assert.equal(extract("To apply, email your resume to jobs@unrelated.test.").record?.disposition, "review_required");
  assert.equal(extract("To apply, email your resume to jobs+design@example.com.").record?.disposition, "review_required");
  assert.equal(extract("To apply, email Hiring Team <jobs@example.com> with your CV.").record?.disposition, "review_required");
  assert.equal(extract("To apply, email your resume to jobs@exämple.com.").record?.disposition, "review_required");
  assert.equal(extract("For application support, email support@example.com.").record?.disposition, "manual_only");
  assert.equal(extract("To apply, email your CV to jobs [at] example [dot] com.").record?.disposition, "manual_only");
  assert.equal(extract("To apply, email your CV to jobs@example.").record?.disposition, "manual_only");
  assert.equal(extract("To apply, email your CV to jobs@example.com\r\nBcc: attacker@example.com").record?.disposition, "manual_only");
  assert.equal(extract("Apply through the official ATS form. Privacy: privacy@example.com.").recipient, "missing");
});

test("deterministic tailoring only reorders existing verified resume text", () => {
  const original = {
    headline: "Product designer",
    summary: "Designer focused on evidence.",
    skills: ["Facilitation", "Figma"],
    experiences: [{ title: "Designer", company: "Example", bullets: ["Led workshops", "Built Figma systems"] }],
    education: [], projects: [], certifications: [], languages: [], achievements: [],
  };
  const tailored = tailorResumeContent(original, {
    skillRequirements: [{ text: "Figma", kind: "required" }],
  });
  assert.deepEqual(tailored.skills, ["Figma", "Facilitation"]);
  assert.deepEqual(tailored.experiences[0]?.bullets, ["Built Figma systems", "Led workshops"]);
  assert.deepEqual(new Set(JSON.stringify(tailored).match(/[A-Za-z]+/gu)),
    new Set(JSON.stringify(original).match(/[A-Za-z]+/gu)));
});

test("Auto Apply packages pin source provenance and exact legal versions", async () => {
  const packages = await readFile(new URL("../lib/jobs-workflow/packages.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../db/migrations/051_auto_apply_dispatch_readiness.sql", import.meta.url), "utf8");
  assert.match(packages, /source_body_hash_snapshot,source_url_snapshot/);
  assert.match(packages, /legal_version_snapshot/);
  assert.match(packages, /sourceBodyHashSnapshot: source\.source_body_hash/);
  assert.match(packages, /currentRequiredLegalVersions\(query\)/);
  assert.match(migration, /application_mail_invocations_readiness/);
  assert.match(migration, /auto apply recipient provenance is not posting-backed/);
  assert.match(migration, /package_row\.legal_version_snapshot is distinct from current_legal_snapshot/);
  assert.match(migration, /current legal acceptance is required for auto apply/);
  assert.match(migration, /app_user\.deleting_at is null/);
  assert.match(migration, /role_apply_gmail_send/);
  assert.match(migration, /role_apply_microsoft_send/);
});

test("Auto Apply workers fail closed when the global workflow switch is disabled", async () => {
  const agent = await readFile(new URL("../worker/auto-apply-agent.ts", import.meta.url), "utf8");
  const recommendation = await readFile(new URL("../worker/recommendation-agent.ts", import.meta.url), "utf8");
  const mailbox = await readFile(new URL("../worker/mailbox-dispatch.ts", import.meta.url), "utf8");

  // The superseded standalone unit still refuses to run outright. It is disabled
  // by deploy.sh and kept only as a rollback path, so exiting is harmless there.
  assert.match(mailbox, /if \(!jobsWorkflowConfig\(\)\.workflowsEnabled\) throw new Error\("jobs_workflows_disabled"\)/);

  // The two enabled agents idle instead. Exiting non-zero marked the systemd unit
  // failed, and "workflows disabled" is the NORMAL production state that
  // deploy.sh's own preflight asserts -- so the old guard failed activation and
  // rolled back every release. Failing closed is about attaching no queue
  // consumer, not about the exit code: assert the disabled branch returns before
  // any Worker is constructed.
  for (const [name, source] of [
    ["auto-apply-agent", agent],
    ["recommendation-agent", recommendation],
  ] as const) {
    const guard = source.indexOf("if (!workflowsEnabled)");
    const firstWorker = source.indexOf("new Worker(");
    assert.ok(guard > 0, `${name} must branch on workflowsEnabled`);
    assert.ok(firstWorker > guard, `${name} must return before attaching any queue consumer`);
    assert.doesNotMatch(
      source,
      /throw new Error\("jobs_workflows_disabled"\)/u,
      `${name} must idle when workflows are off, not exit and fail its unit`,
    );
  }
});
