import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const port = Number(process.env.UI_AUDIT_PORT ?? "34103");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("invalid UI audit port");
const origin = `http://127.0.0.1:${port}`;
const evidenceRoot = resolve(process.env.UI_AUDIT_EVIDENCE ?? ".omo/evidence/ui-surfaces");
// Resolved through the module graph, not a hardcoded node_modules path: a git
// worktree has no node_modules of its own and resolves to the parent checkout,
// which made every one of these audits unrunnable from a worktree.
const nextCli = createRequire(import.meta.url).resolve("next/dist/bin/next");
const profiles = [
  { name: "desktop", viewport: { width: 1440, height: 1000 }, maxHeight: 12_000, minHeading: 28, maxHeading: 72 },
  { name: "mobile", viewport: { width: 390, height: 844 }, maxHeight: 18_000, minHeading: 26, maxHeading: 56 },
];
const requiredTemplates = ["/jobs/united-states", "/internships/united-states"];

await mkdir(evidenceRoot, { recursive: true });

const server = spawn(process.execPath, [nextCli, "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: process.cwd(),
  shell: false,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(port),
    AUTH_SECRET: process.env.AUTH_SECRET ?? "ui-audit-only-auth-secret-0123456789abcdef",
    LOCAL_DEV_MODE: "true",
    SITE_URL: origin,
    DISABLE_DB: "true",
    JOBS_WORKFLOWS_ENABLED: "false",
    ROLE_APPLY_GMAIL_SEND_ENABLED: "false",
    ROLE_APPLY_MICROSOFT_SEND_ENABLED: "false",
  },
});

const sleep = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await sleep(500);
  }
  throw new Error("UI audit server did not become ready");
}

function xmlLocations(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => match[1].replaceAll("&amp;", "&").trim());
}

async function publicPaths() {
  const root = await fetch(`${origin}/sitemap.xml`);
  if (!root.ok) throw new Error(`sitemap.xml returned ${root.status}`);
  const rootXml = await root.text();
  const rootLocations = xmlLocations(rootXml);
  const sitemapLocations = rootLocations.filter((location) => new URL(location, origin).pathname.endsWith(".xml"));
  const pageLocations = rootLocations.filter((location) => !new URL(location, origin).pathname.endsWith(".xml"));
  for (const sitemapLocation of sitemapLocations) {
    const pathname = new URL(sitemapLocation, origin).pathname;
    const response = await fetch(`${origin}${pathname}`);
    if (!response.ok) throw new Error(`${pathname} returned ${response.status}`);
    pageLocations.push(...xmlLocations(await response.text()));
  }
  return [...new Set([...pageLocations.map((location) => new URL(location, origin).pathname), ...requiredTemplates])].sort();
}

const findings = [];
const pages = [];
let browser;
try {
  await waitForServer();
  const paths = await publicPaths();
  browser = await chromium.launch({ headless: true });
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: profile.viewport,
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      localStorage.setItem("rolesharp-country-dismissed", "1");
      localStorage.setItem("rolesharp-student-banner-dismissed", "1");
      localStorage.setItem("rolesharp-theme", "light");
    });
    const page = await context.newPage();
    let consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    for (const [index, pathname] of paths.entries()) {
      consoleErrors = [];
      // Give every synthetic page visit a separate loopback-only rate-limit
      // identity. Reusing one address across the complete sitemap created
      // false 429 console errors, especially on the mobile pass.
      await page.setExtraHTTPHeaders({
        "X-Real-IP": `192.0.${profile.name === "desktop" ? 2 : 3}.${(index % 250) + 1}`,
      });
      const response = await page.goto(`${origin}${pathname}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(75);
      const layout = await page.evaluate(() => {
        const visible = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
        };
        const headings = [...document.querySelectorAll("h1")].filter(visible);
        const headingRect = headings[0]?.getBoundingClientRect();
        return {
          title: document.title,
          main: Boolean(document.querySelector("main")),
          navigation: Boolean(document.querySelector('nav[aria-label="Main navigation"]')),
          footer: Boolean(document.querySelector("footer")),
          headingCount: headings.length,
          headingText: headings[0]?.textContent?.replace(/\s+/g, " ").trim() ?? "",
          headingSize: headings[0] ? Number.parseFloat(getComputedStyle(headings[0]).fontSize) : 0,
          headingLeft: headingRect?.left ?? 0,
          headingRight: headingRect?.right ?? 0,
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
        };
      });
      const record = { profile: profile.name, pathname, status: response?.status() ?? 0, ...layout, consoleErrors };
      pages.push(record);
      if (record.status !== 200) findings.push({ profile: profile.name, pathname, check: "response", value: record.status });
      if (!record.main) findings.push({ profile: profile.name, pathname, check: "missing-main" });
      if (!record.navigation || !record.footer) findings.push({ profile: profile.name, pathname, check: "missing-public-shell" });
      if (record.headingCount !== 1) findings.push({ profile: profile.name, pathname, check: "visible-h1-count", value: record.headingCount });
      if (record.headingCount && (record.headingSize < profile.minHeading || record.headingSize > profile.maxHeading)) {
        findings.push({ profile: profile.name, pathname, check: "h1-size", value: record.headingSize });
      }
      if (record.headingLeft < -1 || record.headingRight > record.viewportWidth + 1) findings.push({ profile: profile.name, pathname, check: "h1-offscreen" });
      if (record.documentWidth > record.viewportWidth + 2) findings.push({ profile: profile.name, pathname, check: "horizontal-overflow", value: record.documentWidth - record.viewportWidth });
      if (record.documentHeight > profile.maxHeight) findings.push({ profile: profile.name, pathname, check: "oversized-page", value: record.documentHeight, limit: profile.maxHeight });
      for (const error of consoleErrors) findings.push({ profile: profile.name, pathname, check: "console-error", value: error });
    }
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await sleep(1_000);
  if (server.exitCode === null) server.kill("SIGKILL");
}

const summary = {
  schema: "rolesharp-ui-surface-audit-v1",
  origin,
  passed: findings.length === 0,
  counts: { pages: pages.length, paths: new Set(pages.map((page) => page.pathname)).size, profiles: profiles.length },
  findings,
};
await writeFile(resolve(evidenceRoot, "inventory.json"), `${JSON.stringify({ origin, pages }, null, 2)}\n`, "utf8");
await writeFile(resolve(evidenceRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) process.exitCode = 1;
