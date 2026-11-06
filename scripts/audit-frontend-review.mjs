import { readdir, mkdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const origin = new URL(process.env.FRONTEND_REVIEW_ORIGIN ?? "http://127.0.0.1:34110");
if (origin.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(origin.hostname)) {
  throw new Error("Run this audit against the disposable localhost review preview.");
}
const output = resolve(process.env.FRONTEND_REVIEW_OUTPUT ?? ".omo/evidence/frontend-review/final");
const filter = new RegExp(process.env.FRONTEND_REVIEW_MATCH ?? ".");
const profileNames = process.env.FRONTEND_REVIEW_PROFILES?.split(",");
const profiles = [
  { name: "desktop-dark", width: 1440, height: 1000, theme: "dark" },
  { name: "mobile-light", width: 390, height: 844, theme: "light", reducedMotion: "reduce" },
  { name: "desktop-light", width: 1440, height: 1000, theme: "light" },
  { name: "mobile-dark", width: 390, height: 844, theme: "dark", reducedMotion: "reduce" },
].filter(({ name }) => !profileNames || profileNames.includes(name));
if (!profiles.length) throw new Error("No review profile matched FRONTEND_REVIEW_PROFILES.");
const fixtures = {
  "/[locale]": ["/ja-jp", "/ar-ae"],
  "/blog/[slug]": ["/blog/ats-friendly-resume-2026"],
  "/campus/[slug]": ["/campus/cedar-state"],
  "/companies/[company]": ["/companies/harbor-labs"],
  "/compare/[slug]": ["/compare/rolesharp-vs-aiapply"],
  "/internships/[country]": ["/internships/united-states"],
  "/interview-questions/[role]": ["/interview-questions/product-manager"],
  "/jobs/[country]": ["/jobs/united-states"],
  "/resume/[company]/[role]": ["/resume/harbor-labs/software-engineer"],
  "/resumes/[id]": ["/resumes/00000000-0000-4000-8000-000000000011"],
  "/roles/[role]": ["/roles/product-manager"],
  "/salaries/[role]/[country]": ["/salaries/product-manager/us"],
  "/support/[id]": [process.env.FRONTEND_REVIEW_TICKET ?? "/support/1"],
  "/u/[handle]": ["/u/avery-chen"],
};
const signedIn = new Set([
  "/account", "/application-queue", "/billing", "/build", "/campaign-settings", "/daily-matches",
  "/dashboard", "/dev/frontend-review/tracker", "/email-connection", "/internship-reports", "/job-alerts",
  "/notifications", "/resumes", "/resumes/[id]", "/security", "/settings", "/support", "/support/[id]",
  "/tracker", "/u",
]);
const core = new Set(["/", "/build", "/checker", "/login", "/pricing", "/jobs", "/resume-templates", "/dashboard", "/tracker", "/daily-matches", "/application-queue", "/campaign-settings", "/admin"]);
const excluded = { "/daily-matches/unsubscribe": "Signed token and email unsubscribe action" };
const extras = [
  { template: "/build", url: "/build?resumeId=00000000-0000-4000-8000-000000000011", audience: "customer" },
];

async function routes(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const pages = entries.some(({ name }) => /^page\.[jt]sx?$/u.test(name)) ? [prefix || "/"] : [];
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      const segment = entry.name.startsWith("(") ? "" : `/${entry.name}`;
      pages.push(...await routes(join(directory, entry.name), prefix + segment));
    }
  }
  return pages;
}

const templates = (await routes("app")).sort();
const samples = templates.flatMap((template) => {
  if (excluded[template]) return [];
  const audience = /^\/admin(?:\/|$)/u.test(template) ? "admin" : signedIn.has(template) ? "customer" : "guest";
  return (fixtures[template] ?? (template.includes("[") ? [] : [template])).map((url) => ({ template, url, audience }));
}).concat(extras).filter(({ template, url }) => filter.test(template) || filter.test(url));
await mkdir(output, { recursive: true });
await writeFile(join(output, "inventory.json"), JSON.stringify({ templates, excluded, samples, profiles }, null, 2));

