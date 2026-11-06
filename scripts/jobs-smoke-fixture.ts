import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { q, saveResume, withTransaction } from "../lib/db";
import { FEATURE_ACCESS_KEYS, manageFeatureAccess, requestFeatureAccess } from "../lib/feature-access";
import { currentRequiredLegalVersions, recordExactLegalAcceptances } from "../lib/legal";
import { createCareerProfileVersion } from "../lib/jobs-workflow/profiles";
import { createCampaign, upsertApplicationSendPolicy } from "../lib/jobs-workflow/campaigns";
import { jobsWorkflowConfig } from "../lib/jobs-workflow/config";
import { materializeCampaignMatches } from "../lib/jobs-workflow/matches";
import { prepareDailyDigest } from "../lib/jobs-workflow/digests";
import { approveApplicationPackages, prepareApplicationPackage } from "../lib/jobs-workflow/packages";
import { assertFakeTransportIsIsolated } from "../lib/jobs-workflow/local-sink";
import { saveMailboxConnection } from "../lib/mail/connections";

type Fixture = {
  runId: string;
  userId: string;
  digestId: string;
  outboxId: string;
  attemptId: string;
};

const command = process.argv[2];
const runId = process.env.JOBS_SMOKE_RUN_ID ?? "";
const sinkDirectory = resolve(process.env.JOBS_SMOKE_SINK_DIR ?? ".");
const fixturePath = resolve(sinkDirectory, "fixture.json");

function assertIsolatedDatabase(): void {
  assertFakeTransportIsIsolated();
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  const expected = `rolesharp_smoke_${runId.replaceAll("-", "_")}`;
  assert.equal(decodeURIComponent(databaseUrl.pathname.slice(1)), expected, "refusing non-smoke database");
}

