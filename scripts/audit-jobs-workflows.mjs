import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const scope = process.argv.includes("--scope");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const pins = {
  "@playwright/test": "1.62.0",
  "@axe-core/playwright": "4.12.1",
  lighthouse: "13.4.1",
};
for (const [name, version] of Object.entries(pins)) {
  assert.equal(packageJson.devDependencies[name], version, `${name} package pin drifted`);
  assert.equal(lock.packages[`node_modules/${name}`]?.version, version, `${name} lock pin drifted`);
}

const workers = [
  "worker/jobs-scheduler.ts",
  "worker/jobs-workflow.ts",
  "worker/mailbox-dispatch.ts",
  "worker/notification-outbox.ts",
];
for (const path of workers) {
  const source = await readFile(path, "utf8");
  assert.doesNotMatch(source, /^await\s/mu, `${path} contains CommonJS-incompatible top-level await`);
}

const queueSource = await readFile("lib/jobs-workflow/queues.ts", "utf8");
assert.match(queueSource, /WorkflowQueueMessage = z\.object\(\{ workItemId:[^}]+\}\)\.strict\(\)/su);
assert.match(queueSource, /MailboxDispatchQueueMessage = z\.object\(\{ attemptId:[^}]+\}\)\.strict\(\)/su);
assert.match(queueSource, /NotificationOutboxQueueMessage = z\.object\(\{ outboxId:[^}]+\}\)\.strict\(\)/su);

const git = spawnSync("git", ["status", "--short"], { encoding: "utf8", shell: false });
assert.equal(git.status, 0, "git status failed");
const changed = git.stdout.split(/\r?\n/u).filter(Boolean).map((line) => line.slice(3).trim())
  .filter((path) => /\.(?:ts|tsx|mjs|js)$/u.test(path) && path !== "scripts/audit-jobs-workflows.mjs");
const bypass = /@ts-(?:ignore|nocheck)|eslint-disable|(?:test|describe)\.(?:skip|only)\s*\(/u;
const bypassFiles = [];
for (const path of changed) {
  try {
    const source = await readFile(path, "utf8");
    if (bypass.test(source)) bypassFiles.push(path);
  } catch {
    // Deleted or renamed paths are not auditable source files.
  }
}
assert.deepEqual(bypassFiles, [], `changed source contains bypass annotations: ${bypassFiles.join(", ")}`);

const localSink = await readFile("lib/jobs-workflow/local-sink.ts", "utf8");
assert.match(localSink, /fake_transport_requires_jobs_smoke_mode/u);
assert.match(localSink, /fake_transport_requires_isolated_queue_prefix/u);
assert.doesNotMatch(localSink, /Authorization:\s*`|authorizationHeader/u);

if (scope) {
  const providerPolicy = await readFile("lib/mail/provider-policy.ts", "utf8");
  const requiredScopes = [...providerPolicy.matchAll(/requiredScopes:\s*(\[[^\]]+\])/gu)]
    .map((match) => JSON.parse(match[1]));
  assert.deepEqual(requiredScopes, [
    ["openid", "email", "https://www.googleapis.com/auth/gmail.send"],
    ["openid", "offline_access", "User.Read", "Mail.Send"],
  ]);
  const dispatch = await readFile("lib/mail/dispatch.ts", "utf8");
  assert.doesNotMatch(dispatch, /linkedin|indeed|workday|greenhouse/iu);
  assert.match(dispatch, /e\.granted_scopes @> \$6::text\[\]/u);
  assert.match(dispatch, /attachmentBytesMatch\(row\.bytes, row\.bytes_hash\)/u);
  const publicCopy = await Promise.all([
    "app/auto-apply/page.tsx", "app/help/page.tsx", "app/privacy/page.tsx", "app/terms/page.tsx",
  ].map((path) => readFile(path, "utf8")));
  assert.match(publicCopy.join("\n"), /delivery unverified/iu);
  assert.match(publicCopy.join("\n"), /does not|never|only/iu);
}

console.log(JSON.stringify({
  audit: "jobs-workflows",
  passed: true,
  scope,
  pinnedDependencies: pins,
  changedSourceFilesChecked: changed.length,
  workerEntrypointsChecked: workers.length,
}));