async function login(browser, audience) {
  const context = await browser.newContext();
  try {
    const admin = audience === "admin";
    const endpoint = admin ? "/api/admin/login" : "/api/auth/login";
    const data = admin
      ? { user: "review-admin", password: "RoleSharp-Local-Admin-2026", totp: "" }
      : { email: "avery@rolesharp.example", password: "RoleSharp-Demo-2026" };
    const response = await context.request.post(new URL(endpoint, origin).href, {
      data, headers: { origin: origin.origin }, maxRedirects: 0, timeout: 20_000,
    });
    if (!response.ok()) throw new Error(`${audience} sign-in returned ${response.status()}`);
    return await context.storageState();
  } finally {
    await context.close();
  }
}

async function makeContext(browser, profile, storageState) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    reducedMotion: profile.reducedMotion ?? "no-preference",
    colorScheme: profile.theme,
    serviceWorkers: "block",
    storageState,
  });
  await context.route("**/*", (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin.origin || !["GET", "HEAD"].includes(request.method())) return route.abort();
    return route.continue();
  });
  await context.addInitScript((theme) => {
    if (window.self !== window.top) return;
    localStorage.setItem("rolesharp-theme", theme);
    localStorage.setItem("rs_cookie_consent", "declined");
  }, profile.theme);
  return context;
}

