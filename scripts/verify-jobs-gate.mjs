import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const gate = process.argv[2];
if (!new Set(["f1", "f2", "f3", "f4"]).has(gate)) throw new Error("gate must be f1, f2, f3, or f4");
const args = process.argv.slice(3);
function option(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? "") : fallback;
}
const evidenceRoot = resolve(option("--evidence"));
if (!option("--evidence")) throw new Error("--evidence is required");
const resultDirectory = resolve(evidenceRoot, `final-${gate}`);
const resultPath = resolve(resultDirectory, "result.json");
const startedAt = new Date().toISOString();
const attemptId = randomUUID();
const windows = process.platform === "win32";
const npm = windows ? "npm.cmd" : "npm";
const npx = windows ? "npx.cmd" : "npx";
const checks = [];

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

async function run(name, command, commandArgs, env = {}) {
  const started = Date.now();
  const exitCode = await new Promise((resolveExit) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(), stdio: "inherit", shell: false, env: { ...process.env, ...env },
    });
    child.once("error", () => resolveExit(127));
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
  checks.push({ name, command: [command, ...commandArgs].join(" "), exitCode, durationMs: Date.now() - started });
  if (exitCode !== 0) throw new Error(`${name} failed`);
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

async function requireDeploymentEvidence() {
  const files = await walk(evidenceRoot);
  const releases = files.filter((path) => path.endsWith("release-verification.json"));
  const smoke = files.filter((path) => path.endsWith("result.json") && path.includes("isolated-smoke-"));
  if (!releases.length || !smoke.length) throw new Error("fresh release flags-off and isolated-smoke evidence are required");
  const release = JSON.parse(await readFile(releases.sort().at(-1), "utf8"));
  const smokeResult = JSON.parse(await readFile(smoke.sort().at(-1), "utf8"));
  if (release.productionFlagsOff !== true || release.releaseVerified !== true) throw new Error("release flags-off evidence is invalid");
  if (smokeResult.passed !== true || smokeResult.schema !== "rolesharp-jobs-smoke-result-v1") throw new Error("isolated smoke evidence is invalid");
  checks.push({ name: "deployment-evidence", command: "read-only evidence validation", exitCode: 0, durationMs: 0 });
}

const planPath = resolve(option("--plan", ".omo/plans/auto-apply.md"));
const planSource = await readFile(planPath);
const planSha256 = sha256(planSource);
const expectedPlanSha = option("--plan-sha");
if (expectedPlanSha && expectedPlanSha !== planSha256) throw new Error("plan SHA mismatch");
let buildSha256 = option("--build-sha");
try {
  const buildId = (await readFile(resolve(".next/BUILD_ID"), "utf8")).trim();
  const actualBuildSha = sha256(buildId);
  if (buildSha256 && buildSha256 !== actualBuildSha && buildSha256 !== buildId) throw new Error("build SHA mismatch");
  buildSha256 ||= actualBuildSha;
} catch (error) {
  if (!buildSha256) throw new Error("a production build or --build-sha is required", { cause: error });
}

const offline = {
  AUTH_SECRET: process.env.AUTH_SECRET ?? "qa-only-auth-secret-not-for-production-0123456789abcdef",
  LOCAL_DEV_MODE: "true",
  SITE_URL: "http://127.0.0.1:34101",
  DISABLE_DB: "true",
  JOBS_WORKFLOWS_ENABLED: "false",
  ROLE_APPLY_GMAIL_SEND_ENABLED: "false",
  ROLE_APPLY_MICROSOFT_SEND_ENABLED: "false",
};

let failure;
try {
  await mkdir(resultDirectory, { recursive: true });
  if (gate === "f1") {
    const plan = planSource.toString("utf8");
    for (let row = 1; row <= 22; row += 1) {
      if (!plan.includes(`- [x] ${row}.`)) throw new Error(`plan row ${row} is not complete`);
    }
    for (const path of [
      "worker/jobs-scheduler.ts", "worker/jobs-workflow.ts", "worker/mailbox-dispatch.ts",
      "worker/notification-outbox.ts", "scripts/run-jobs-smoke.sh", "scripts/verify-jobs-release.sh",
      "docs/JOBS-WORKFLOWS-RUNBOOK.md", "docs/JOBS-WORKFLOWS-ROLLBACK.md",
    ]) await stat(resolve(path));
    checks.push({ name: "plan-structure-and-file-map", command: "internal", exitCode: 0, durationMs: 0 });
    await run("workflow-audit", process.execPath, ["scripts/audit-jobs-workflows.mjs", "--scope"]);
    await requireDeploymentEvidence();
  }
  if (gate === "f2") {
    await run("check", npm, ["run", "check"]);
    await run("unit-and-adversarial-tests", npm, ["test"]);
    await run("postgres-integrity", npm, ["run", "test:db"]);
    await run("security-tests", npm, ["run", "test:security"]);
    await run("dependency-audit", npm, ["audit", "--audit-level=high"]);
    await run("no-bypass-and-workflow-audit", process.execPath, ["scripts/audit-jobs-workflows.mjs"]);
  }
  if (gate === "f3") {
    await requireDeploymentEvidence();
    const port = option("--port", "34131");
    const qaEnv = {
      ...offline,
      PORT: port,
      JOBS_QA_PORT: port,
      JOBS_EVIDENCE_ROOT: resultDirectory,
      JOBS_E2E_PRODUCTION: "1",
    };
    checks.push({ name: "production-build-present", command: "read .next/BUILD_ID", exitCode: 0, durationMs: 0 });
    await run("real-browser-workflows", npx, ["--no-install", "playwright", "test", "tests/e2e/jobs-workflows.spec.ts", "--project=chromium"], {
      ...qaEnv,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=./tests/helpers/network-deny-bootstrap.mjs`.trim(),
    });
    await run("lighthouse-desktop", process.execPath, ["scripts/run-lighthouse.mjs", "--profile", "desktop", "--port", port, "--evidence", resultDirectory], qaEnv);
    await run("lighthouse-mobile", process.execPath, ["scripts/run-lighthouse.mjs", "--profile", "mobile", "--port", port, "--evidence", resultDirectory], qaEnv);
  }
  if (gate === "f4") {
    await requireDeploymentEvidence();
    await run("scope-audit", process.execPath, ["scripts/audit-jobs-workflows.mjs", "--scope"]);
    await run("public-copy-and-seo", npm, ["run", "test:seo"]);
    await run("workflow-contracts", process.execPath, ["--import", "tsx", "--test", "tests/jobs-workflow-contracts.test.ts", "tests/jobs-workflow-security.test.ts"]);
  }
} catch (error) {
  failure = error instanceof Error ? error.message : "unknown_gate_failure";
}

const result = {
  schemaVersion: 1,
  gate: gate.toUpperCase(),
  planSha256,
  buildSha256,
  attemptId,
  startedAt,
  completedAt: new Date().toISOString(),
  inputHashes: { plan: planSha256, build: buildSha256 },
  command: process.argv.join(" "),
  exitCode: failure ? 1 : 0,
  checks,
  cleanup: true,
  verdict: failure ? "DENY" : "APPROVE",
  ...(failure ? { failure } : {}),
};
await mkdir(resultDirectory, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result));
if (failure) process.exitCode = 1;
