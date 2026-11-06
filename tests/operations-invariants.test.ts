import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function consumedQueues(path: string): string[] {
  return [...source(path).matchAll(/new Worker\(\s*"([a-z-]+)"/gu)].map((match) => match[1]);
}

// Every BullMQ queue in the workflow. A queue with no consumer silently stops
// working; a queue with two consumers double-processes.
const WORKFLOW_QUEUES = [
  "jobs-match",
  "jobs-digest",
  "application-package",
  "mailbox-dispatch",
  "notification-outbox",
];

// deploy.sh deliberately disables these four. They were superseded by the two
// consolidated agents, and the granular units are kept only as a rollback path.
const SUPERSEDED_UNITS = [
  "rolesharp-jobs-scheduler",
  "rolesharp-match-worker",
  "rolesharp-mail-worker",
  "rolesharp-outbox-worker",
];

test("the two consolidated agents consume every workflow queue exactly once", () => {
  const recommendation = consumedQueues("worker/recommendation-agent.ts");
  const autoApply = consumedQueues("worker/auto-apply-agent.ts");
  const all = [...recommendation, ...autoApply];

  for (const queue of WORKFLOW_QUEUES) {
    const consumers = all.filter((name) => name === queue).length;
    assert.equal(consumers, 1, `${queue} must have exactly one consumer across the enabled agents, found ${consumers}`);
  }
  assert.deepEqual(
    [...all].sort(),
    [...WORKFLOW_QUEUES].sort(),
    "the enabled agents must consume the workflow queues and nothing else",
  );
});

test("the enabled agents also own scheduling, so no separate scheduler is needed", () => {
  // If this ever stops being true, due campaign work is never enqueued and the
  // whole pipeline goes quiet without erroring.
  assert.match(
    source("worker/recommendation-agent.ts"),
    /scheduleDueWorkflowItems/u,
    "recommendation-agent must run the scheduler tick",
  );
});

test("deploy.sh must not enable the superseded worker units", () => {
  const deploy = source("deploy.sh");
  const disableLine = deploy.match(/systemctl disable --now[^\n]*(\n[^\n]*)?/u)?.[0] ?? "";
  for (const unit of SUPERSEDED_UNITS) {
    assert.ok(
      disableLine.includes(unit),
      `${unit} must stay in the systemctl disable line`,
    );
    // Enabling one of these alongside the consolidated agents puts two
    // consumers on the same queue: duplicate digests and duplicate email.
    assert.doesNotMatch(
      deploy,
      new RegExp(`systemctl enable[^\\n]*${unit}`, "u"),
      `${unit} must never be enabled -- it double-processes against the consolidated agents`,
    );
  }
});

test("campaign candidates are filtered by country before the row cap", () => {
  const matches = source("lib/jobs-workflow/matches.ts");
  // Capping the global newest rows starves a campaign whose target country is
  // not currently the busiest: a perfect match falls off the end unseen.
  assert.match(matches, /country_code = any\(\$1\)/u, "the candidate query must filter by campaign countries");
  assert.match(matches, /MATCH_CANDIDATE_LIMIT/u, "the row cap must be a named constant");
  assert.doesNotMatch(
    matches,
    /from jobs where expires_at>now\(\) order by/u,
    "the unfiltered global candidate query must not come back",
  );
});

test("admin campaign actions go through updateCampaign, not raw status writes", () => {
  const route = source("app/api/admin/campaigns/route.ts");
  // updateCampaign enforces current legal acceptance, an active entitlement,
  // the daily cap, and a live mail connection for role_apply. Writing status
  // directly let an admin activate a campaign that the owner's own API would
  // refuse -- and an active campaign contacts employers on their behalf.
  assert.match(route, /updateCampaign\(/u, "admin actions must delegate to updateCampaign");
  assert.doesNotMatch(
    route,
    /update job_campaigns\s+set status/u,
    "the admin route must not write campaign status directly",
  );
  assert.match(route, /recordAdminAction\(/u, "admin actions must be audited with the acting staff account");
});

// A shared trigger function may only touch columns that every table it is
// attached to actually has. PL/pgSQL resolves each field reference in an
// expression against the real row type before any tg_table_name guard runs, so a
// per-table branch does not make a per-table column safe -- it makes every
// UPDATE on the other tables raise `record "new" has no field ...`. That shipped
// once: enforce_student_offer_pin_immutability() named student_grants columns and
// broke UPDATEs on student_claims and student_verification_tokens in production.
//
// ponytail: asserts the one shared function rather than parsing every table's
// schema out of the migration set. Generalise if a second shared trigger function
// appears.
test("the shared student offer pin trigger only touches columns both its tables have", () => {
  const migration = source("db/migrations/048_immutable_offer_versions.sql");
  const fn = "enforce_student_offer_pin_immutability";

  // Columns 048 adds to student_verification_tokens and student_claims alike.
  const SHARED = new Set([
    "offer_version_id",
    "offer_key",
    "offer_version_number",
    "offer_content_digest_snapshot",
    "offer_terms_snapshot",
  ]);

  const body = migration.split(`create or replace function ${fn}()`)[1]?.split("$$;")[0];
  assert.ok(body, `${fn} must still be defined in 048`);

  for (const [, field] of body.matchAll(/\b(?:new|old)\.([a-z_]+)/gu)) {
    assert.ok(SHARED.has(field), `${fn} references ${field}, which is not on every table it guards`);
  }

  const attached = [...migration.matchAll(
    new RegExp(String.raw`before update on (\w+)\s+for each row execute function ${fn}\(\)`, "gu"),
  )].map((match) => match[1]).sort();
  assert.deepEqual(
    attached,
    ["student_claims", "student_verification_tokens"],
    "a new table here must share every column the function references",
  );

  // deploy.sh reruns every migration against a database that already has these
  // triggers. If the definition sits after the UPDATEs, that rerun fires the
  // stale function and aborts before reaching the fix -- which is how a bad
  // version of this function survived three deploys.
  const defined = migration.indexOf(`create or replace function ${fn}()`);
  for (const [, offset] of [...migration.matchAll(/\nupdate (?:student_claims|student_verification_tokens) /gu)]
    .map((match) => [match[0], match.index ?? 0] as const)) {
    assert.ok(offset > defined, `${fn} must be defined before every UPDATE 048 runs, so a rerun repairs it first`);
  }
});