async function capture(page, sample, directory, ordinal) {
  const result = { ...sample, consoleErrors: [], runtimeErrors: [], sameOriginFailures: [] };
  const onConsole = (msg) => {
    if (msg.type() === "error" && !/net::ERR_(FAILED|ABORTED)/u.test(msg.text())) result.consoleErrors.push(msg.text().slice(0, 500));
  };
  const onError = (error) => result.runtimeErrors.push(error.message);
  const onResponse = (response) => {
    if (response.status() >= 400 && response.url().startsWith(origin.origin + "/")) {
      result.sameOriginFailures.push({ status: response.status(), path: new URL(response.url()).pathname });
    }
  };
  page.on("console", onConsole);
  page.on("pageerror", onError);
  page.on("response", onResponse);
  try {
    const response = await page.goto(new URL(sample.url, origin).href, { waitUntil: "domcontentloaded", timeout: 35_000 });
    result.status = response?.status();
    await page.waitForLoadState("load", { timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(350);
    result.landed = page.url().slice(origin.origin.length);
    result.dom = await page.evaluate(() => {
      const internal = new Set();
      const external = new Set();
      const brokenAnchors = new Set();
      for (const link of document.querySelectorAll("a[href]")) {
        if (!link.getClientRects().length) continue;
        const url = new URL(link.href, location.href);
        if (url.origin === location.origin) {
          internal.add(url.pathname);
          if (url.hash.length > 1 && url.pathname === location.pathname) {
            let id = url.hash.slice(1);
            try { id = decodeURIComponent(id); } catch {}
            if (!document.getElementById(id) && !document.getElementsByName(id).length) brokenAnchors.add(url.hash);
          }
        } else if (url.protocol === "http:" || url.protocol === "https:") {
          external.add(url.origin);
        }
      }
      return {
        title: document.title,
        headings: [...document.querySelectorAll("h1")].map((heading) => heading.innerText),
        mainCount: document.querySelectorAll("main, [role=main]").length,
        theme: document.documentElement.dataset.theme ?? "dark",
        language: document.documentElement.lang,
        direction: getComputedStyle(document.documentElement).direction,
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        links: [...internal].sort(),
        externalOrigins: [...external].sort(),
        brokenAnchors: [...brokenAnchors].sort(),
      };
    });
    const filename = `${String(ordinal + 1).padStart(3, "0")}-${sample.url.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "") || "home"}.png`;
    await page.screenshot({ path: join(directory, filename), timeout: 6000 });
    result.screenshot = filename;
    if (core.has(sample.template)) {
      try {
        const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        result.axe = audit.violations.map(({ id, impact, nodes }) => ({ id, impact, selectors: nodes.map(({ target }) => target) }));
      } catch (error) {
        result.axeError = error.message;
      }
    }
  } catch (error) {
    result.error = error.message;
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onError);
    page.off("response", onResponse);
  }
  return result;
}

const preview = await fetch(new URL("/", origin), {
  redirect: "manual", signal: AbortSignal.timeout(20_000),
});
await preview.body?.cancel();
if (!preview.ok) throw new Error(`Review preview returned HTTP ${preview.status} for the homepage.`);

const browser = await chromium.launch();
try {
  const authentication = new Map();
  const audiences = new Set(samples.map(({ audience }) => audience));
  for (const audience of ["customer", "admin"]) {
    if (!audiences.has(audience)) continue;
    try {
      authentication.set(audience, { storageState: await login(browser, audience) });
    } catch (error) {
      authentication.set(audience, { error: error.message });
    }
  }
  const completed = await Promise.all(profiles.map(async (profile) => {
    const directory = join(output, profile.name);
    await mkdir(directory, { recursive: true });
    const results = [];
    const contexts = new Map();
    try {
      for (const [ordinal, sample] of samples.entries()) {
        const auth = authentication.get(sample.audience);
        if (!contexts.has(sample.audience)) {
          const context = await makeContext(browser, profile, auth?.storageState);
          contexts.set(sample.audience, await context.newPage());
        }
        const result = await capture(contexts.get(sample.audience), sample, directory, ordinal);
        if (auth?.error) result.authenticationError = auth.error;
        results.push(result);
        const partial = join(directory, "results.partial.json");
        await writeFile(partial, JSON.stringify(results, null, 2));
        await rename(partial, join(directory, "results.json"));
        console.log(profile.name, `${ordinal + 1}/${samples.length}`, result.status ?? "error", sample.url);
      }
      return { profile, results };
    } catch (error) {
      await writeFile(join(directory, "error.txt"), error.message);
      throw error;
    }
  }));
  const lines = [
    "# Local frontend review evidence",
    "",
    `Discovered ${templates.length} page templates and selected ${samples.length} example URLs at ${origin.origin}.`,
    "Screenshots capture the viewport. Axe runs on core routes. DOM checks record visible links and fragments without following external links or submitting forms.",
    "",
    "| Profile | Captured | Document HTTP ≥400 | Redirected | Runtime errors | Overflow | Axe violations |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const { profile, results } of completed) {
    lines.push(`| ${profile.name} | ${results.filter(({ screenshot }) => screenshot).length} | ${results.filter(({ status }) => status >= 400).length} | ${results.filter(({ url, landed }) => landed && url !== landed).length} | ${results.filter(({ runtimeErrors }) => runtimeErrors.length).length} | ${results.filter(({ dom }) => dom?.horizontalOverflow > 2).length} | ${results.filter(({ axe }) => axe?.length).length} |`);
  }
  for (const { profile, results } of completed) {
    lines.push("", `## ${profile.name}`, "", "| Requested | Rendered location | HTTP | H1 | Screenshot |", "| --- | --- | ---: | --- | --- |");
    for (const result of results) {
      const headings = result.dom?.headings.join(" · ").replaceAll("|", "\\|").replaceAll("\n", " ") || "—";
      const image = result.screenshot ? `[Open](${profile.name}/${result.screenshot})` : "—";
      lines.push(`| \`${result.url}\` | \`${result.landed ?? "—"}\` | ${result.status ?? "—"} | ${headings} | ${image} |`);
    }
  }
  await writeFile(join(output, "report.md"), lines.join("\n") + "\n");
} finally {
  await browser.close();
}