async function seed(): Promise<void> {
  assertIsolatedDatabase();
  await q(
    `update feature_flags set enabled=true where name in (
      'jobs_daily_matches','role_apply_prepare','role_apply_gmail_send'
    )`,
  );
  const userId = (await q<{ id: string }>(
    `insert into users(email,password_hash,email_verified_at,credits)
     values($1,'smoke-only',now(),0) returning id`,
    [`smoke-${runId}@example.test`],
  ))[0]?.id;
  assert.ok(userId);

  // The user row is inserted directly above, which skips the signup flow and so
  // records no legal acceptance. enforce_auto_apply_dispatch_readiness (051)
  // checks acceptance at dispatch time and blocks the send -- reported only as an
  // opaque "blocked" attempt several steps later. Accept the current required
  // versions here, the same way email signup does.
  await withTransaction(async (query) => {
    const versions = await currentRequiredLegalVersions(query);
    assert.ok(versions.length > 0, "no required legal versions are published");
    await recordExactLegalAcceptances({
      query,
      userId,
      versionIds: versions.map((version) => version.id),
      surface: "email_signup",
      requestEvidenceDigest: createHash("sha256").update(`smoke-legal-${runId}`).digest("hex"),
    });
  });

  // Per-user feature access is a SECOND gate, independent of the feature_flags
  // rows enabled above. createCampaign, prepareApplicationPackage and the Gmail
  // path all call activeFeatureAccessInTransaction, which throws
  // feature_access_unavailable when the user has no grant row. In production a
  // named staff member approves each grant -- approved_by is NOT NULL and
  // references staff_accounts -- so the fixture seeds an approver and walks the
  // real request/approve path rather than inserting approved rows behind it.
  const approverId = (await q<{ id: string }>(
    `insert into staff_accounts(email,display_name,status,activated_at)
     values($1,'Smoke Approver','active',now()) returning id`,
    [`smoke-approver-${runId}@example.test`],
  ))[0]?.id;
  assert.ok(approverId);
  for (const featureKey of FEATURE_ACCESS_KEYS) {
    await requestFeatureAccess(userId, featureKey);
    await withTransaction((query) => manageFeatureAccess(query, {
      userId,
      featureKey,
      actorKind: "staff",
      actorStaffId: approverId,
      // Uncapped on purpose. A null cap is the "no per-user ceiling" case, and it
      // is the only one that works here: the daily campaign below asks for
      // dailyLimit 10 while the grants table caps daily_cap at 5, so any numeric
      // cap would fail createCampaign with feature_access_daily_cap_exceeded.
      change: { state: "approved", reason: "isolated smoke fixture", dailyCap: null, providerLimit: null },
    }));
  }
  const profile = await createCareerProfileVersion(userId, {
    desiredTitles: ["Product Designer"],
    skills: ["Figma", "User research", "Prototyping", "Analytics"].map((name) => ({
      name, state: "possessed" as const,
    })),
    relevantExperienceMonths: 84,
    seniority: { level: "mid", track: "individual" },
    acceptedTracks: ["individual"],
    locations: ["Remote"],
    remotePolicies: ["remote"],
    authorization: "needs_sponsorship",
    workTypes: ["full_time"],
    compensationFloor: { amountMinor: 10_000_000, currency: "USD", period: "annual" },
  }) as { id: string };
  await upsertApplicationSendPolicy(userId, { timezone: "UTC", userLimit: 5 });
  const connection = await saveMailboxConnection(userId, {
    provider: "google",
    tenant: "google",
    subject: `smoke-subject-${runId}`,
    verifiedSender: `sender-${runId}@example.test`,
    scopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.send"],
    refreshToken: `smoke-refresh-${runId}`,
  }, jobsWorkflowConfig());
  const criteria = {
    desiredTitles: ["Product Designer"],
    mustHaveSkills: ["Figma", "User research", "Prototyping"],
    preferredSkills: ["Analytics"],
    countries: ["US"],
    locations: ["Remote"],
    remotePolicies: ["remote" as const],
    workTypes: ["full_time" as const],
    authorization: "needs_sponsorship" as const,
    compensationFloor: { amountMinor: 10_000_000, currency: "USD", period: "annual" as const },
    excludedCompanies: [],
    blockedSources: [],
  };
  const daily = await createCampaign(userId, {
    mode: "daily_matches",
    authorizationMode: "review_each",
    status: "active",
    profileVersionId: profile.id,
    criteria,
    timezone: "UTC",
    dailyTime: "08:00",
    dailyLimit: 10,
    fitScoreFloor: 70,
    confidenceScoreFloor: 60,
  }) as { id: string };
  const apply = await createCampaign(userId, {
    mode: "role_apply",
    authorizationMode: "review_each",
    status: "active",
    profileVersionId: profile.id,
    criteria,
    timezone: "UTC",
    dailyTime: "08:00",
    dailyLimit: 5,
    fitScoreFloor: 75,
    confidenceScoreFloor: 65,
    pinnedConnectionId: connection.id,
    consentConfirmed: false,
  }) as { id: string };
  await saveResume({
    id: randomUUID(),
    userId,
    name: "Smoke Candidate",
    atsScore: 92,
    genMs: 1,
    content: {
      headline: "Product Designer",
      summary: "Synthetic smoke fixture.",
      skills: ["Figma", "User research", "Prototyping", "Analytics"],
      experiences: [{
        title: "Product Designer",
        company: "Smoke Studio",
        period: "2019–2026",
        bullets: ["Built design systems", "Facilitated research"],
      }],
      education: [], projects: [], certifications: [], languages: [], achievements: [],
    },
  });
  const sourceUrl = `https://careers.smoke-${runId}.example.test/jobs/product-designer`;
  await q(
    `insert into jobs(provider,external_id,title,company,country_code,location,is_remote,job_type,
       description,apply_url,source_url,company_url,salary_min,salary_max,salary_currency,
       salary_interval,date_posted,last_seen_at,expires_at,metadata)
     values('rolesharp-smoke',$1,'Product Designer','Smoke Company','US','Remote',true,'full_time',
       $2,$3,$3,$4,120000,150000,'USD','annual',now()-interval '1 day',now(),
       now()+interval '20 days','{}')`,
    [runId,
      `Required skills: Figma, user research, and prototyping. 5 years of experience. Preferred skill: analytics. Visa sponsorship is available. To apply, email your CV to jobs-${runId}@example.test.`,
      sourceUrl, `https://smoke-${runId}.example.test`],
  );
  assert.ok((await materializeCampaignMatches(daily.id)).created >= 1);
  assert.ok((await materializeCampaignMatches(apply.id)).created >= 1);
  const digest = await prepareDailyDigest(daily.id, async () => undefined);
  assert.ok(digest.digestId && digest.outboxId);
  const match = (await q<{ id: string; fit_score: string; confidence_score: string }>(
    `select id,fit_score,confidence_score from job_matches
     where user_id=$1 and campaign_id=$2 and status='eligible'
     order by fit_score desc,confidence_score desc limit 1`,
    [userId, apply.id],
  ))[0];
  assert.ok(match?.id);
  // prepareApplicationPackage files anything below fit 85 / confidence 80 as
  // "blocked", and verify() below expects a sent application. The campaign floors
  // above (75/65) are deliberately lower, so an eligible match is not necessarily
  // a sendable one. Fail here, naming both scores, instead of downstream on an
  // opaque blocked-vs-provider_accepted mismatch.
  const fit = Number(match.fit_score);
  const confidence = Number(match.confidence_score);
  assert.ok(
    fit >= 85 && confidence >= 80,
    `smoke job must clear the send thresholds (fit>=85, confidence>=80), got fit=${fit} confidence=${confidence}`,
  );
  const prepared = await prepareApplicationPackage(match.id, async () => undefined);
  assert.ok(prepared.packageId);
  const selectedRecipient = `jobs-${runId}@example.test`;
  assert.deepEqual(await approveApplicationPackages(userId, [{
    packageId: prepared.packageId,
    selectedRecipient,
  }], async () => undefined), { approved: 1, queued: 1 });
  const attemptId = (await q<{ id: string }>(
    "select id from application_mail_attempts where user_id=$1 and package_id=$2",
    [userId, prepared.packageId],
  ))[0]?.id;
  assert.ok(attemptId);
  const fixture: Fixture = {
    runId,
    userId,
    digestId: digest.digestId,
    outboxId: digest.outboxId,
    attemptId,
  };
  await mkdir(sinkDirectory, { recursive: true, mode: 0o750 });
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, { encoding: "utf8", mode: 0o640 });
  console.log(JSON.stringify({ seeded: true, digest: 1, applicationAttempt: 1 }));
}

