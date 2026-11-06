import { spawn } from "node:child_process";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const windows = process.platform === "win32";
const npm = windows ? "npm.cmd" : "npm";
const npx = windows ? "npx.cmd" : "npx";
const offlineBuildEnvironment = {
  AUTH_SECRET: process.env.AUTH_SECRET ?? "qa-only-auth-secret-not-for-production-0123456789abcdef",
  LOCAL_DEV_MODE: "true",
  SITE_URL: "http://127.0.0.1:34101",
  DISABLE_DB: "true",
  JOBS_WORKFLOWS_ENABLED: "false",
  ROLE_APPLY_GMAIL_SEND_ENABLED: "false",
  ROLE_APPLY_MICROSOFT_SEND_ENABLED: "false",
  PORT: process.env.JOBS_QA_PORT ?? "34101",
  JOBS_QA_PORT: process.env.JOBS_QA_PORT ?? "34101",
  JOBS_QA_DIST_DIR: ".next-qa-build",
  JOBS_QA_TSCONFIG: "tsconfig.jobs-qa.json",
};

const disposableTypeReference = "/// <reference path=\"./.next-qa-build/types/routes.d.ts\" />";
const disposableTypeInclude = ".next-qa-build/types/**/*.ts";

async function restoreStableTypeInputs() {
  const nextEnvPath = "next-env.d.ts";
  const nextEnv = (await readFile(nextEnvPath, "utf8"))
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== disposableTypeReference)
    .join("\n");
  await writeFile(nextEnvPath, nextEnv.endsWith("\n") ? nextEnv : `${nextEnv}\n`);

  const tsconfigPath = "tsconfig.json";
  const tsconfig = JSON.parse(await readFile(tsconfigPath, "utf8"));
  if (Array.isArray(tsconfig.include)) {
    tsconfig.include = tsconfig.include.filter((entry) => entry !== disposableTypeInclude);
  }
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
}

async function runIsolatedBuild(step) {
  const qaTsconfig = "tsconfig.jobs-qa.json";
  await restoreStableTypeInputs();
  await copyFile("tsconfig.json", qaTsconfig);
  try {
    await run(step);
  } finally {
    // Next.js rewrites generated type references for the selected distDir.
    // Keep disposable QA output from becoming an input to normal validation.
    await restoreStableTypeInputs();
  }
}

const steps = [
  { label: "check", command: npm, args: ["run", "check"], timeout: 5 * 60_000 },
  { label: "unit", command: npm, args: ["test"], timeout: 5 * 60_000 },
  { label: "database", command: npm, args: ["run", "test:db"], timeout: 8 * 60_000 },
  { label: "build", command: npm, args: ["run", "build"], timeout: 10 * 60_000, env: offlineBuildEnvironment },
  {
    label: "playwright", command: npx,
    args: ["--no-install", "playwright", "test", "tests/e2e/jobs-workflows.spec.ts", "--project=chromium"],
    timeout: 12 * 60_000,
    env: {
      ...offlineBuildEnvironment,
      JOBS_E2E_PRODUCTION: "1",
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=./tests/helpers/network-deny-bootstrap.mjs`.trim(),
    },
  },
  {
    label: "lighthouse-desktop", command: process.execPath,
    args: ["scripts/run-lighthouse.mjs", "--profile", "desktop"], timeout: 12 * 60_000,
    env: { ...offlineBuildEnvironment, LIGHTHOUSE_PROFILE: "desktop" },
  },
  {
    label: "lighthouse-mobile", command: process.execPath,
    args: ["scripts/run-lighthouse.mjs", "--profile", "mobile"], timeout: 12 * 60_000,
    env: { ...offlineBuildEnvironment, LIGHTHOUSE_PROFILE: "mobile" },
  },
];

function run(step) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n[qa:jobs] ${step.label}\n`);
    const child = spawn(step.command, step.args, {
      cwd: process.cwd(), stdio: "inherit", shell: windows,
      env: { ...process.env, ...step.env },
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${step.label} exceeded ${step.timeout}ms`));
    }, step.timeout);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${step.label} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

for (const step of steps) {
  if (step.label === "build") await runIsolatedBuild(step);
  else await run(step);
}
process.stdout.write("\n[qa:jobs] all deterministic gates passed\n");
