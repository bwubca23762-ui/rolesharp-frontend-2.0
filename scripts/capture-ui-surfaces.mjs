import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const port = Number(process.env.UI_REVIEW_PORT ?? "34102");
const origin = `http://127.0.0.1:${port}`;
const evidenceRoot = resolve(process.env.UI_REVIEW_EVIDENCE ?? ".omo/evidence/ui-review");
// Resolved through the module graph, not a hardcoded node_modules path: a git
// worktree has no node_modules of its own and resolves to the parent checkout,
// which made every one of these audits unrunnable from a worktree.
const nextCli = createRequire(import.meta.url).resolve("next/dist/bin/next");
const routes = [
  ["home", "/"],
  ["jobs", "/jobs"],
  ["jobs-country", "/jobs/united-states"],
  ["internships-country", "/internships/united-states"],
  ["resume-builder", "/resume-builder"],
  ["resume-maker", "/resume-maker"],
  ["resume-templates", "/resume-templates"],
  ["resume-examples", "/resume-examples"],
  ["country-adapter", "/resume-translator"],
  ["checker", "/checker"],
  ["linkedin-checker", "/linkedin-checker"],
  ["resume-fixer", "/resume-fixer"],
  ["cover-letter", "/cover-letter-generator"],
  ["interview-prep", "/interview-prep"],
  ["auto-apply", "/auto-apply"],
  ["pricing", "/pricing"],
  ["blog-index", "/blog"],
  ["blog-article", "/blog/ats-friendly-resume-2026"],
  ["compare-index", "/compare"],
  ["comparison", "/compare/rolesharp-vs-teal"],
  ["companies", "/companies"],
  ["roles", "/roles"],
  ["internship-reports", "/internship-reports"],
  ["contact", "/contact"],
  ["help", "/help"],
  ["billing-entry", "/billing"],
  ["account-entry", "/account"],
  ["security-entry", "/security"],
  ["privacy", "/privacy"],
  ["locale-ja", "/ja-jp"],
];
const profiles = [
  ["desktop-light", { viewport: { width: 1440, height: 1000 }, colorScheme: "light" }],
  ["mobile-light", { viewport: { width: 390, height: 844 }, colorScheme: "light" }],
  ["desktop-dark", { viewport: { width: 1440, height: 1000 }, colorScheme: "dark" }],
];

await mkdir(evidenceRoot, { recursive: true });

const server = spawn(process.execPath, [nextCli, "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: process.cwd(),
  shell: false,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(port),
    AUTH_SECRET: process.env.AUTH_SECRET ?? "ui-review-only-auth-secret-0123456789abcdef",
    LOCAL_DEV_MODE: "true",
    SITE_URL: origin,
    DISABLE_DB: "true",
    JOBS_WORKFLOWS_ENABLED: "false",
    ROLE_APPLY_GMAIL_SEND_ENABLED: "false",
    ROLE_APPLY_MICROSOFT_SEND_ENABLED: "false",
  },
});

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error("UI review server did not become ready");
}

const results = [];
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  for (const [profile, options] of profiles) {
    const context = await browser.newContext({ ...options, reducedMotion: "reduce" });
    const reviewTheme = profile.endsWith("-light") ? "light" : "dark";
    await context.addInitScript((theme) => {
      localStorage.setItem("rolesharp-country-dismissed", "1");
      localStorage.setItem("rolesharp-theme", theme);
    }, reviewTheme);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    for (const [slug, pathname] of routes) {
      const response = await page.goto(`${origin}${pathname}`, { waitUntil: "networkidle", timeout: 60_000 });
      await page.screenshot({ path: resolve(evidenceRoot, `${profile}-${slug}-fold.png`) });
      await page.screenshot({ path: resolve(evidenceRoot, `${profile}-${slug}.png`), fullPage: true });
      const layout = await page.evaluate(() => ({
        title: document.title,
        h1: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        navLinks: document.querySelectorAll("nav a").length,
        buttons: document.querySelectorAll("button, a.btn").length,
      }));
      results.push({ profile, pathname, status: response?.status() ?? 0, ...layout, consoleErrors: [...consoleErrors] });
      consoleErrors.length = 0;
    }
    await context.close();
  }
  await writeFile(resolve(evidenceRoot, "summary.json"), `${JSON.stringify({ origin, results }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ origin, results }, null, 2));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  if (server.exitCode === null) server.kill("SIGKILL");
}
