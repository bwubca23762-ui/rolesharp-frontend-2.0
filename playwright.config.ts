import { defineConfig, devices } from "@playwright/test";

const repositoryRoot = __dirname;
const jobsProductionQa = process.env.JOBS_E2E_PRODUCTION === "1";
const rawJobsQaPort = process.env.JOBS_QA_PORT ?? "34101";
if (!/^\d+$/u.test(rawJobsQaPort) || Number(rawJobsQaPort) < 1 || Number(rawJobsQaPort) > 65_535) {
  throw new Error("JOBS_QA_PORT must be an integer between 1 and 65535");
}
const jobsQaPort = Number(rawJobsQaPort);
const jobsDevDistDir = ".next-playwright";
const evidenceRoot = process.env.JOBS_EVIDENCE_ROOT ?? (jobsProductionQa
  ? ".omo/evidence/task-21-auto-apply"
  : ".omo/evidence/task-1-auto-apply");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Both suites share one Next development server. A single browser worker
  // prevents concurrent on-demand compilation from invalidating fixture
  // responses while accessibility snapshots are being collected.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: `${evidenceRoot}/playwright-report`,
      },
    ],
  ],
  use: {
    baseURL: `http://127.0.0.1:${jobsQaPort}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    cwd: repositoryRoot,
    command: jobsProductionQa
      ? "npm run start:qa"
      : `node scripts/start-playwright-dev.mjs --hostname 127.0.0.1 --port ${jobsQaPort}`,
    url: jobsProductionQa
      ? `http://127.0.0.1:${jobsQaPort}/auto-apply`
      : `http://127.0.0.1:${jobsQaPort}/dev/jobs-primitives`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      JOBS_QA_DIST_DIR: jobsProductionQa ? ".next-qa-build" : jobsDevDistDir,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
  ],
  outputDir: `${evidenceRoot}/playwright-results`,
});
