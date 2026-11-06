import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? "") : fallback;
};
const profile = option("--profile", process.env.LIGHTHOUSE_PROFILE ?? "desktop");
if (!new Set(["desktop", "mobile"]).has(profile)) throw new Error("profile must be desktop or mobile");
const port = Number(option("--port", process.env.JOBS_QA_PORT ?? "34101"));
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("invalid QA port");
const scriptDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)));
const projectRoot = resolve(scriptDirectory, "..");
const evidenceRoot = resolve(projectRoot, option("--evidence", process.env.JOBS_EVIDENCE_ROOT ?? ".omo/evidence/task-21-auto-apply"));
const outputDirectory = resolve(evidenceRoot, `lighthouse-${profile}`);
const origin = `http://127.0.0.1:${port}`;
const routes = ["/auto-apply", "/daily-matches", "/campaign-settings"];
const privateNoindexRoutes = new Set(["/daily-matches", "/campaign-settings"]);
// Resolved through the module graph, not a hardcoded node_modules path: a git
// worktree has no node_modules of its own and resolves to the parent checkout,
// which made every one of these audits unrunnable from a worktree.
const nextCli = createRequire(import.meta.url).resolve("next/dist/bin/next");
const chromePath = chromium.executablePath();
await mkdir(outputDirectory, { recursive: true });

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/auto-apply`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error("QA server did not become ready");
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const server = spawn(process.execPath, [nextCli, "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: projectRoot, shell: false, stdio: "inherit",
  env: { ...process.env, PORT: String(port) },
});
let failure;
const summaries = [];
try {
  await waitForServer();
  for (const route of routes) {
    const slug = route.slice(1).replaceAll("/", "-");
    const reports = [];
    for (let runIndex = 1; runIndex <= 3; runIndex += 1) {
      const reportPath = resolve(outputDirectory, `${slug}-${runIndex}.json`);
      const userDataDir = resolve(outputDirectory, `.chrome-${slug}-${runIndex}`);
      await mkdir(userDataDir, { recursive: true });
      const chrome = await launch({
        chromePath,
        userDataDir,
        chromeFlags: [
          "--headless=new", "--no-sandbox",
          "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE localhost, EXCLUDE 127.0.0.1",
        ],
      });
      try {
        const screenEmulation = profile === "desktop"
          ? { mobile: false, width: 1280, height: 900, deviceScaleFactor: 1, disabled: false }
          : { mobile: true, width: 375, height: 812, deviceScaleFactor: 2.625, disabled: false };
        const result = await lighthouse(`${origin}${route}`, {
          port: chrome.port,
          output: "json",
          logLevel: "error",
          onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
          throttlingMethod: "simulate",
          formFactor: profile,
          screenEmulation,
        }, profile === "desktop" ? desktopConfig : undefined);
        if (!result) throw new Error(`Lighthouse returned no report for ${route}`);
        await writeFile(reportPath, typeof result.report === "string" ? result.report : result.report.join("\n"), "utf8");
        reports.push(result.lhr);
      } finally {
        await chrome.kill();
        await rm(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
    }
    const value = (selector) => median(reports.map(selector));
    const summary = {
      route,
      categories: {
        performance: value((report) => report.categories.performance.score),
        accessibility: value((report) => report.categories.accessibility.score),
        bestPractices: value((report) => report.categories["best-practices"].score),
        seo: value((report) => report.categories.seo.score),
      },
      metrics: {
        cumulativeLayoutShift: value((report) => report.audits["cumulative-layout-shift"].numericValue),
        largestContentfulPaint: value((report) => report.audits["largest-contentful-paint"].numericValue),
        totalBlockingTime: value((report) => report.audits["total-blocking-time"].numericValue),
      },
    };
    const violations = [];
    if (summary.categories.performance < 0.9) violations.push("performance<0.9");
    if (summary.categories.accessibility < 1) violations.push("accessibility<1");
    if (summary.categories.bestPractices < 1) violations.push("best-practices<1");
    if (privateNoindexRoutes.has(route)) {
      const nonIndexabilitySeoFailures = reports.flatMap((report) => report.categories.seo.auditRefs
        .filter(({ weight }) => weight > 0)
        .map(({ id }) => ({ id, score: report.audits[id]?.score }))
        .filter(({ id, score }) => id !== "is-crawlable" && score !== 1));
      const intentionallyNoindex = reports.every((report) => report.audits["is-crawlable"]?.score === 0);
      if (!intentionallyNoindex || nonIndexabilitySeoFailures.length) violations.push("private-page-seo-contract");
    } else if (summary.categories.seo < 1) violations.push("seo<1");
    if (summary.metrics.cumulativeLayoutShift > 0.1) violations.push("CLS>0.1");
    if (summary.metrics.largestContentfulPaint > 2_500) violations.push("LCP>2500ms");
    if (summary.metrics.totalBlockingTime > 200) violations.push("TBT>200ms");
    summaries.push({ ...summary, violations });
  }
  if (summaries.some(({ violations }) => violations.length)) failure = "one or more Lighthouse budgets failed";
} catch (error) {
  failure = error instanceof Error ? error.message : "lighthouse_runner_failed";
} finally {
  server.kill("SIGTERM");
  await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  if (server.exitCode === null) server.kill("SIGKILL");
}
const result = { schema: "rolesharp-lighthouse-v1", profile, passed: !failure, summaries, ...(failure ? { failure } : {}) };
await writeFile(resolve(outputDirectory, "summary.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result));
if (failure) process.exitCode = 1;