async function verify(): Promise<void> {
  assertIsolatedDatabase();
  const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture;
  assert.equal(fixture.runId, runId);
  const outbox = (await q<{ status: string; ordinal: number; hash: string | null }>(
    "select status,invocation_ordinal ordinal,receipt_hash hash from notification_outbox where id=$1 and user_id=$2",
    [fixture.outboxId, fixture.userId],
  ))[0];
  const attempt = (await q<{ status: string; ordinal: number; hash: string | null }>(
    `select status,current_invocation_ordinal ordinal,provider_acceptance_hash hash
     from application_mail_attempts where id=$1 and user_id=$2`,
    [fixture.attemptId, fixture.userId],
  ))[0];
  assert.deepEqual({ status: outbox?.status, ordinal: outbox?.ordinal }, { status: "provider_accepted", ordinal: 1 });
  assert.deepEqual({ status: attempt?.status, ordinal: attempt?.ordinal }, { status: "provider_accepted", ordinal: 1 });
  assert.match(outbox?.hash ?? "", /^[0-9a-f]{64}$/u);
  assert.match(attempt?.hash ?? "", /^[0-9a-f]{64}$/u);
  const source = await readFile(resolve(sinkDirectory, "events.jsonl"), "utf8");
  const events = source.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.deepEqual(events.map((event) => event.kind).sort(), ["mail_refresh", "mail_send", "notification"]);
  const allowedKeys = new Set([
    "schema", "kind", "runId", "referenceHash", "payloadHash", "payloadBytes",
    "recipientHash", "subjectHash", "textHash", "htmlHash", "textBytes", "htmlBytes",
    "messageTypeHash", "providerHash", "requestBytes",
  ]);
  for (const event of events) {
    assert.ok(Object.keys(event).every((key) => allowedKeys.has(key)), `unexpected sink key: ${Object.keys(event).join(",")}`);
    assert.match(String(event.referenceHash), /^[0-9a-f]{64}$/u);
    assert.match(String(event.payloadHash), /^[0-9a-f]{64}$/u);
  }
  const result = {
    schema: "rolesharp-jobs-smoke-result-v1",
    runId,
    passed: true,
    digest: { status: outbox.status, invocationOrdinal: outbox.ordinal, receiptHash: outbox.hash },
    application: { status: attempt.status, invocationOrdinal: attempt.ordinal, receiptHash: attempt.hash },
    sinkEventCount: events.length,
    sinkEvidenceHash: createHash("sha256").update(source).digest("hex"),
  };
  await writeFile(resolve(sinkDirectory, "result.json"), `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", mode: 0o640 });
  console.log(JSON.stringify(result));
}

async function main(): Promise<void> {
  if (command === "seed") await seed();
  else if (command === "verify") await verify();
  else throw new Error("usage: jobs-smoke-fixture.ts <seed|verify>");
}

main().then(() => process.exit(0)).catch((error) => {
  // Stack, not just message. This runs inside deploy.sh, where a bare
  // "feature_access_unavailable" on a 1000-line log says nothing about which of
  // the dozen gated calls in seed() raised it.
  console.error(error instanceof Error ? (error.stack ?? error.message) : "jobs_smoke_fixture_failed");
  process.exit(1);
});
