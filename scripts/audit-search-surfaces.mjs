import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? "") : fallback;
};
const port = Number(option("--port", process.env.SEARCH_AUDIT_PORT ?? "34101"));
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("invalid audit port");
const origin = option("--base", process.env.SEARCH_AUDIT_BASE ?? `http://127.0.0.1:${port}`).replace(/\/$/, "");
const canonicalOrigin = new URL(option(
  "--canonical-origin",
  process.env.SEARCH_AUDIT_CANONICAL_ORIGIN ?? "https://rolesharp.com",
)).origin;
const allowedPublicOrigins = new Set([origin, canonicalOrigin]);
const evidenceRoot = resolve(option("--evidence", process.env.SEARCH_AUDIT_EVIDENCE ?? ".omo/evidence/search-surfaces"));
// Resolved through the module graph, not a hardcoded node_modules path: a git
// worktree has no node_modules of its own and resolves to the parent checkout,
// which made every one of these audits unrunnable from a worktree.
const nextCli = createRequire(import.meta.url).resolve("next/dist/bin/next");
const shouldStartServer = !args.includes("--no-start");
const shouldAuditRoutes = !args.includes("--skip-route-audit");
const auditEnvironment = {
  ...process.env,
  AUTH_SECRET: process.env.AUTH_SECRET ?? "search-audit-only-auth-secret-0123456789abcdef",
  LOCAL_DEV_MODE: "true",
  SITE_URL: origin,
  DISABLE_DB: process.env.DATABASE_URL ? (process.env.DISABLE_DB ?? "false") : "true",
  JOBS_WORKFLOWS_ENABLED: "false",
  ROLE_APPLY_GMAIL_SEND_ENABLED: "false",
  ROLE_APPLY_MICROSOFT_SEND_ENABLED: "false",
};

const REQUIRED_PUBLIC_PATHS = [
  "/", "/auto-apply", "/jobs", "/checker", "/resume-builder", "/resume-fixer",
  "/resume-maker", "/linkedin-checker", "/cover-letter-generator", "/interview-prep",
  "/pricing", "/about", "/contact", "/help", "/privacy", "/terms",
  "/build/help", "/checker/help", "/linkedin-checker/help", "/resume-maker/help", "/resume-fixer/help",
];
const PRIVATE_PATHS = [
  "/admin", "/application-queue", "/campaign-settings", "/daily-matches", "/dashboard",
  "/email-connection", "/forgot-password", "/login", "/reset-password", "/settings",
  "/support", "/tracker",
];
const PUBLIC_NOINDEX_PATHS = ["/build", "/embed/ats-score"];
const LOCALE_PATHS = new Map([
  ["/en-us", "en-US"], ["/en-gb", "en-GB"], ["/en-ca", "en-CA"], ["/en-in", "en-IN"],
  ["/de-de", "de-DE"], ["/fr-fr", "fr-FR"], ["/es-es", "es-ES"], ["/ja-jp", "ja-JP"], ["/ar-ae", "ar-AE"],
]);
const EXPECTED_LANGUAGE_ALTERNATES = new Map([
  ["en", "/"], ...[...LOCALE_PATHS].map(([path, language]) => [language, path]), ["x-default", "/"],
]);
const TEMPLATE_AUDIT_PATHS = ["/jobs/united-states", "/internships/united-states"];
const TITLE_MIN = 20;
const TITLE_MAX = 65;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 165;
const REQUIRED_AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended"];
const FORBIDDEN_STALE_CLAIMS = [
  /RoleSharp deliberately doesn['’]t offer (?:it|auto-apply)/i,
  /RoleSharp won['’]t(?: submit applications)?/i,
  /Auto-apply to jobs[\s\S]{0,160}\bNo \(deliberately/i,
  /Does RoleSharp have auto-apply like AIApply\?[\s\S]{0,160}\bNo[,.;]/i,
];
const FORBIDDEN_UNSUPPORTED_CLAIMS = [
  /zero impact on (?:your )?page['’]s Core Web Vitals/i,
  /widget is under 15KB/i,
];

function normalizePath(value) {
  const path = new URL(value, origin).pathname.replace(/\/$/, "");
  return path || "/";
}

function decodeXml(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}

function locs(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decodeXml(match[1].trim()));
}

function sitemapRecords(xml) {
  return [...xml.matchAll(/<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/gi)].map((match) => ({
    loc: decodeXml(match[1].match(/<loc>([\s\S]*?)<\/loc>/i)?.[1]?.trim() ?? ""),
    lastmod: match[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1]?.trim() ?? "",
  }));
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return result;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => attributes(match[0]));
}

function metas(html, name) {
  return tags(html, "meta").filter((tag) => tag.name?.toLowerCase() === name.toLowerCase());
}

function links(html, rel) {
  return tags(html, "link").filter((tag) => (tag.rel ?? "").toLowerCase().split(/\s+/).includes(rel.toLowerCase()));
}

function textContent(html) {
  return decodeHtml(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ");
}

function firstMeta(html, key, value) {
  const match = tags(html, "meta").find((tag) => tag[key]?.toLowerCase() === value.toLowerCase());
  return decodeHtml(match?.content ?? "").trim();
}

function firstLink(html, rel) {
  return decodeHtml(links(html, rel).find((link) => link.href)?.href ?? "").trim();
}

function headingTexts(html, level) {
  return [...html.matchAll(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi"))]
    .map((match) => textContent(match[1]));
}

function normalizedVisibleText(value) {
  return decodeHtml(String(value ?? "")).replace(/\s+/g, " ").trim();
}

function groupDuplicates(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = key(item);
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item.pathname);
  }
  return [...groups.entries()].filter(([, paths]) => paths.length > 1).map(([value, paths]) => ({ value, paths }));
}

const responseCache = new Map();

async function fetchText(pathname, init = {}) {
  const cacheable = Object.keys(init).length === 0;
  const key = cacheable ? new URL(pathname, origin).toString() : "";
  if (cacheable && responseCache.has(key)) return responseCache.get(key);
  const request = (async () => {
    try {
      const response = await fetch(new URL(pathname, origin), { redirect: "manual", signal: AbortSignal.timeout(20_000), ...init });
      return {
        pathname: normalizePath(pathname),
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        xRobotsTag: response.headers.get("x-robots-tag") ?? "",
        cacheControl: response.headers.get("cache-control") ?? "",
        location: response.headers.get("location") ?? "",
        body: await response.text(),
      };
    } catch (error) {
      return {
        pathname: normalizePath(pathname), status: 0, contentType: "", xRobotsTag: "", cacheControl: "", location: "", body: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();
  if (cacheable) responseCache.set(key, request);
  return request;
}

async function inBatches(items, worker, size = 8) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(...await Promise.all(items.slice(index, index + size).map(worker)));
  }
  return output;
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error("search audit server did not become ready");
}

function runRouteAudit() {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, ["scripts/audit-routes.mjs"], {
      cwd: process.cwd(), shell: false, stdio: ["ignore", "pipe", "pipe"],
      env: { ...auditEnvironment, ROUTE_AUDIT_BASE: origin },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("exit", (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
    child.once("error", (error) => resolveRun({ code: 1, stdout, stderr: `${stderr}${error.message}` }));
  });
}

function jsonLdNodes(value) {
  if (Array.isArray(value)) return value.flatMap(jsonLdNodes);
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value["@graph"])) return value["@graph"].flatMap(jsonLdNodes);
  return [value];
}

function inspectJsonLd(pathname, html, findings, typeCounts, structuredLinks) {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const visibleText = normalizedVisibleText(textContent(html));
  for (const [index, block] of blocks.entries()) {
    try {
      const parsed = JSON.parse(block[1]);
      const nodes = jsonLdNodes(parsed);
      for (const node of nodes) {
        const types = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
        for (const type of types.filter(Boolean)) typeCounts[type] = (typeCounts[type] ?? 0) + 1;
        if (types.includes("FAQPage")) {
          if (!Array.isArray(node.mainEntity) || !node.mainEntity.length) findings.push({ pathname, check: "faq-jsonld-empty", block: index + 1 });
          for (const question of node.mainEntity ?? []) {
            if (question?.["@type"] !== "Question" || !question.name || question.acceptedAnswer?.["@type"] !== "Answer" || !question.acceptedAnswer?.text) {
              findings.push({ pathname, check: "faq-jsonld-invalid", block: index + 1 });
              break;
            }
            const questionText = normalizedVisibleText(question.name);
            const answerText = normalizedVisibleText(question.acceptedAnswer?.text);
            if (questionText && !visibleText.includes(questionText)) findings.push({ pathname, check: "faq-question-not-visible", block: index + 1, question: question.name });
            if (answerText && !visibleText.includes(answerText)) findings.push({ pathname, check: "faq-answer-not-visible", block: index + 1, question: question.name });
          }
        }
        if (types.includes("BreadcrumbList")) {
          const items = node.itemListElement;
          if (!Array.isArray(items) || items.length < 1) {
            findings.push({ pathname, check: "breadcrumb-jsonld-empty", block: index + 1 });
          } else {
            for (const [itemIndex, item] of items.entries()) {
              if (item?.["@type"] !== "ListItem" || item.position !== itemIndex + 1 || !item.name || !item.item) {
                findings.push({ pathname, check: "breadcrumb-jsonld-invalid", block: index + 1, position: itemIndex + 1 });
                continue;
              }
              try {
                const url = new URL(item.item);
                if (url.origin === origin) structuredLinks.add(normalizePath(url));
              } catch {
                findings.push({ pathname, check: "breadcrumb-url-not-absolute", block: index + 1, item: item.item });
              }
            }
            try {
              if (normalizePath(items.at(-1).item) !== pathname) findings.push({ pathname, check: "breadcrumb-current-page-mismatch", item: items.at(-1).item });
            } catch { /* The invalid absolute URL is reported above. */ }
          }
        }
        if (types.includes("Organization")) {
          if (!node.name || !node.url || !node.logo || !Array.isArray(node.sameAs) || !node.sameAs.length || !node.contactPoint) {
            findings.push({ pathname, check: "organization-jsonld-incomplete", block: index + 1 });
          }
        }
        if (types.includes("WebSite") && (!node.name || !node.url || !node.publisher)) {
          findings.push({ pathname, check: "website-jsonld-incomplete", block: index + 1 });
        }
        if (types.includes("Person") && (!node.name || !node.url || !node.worksFor)) {
          findings.push({ pathname, check: "person-jsonld-incomplete", block: index + 1 });
        }
        if (types.includes("WebApplication") && (!node.name || !node.url || !node.applicationCategory || !node.operatingSystem)) {
          findings.push({ pathname, check: "webapplication-jsonld-incomplete", block: index + 1, name: node.name ?? "" });
        }
        if ((types.includes("Article") || types.includes("BlogPosting")) && (!node.headline || !node.mainEntityOfPage || !node.author || !node.publisher)) {
          findings.push({ pathname, check: "article-jsonld-incomplete", block: index + 1, types });
        }
        if (types.includes("Dataset") && (!node.name || !node.description || !node.creator || !node.license || !node.measurementTechnique)) {
          findings.push({ pathname, check: "dataset-jsonld-incomplete", block: index + 1 });
        }
      }
    } catch (error) {
      findings.push({ pathname, check: "jsonld-invalid", block: index + 1, detail: error instanceof Error ? error.message : String(error) });
    }
  }
}

await mkdir(evidenceRoot, { recursive: true });
const findings = [];
const typeCounts = {};
const pageInventory = [];
const server = shouldStartServer
  ? spawn(process.execPath, [nextCli, "start", "-H", "127.0.0.1", "-p", String(port)], { cwd: process.cwd(), shell: false, stdio: "inherit", env: { ...auditEnvironment, PORT: String(port) } })
  : null;

let result;
try {
  if (server) await waitForServer();

  const routeAudit = shouldAuditRoutes ? await runRouteAudit() : { code: 0, stdout: "", stderr: "" };
  let routeSummary = null;
  if (shouldAuditRoutes) {
    try { routeSummary = JSON.parse(routeAudit.stdout); } catch { /* Report the malformed result below. */ }
    if (routeAudit.code !== 0 || !routeSummary) findings.push({ check: "route-audit", exitCode: routeAudit.code, detail: routeAudit.stderr || routeAudit.stdout.slice(0, 1_000) });
  }

  const robots = await fetchText("/robots.txt");
  if (robots.status !== 200 || !robots.contentType.includes("text/plain")) findings.push({ pathname: "/robots.txt", check: "robots-response", status: robots.status, contentType: robots.contentType });
  if (![...allowedPublicOrigins].some((siteOrigin) => robots.body.includes(`Sitemap: ${siteOrigin}/sitemap.xml`))) {
    findings.push({ pathname: "/robots.txt", check: "robots-sitemap" });
  }
  if (!robots.body.includes("Content-Signal: search=yes, ai-input=yes")) findings.push({ pathname: "/robots.txt", check: "content-signal" });
  for (const bot of REQUIRED_AI_BOTS) if (!robots.body.includes(`User-Agent: ${bot}`)) findings.push({ pathname: "/robots.txt", check: "ai-bot-missing", bot });

  const sitemapIndex = await fetchText("/sitemap.xml");
  if (sitemapIndex.status !== 200 || !sitemapIndex.contentType.includes("xml")) findings.push({ pathname: "/sitemap.xml", check: "sitemap-index-response", status: sitemapIndex.status, contentType: sitemapIndex.contentType });
  const sitemapLocations = locs(sitemapIndex.body);
  if (!sitemapLocations.length || new Set(sitemapLocations).size !== sitemapLocations.length) findings.push({ pathname: "/sitemap.xml", check: "sitemap-index-locations" });
  for (const record of sitemapRecords(sitemapIndex.body)) {
    try {
      if (!allowedPublicOrigins.has(new URL(record.loc).origin)) findings.push({ pathname: "/sitemap.xml", check: "sitemap-cross-origin-location", location: record.loc });
    } catch { findings.push({ pathname: "/sitemap.xml", check: "sitemap-invalid-location", location: record.loc }); }
    if (record.lastmod && (!/^\d{4}-\d{2}-\d{2}$/.test(record.lastmod) || Date.parse(record.lastmod) > Date.now() + 86_400_000)) {
      findings.push({ pathname: "/sitemap.xml", check: "sitemap-invalid-lastmod", lastmod: record.lastmod });
    }
  }
  const sitemapResponses = await inBatches(sitemapLocations, (location) => fetchText(new URL(location).pathname), 4);
  for (const response of sitemapResponses) {
    if (response.status !== 200 || !response.contentType.includes("xml")) findings.push({ pathname: response.pathname, check: "sitemap-response", status: response.status, contentType: response.contentType });
    for (const record of sitemapRecords(response.body)) {
      try {
        if (!allowedPublicOrigins.has(new URL(record.loc).origin)) findings.push({ pathname: response.pathname, check: "sitemap-cross-origin-location", location: record.loc });
      } catch { findings.push({ pathname: response.pathname, check: "sitemap-invalid-location", location: record.loc }); }
      if (record.lastmod && (!/^\d{4}-\d{2}-\d{2}$/.test(record.lastmod) || Date.parse(record.lastmod) > Date.now() + 86_400_000)) {
        findings.push({ pathname: response.pathname, check: "sitemap-invalid-lastmod", location: record.loc, lastmod: record.lastmod });
      }
    }
  }
  const publicUrls = sitemapResponses.flatMap((response) => locs(response.body));
  const publicPaths = publicUrls.map(normalizePath);
  const publicPathSet = new Set(publicPaths);
  if (publicPathSet.size !== publicPaths.length) findings.push({ check: "duplicate-sitemap-url", duplicates: publicPaths.filter((path, index) => publicPaths.indexOf(path) !== index) });
  for (const path of REQUIRED_PUBLIC_PATHS) if (!publicPathSet.has(path)) findings.push({ pathname: path, check: "required-public-path-not-sitemapped" });
  for (const path of PRIVATE_PATHS) if (publicPathSet.has(path)) findings.push({ pathname: path, check: "private-path-sitemapped" });
  for (const path of PUBLIC_NOINDEX_PATHS) if (publicPathSet.has(path)) findings.push({ pathname: path, check: "noindex-path-sitemapped" });

  const auditedPathSet = new Set([...publicPathSet, ...TEMPLATE_AUDIT_PATHS]);
  const publicPages = await inBatches([...auditedPathSet], fetchText, 8);
  const discoveredLinks = new Set();
  const structuredLinks = new Set();
  const socialImages = new Set();
  for (const page of publicPages) {
    const isSitemapped = publicPathSet.has(page.pathname);
    if (page.status !== 200 || !page.contentType.includes("text/html")) {
      findings.push({ pathname: page.pathname, check: "audited-page-response", status: page.status, contentType: page.contentType, error: page.error ?? "" });
      continue;
    }
    const pageText = textContent(page.body);
    const titles = [...page.body.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map((match) => textContent(match[1]));
    if (titles.length !== 1 || !titles[0]) findings.push({ pathname: page.pathname, check: "title", count: titles.length });
    const titleLength = [...(titles[0] ?? "")].length;
    if (titles[0] && (titleLength < TITLE_MIN || titleLength > TITLE_MAX)) findings.push({ pathname: page.pathname, check: "title-length", length: titleLength, title: titles[0] });
    const descriptions = metas(page.body, "description").filter((meta) => meta.content);
    if (descriptions.length !== 1) findings.push({ pathname: page.pathname, check: "meta-description", count: descriptions.length });
    const description = decodeHtml(descriptions[0]?.content ?? "");
    const descriptionLength = [...description].length;
    if (description && (descriptionLength < DESCRIPTION_MIN || descriptionLength > DESCRIPTION_MAX)) findings.push({ pathname: page.pathname, check: "description-length", length: descriptionLength });
    const canonicals = links(page.body, "canonical").filter((link) => link.href);
    if (canonicals.length !== 1) findings.push({ pathname: page.pathname, check: "canonical-count", count: canonicals.length });
    else {
      try {
        const canonical = new URL(decodeHtml(canonicals[0].href));
        if (canonical.origin !== origin || normalizePath(canonical) !== page.pathname || canonical.search || canonical.hash) {
          findings.push({ pathname: page.pathname, check: "canonical-mismatch", canonical: canonical.toString() });
        }
      } catch { findings.push({ pathname: page.pathname, check: "canonical-not-absolute", canonical: canonicals[0].href }); }
    }
    const robotsMeta = metas(page.body, "robots").map((meta) => meta.content?.toLowerCase() ?? "").join(",");
    if (isSitemapped && (robotsMeta.includes("noindex") || page.xRobotsTag.toLowerCase().includes("noindex"))) findings.push({ pathname: page.pathname, check: "sitemapped-page-noindex" });
    if (isSitemapped && /(?:private|no-store)/i.test(page.cacheControl)) findings.push({ pathname: page.pathname, check: "public-page-cache-policy", cacheControl: page.cacheControl });
    const expectedLanguage = LOCALE_PATHS.get(page.pathname) ?? "en";
    const htmlLanguage = decodeHtml(tags(page.body, "html")[0]?.lang ?? "");
    if (htmlLanguage !== expectedLanguage) findings.push({ pathname: page.pathname, check: "html-language", expected: expectedLanguage, actual: htmlLanguage });
    const h1s = headingTexts(page.body, 1);
    const h1Count = h1s.length;
    if (h1Count !== 1) findings.push({ pathname: page.pathname, check: "h1-count", count: h1Count });
    if (pageText.length < 200) findings.push({ pathname: page.pathname, check: "thin-rendered-content" });
    for (const pattern of FORBIDDEN_STALE_CLAIMS) if (pattern.test(pageText)) findings.push({ pathname: page.pathname, check: "stale-feature-claim", pattern: pattern.source });
    for (const pattern of FORBIDDEN_UNSUPPORTED_CLAIMS) if (pattern.test(pageText)) findings.push({ pathname: page.pathname, check: "unsupported-public-claim", pattern: pattern.source });

    const metaTags = tags(page.body, "meta");
    const requiredOpenGraph = ["og:title", "og:description", "og:url", "og:type", "og:image"];
    for (const property of requiredOpenGraph) {
      const matches = metaTags.filter((meta) => meta.property?.toLowerCase() === property && meta.content);
      if ((property === "og:image" && matches.length < 1) || (property !== "og:image" && matches.length !== 1)) {
        findings.push({ pathname: page.pathname, check: "open-graph-property", property, count: matches.length });
      }
    }
    const openGraphUrl = firstMeta(page.body, "property", "og:url");
    try {
      if (new URL(openGraphUrl).origin !== origin || normalizePath(openGraphUrl) !== page.pathname) findings.push({ pathname: page.pathname, check: "open-graph-url-mismatch", openGraphUrl });
    } catch { findings.push({ pathname: page.pathname, check: "open-graph-url-invalid", openGraphUrl }); }
    const openGraphImage = firstMeta(page.body, "property", "og:image");
    if (openGraphImage) socialImages.add(openGraphImage);
    const twitterCards = metaTags.filter((meta) => meta.name?.toLowerCase() === "twitter:card" && meta.content);
    if (twitterCards.length !== 1) findings.push({ pathname: page.pathname, check: "twitter-card", count: twitterCards.length });
    const twitterTitle = firstMeta(page.body, "name", "twitter:title");
    if (page.pathname !== "/" && twitterTitle === "RoleSharp — AI Resume Builder for Any Company & Role") {
      findings.push({ pathname: page.pathname, check: "inherited-homepage-twitter-title" });
    }

    for (const image of tags(page.body, "img")) if (!("alt" in image)) findings.push({ pathname: page.pathname, check: "image-alt-missing", src: image.src ?? "" });

    const languageAlternates = links(page.body, "alternate")
      .filter((link) => link.hreflang && link.href)
      .map((link) => ({ hreflang: link.hreflang, href: decodeHtml(link.href) }));
    const shouldHaveLanguageAlternates = page.pathname === "/" || LOCALE_PATHS.has(page.pathname);
    if (shouldHaveLanguageAlternates) {
      const byLanguage = new Map(languageAlternates.map((alternate) => [alternate.hreflang, alternate.href]));
      if (byLanguage.size !== languageAlternates.length) findings.push({ pathname: page.pathname, check: "duplicate-hreflang" });
      for (const [language, expectedPath] of EXPECTED_LANGUAGE_ALTERNATES) {
        const href = byLanguage.get(language);
        if (!href || normalizePath(href) !== expectedPath) findings.push({ pathname: page.pathname, check: "hreflang-target", language, expectedPath, href: href ?? "" });
      }
      if (byLanguage.size !== EXPECTED_LANGUAGE_ALTERNATES.size) findings.push({ pathname: page.pathname, check: "hreflang-set-size", expected: EXPECTED_LANGUAGE_ALTERNATES.size, actual: byLanguage.size });
    } else if (languageAlternates.length) {
      findings.push({ pathname: page.pathname, check: "unexpected-hreflang", count: languageAlternates.length });
    }

    inspectJsonLd(page.pathname, page.body, findings, typeCounts, structuredLinks);
    const pageLinks = [];
    for (const match of page.body.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
      try {
        const url = new URL(match[1], origin);
        if (url.origin === origin && !url.pathname.startsWith("/_next/") && !url.pathname.startsWith("/api/") && !/\.(?:png|jpe?g|webp|svg|ico|css|js)$/i.test(url.pathname)) {
          const target = normalizePath(url);
          discoveredLinks.add(target);
          pageLinks.push(target);
        }
      } catch { /* Invalid hrefs are covered by browser QA. */ }
    }
    pageInventory.push({
      pathname: page.pathname,
      sitemapped: isSitemapped,
      title: titles[0] ?? "",
      titleLength,
      description,
      descriptionLength,
      canonical: firstLink(page.body, "canonical"),
      language: htmlLanguage,
      cacheControl: page.cacheControl,
      h1: h1s,
      openGraph: {
        title: firstMeta(page.body, "property", "og:title"),
        description: firstMeta(page.body, "property", "og:description"),
        url: firstMeta(page.body, "property", "og:url"),
        type: firstMeta(page.body, "property", "og:type"),
        image: openGraphImage,
      },
      twitter: {
        card: firstMeta(page.body, "name", "twitter:card"),
        title: firstMeta(page.body, "name", "twitter:title"),
        description: firstMeta(page.body, "name", "twitter:description"),
        image: firstMeta(page.body, "name", "twitter:image"),
      },
      alternates: languageAlternates,
      internalLinks: [...new Set(pageLinks)],
    });
  }

  const sitemappedInventory = pageInventory.filter((page) => page.sitemapped);
  for (const duplicate of groupDuplicates(sitemappedInventory, (page) => page.title)) findings.push({ check: "duplicate-title", ...duplicate });
  for (const duplicate of groupDuplicates(sitemappedInventory, (page) => page.description)) findings.push({ check: "duplicate-description", ...duplicate });

  const incoming = new Map([...publicPathSet].map((pathname) => [pathname, []]));
  for (const page of sitemappedInventory) {
    for (const target of page.internalLinks) if (incoming.has(target) && target !== page.pathname) incoming.get(target).push(page.pathname);
  }
  for (const [pathname, sources] of incoming) if (pathname !== "/" && sources.length === 0) findings.push({ pathname, check: "orphan-sitemap-page" });

  const pageByPath = new Map(sitemappedInventory.map((page) => [page.pathname, page]));
  const depths = new Map([["/", 0]]);
  const queue = ["/"];
  while (queue.length) {
    const pathname = queue.shift();
    for (const target of pageByPath.get(pathname)?.internalLinks ?? []) {
      if (pageByPath.has(target) && !depths.has(target)) {
        depths.set(target, depths.get(pathname) + 1);
        queue.push(target);
      }
    }
  }
  for (const pathname of publicPathSet) {
    const depth = depths.get(pathname);
    if (depth === undefined) findings.push({ pathname, check: "sitemap-page-unreachable-from-home" });
    else if (depth > 3) findings.push({ pathname, check: "sitemap-page-click-depth", depth });
  }

  const noindexAuditPaths = [...PRIVATE_PATHS, ...PUBLIC_NOINDEX_PATHS];
  const privatePages = await inBatches(noindexAuditPaths, fetchText, 6);
  for (const page of privatePages) {
    if (page.status >= 500 || page.status === 0) findings.push({ pathname: page.pathname, check: "private-page-response", status: page.status });
    if (!page.contentType.includes("text/html")) continue;
    const robotsMeta = metas(page.body, "robots").map((meta) => meta.content?.toLowerCase() ?? "").join(",");
    if (!robotsMeta.includes("noindex") && !page.xRobotsTag.toLowerCase().includes("noindex")) findings.push({ pathname: page.pathname, check: "private-page-indexable" });
  }

  const linkResults = await inBatches([...new Set([...discoveredLinks, ...structuredLinks])], fetchText, 8);
  const databaseAwareAudit = !shouldStartServer || auditEnvironment.DISABLE_DB !== "true";
  for (const link of linkResults) {
    if (link.status === 0 || link.status >= 400) {
      findings.push({ pathname: link.pathname, check: structuredLinks.has(link.pathname) ? "broken-structured-data-link" : "broken-internal-link", status: link.status, error: link.error ?? "" });
      continue;
    }
    if (link.status >= 300) {
      findings.push({ pathname: link.pathname, check: "redirecting-internal-link", status: link.status, location: link.location });
      continue;
    }
    if (!link.contentType.includes("text/html") || publicPathSet.has(link.pathname)) continue;
    const robots = metas(link.body, "robots").map((meta) => meta.content?.toLowerCase() ?? "").join(",");
    const indexable = !robots.includes("noindex") && !link.xRobotsTag.toLowerCase().includes("noindex");
    const dataDependentMarket = /^\/(?:jobs|internships)\/[^/]+$/.test(link.pathname);
    if (indexable && (!dataDependentMarket || databaseAwareAudit)) findings.push({ pathname: link.pathname, check: "indexable-internal-page-not-sitemapped" });
  }

  const socialImageResults = await inBatches([...socialImages], (imageUrl) => fetchText(imageUrl, { method: "HEAD" }), 6);
  for (const imageResult of socialImageResults) {
    if (imageResult.status !== 200 || !imageResult.contentType.startsWith("image/")) findings.push({ pathname: imageResult.pathname, check: "social-image-response", status: imageResult.status, contentType: imageResult.contentType });
  }

  const llms = await fetchText("/llms.txt");
  const llmsFull = await fetchText("/llms-full.txt");
  for (const resource of [llms, llmsFull]) {
    if (resource.status !== 200 || !resource.contentType.includes("text/plain")) findings.push({ pathname: resource.pathname, check: "llms-response", status: resource.status, contentType: resource.contentType });
    if (!/Daily Matches/i.test(resource.body) || !/application-by-email|application email/i.test(resource.body)) findings.push({ pathname: resource.pathname, check: "jobs-feature-discoverability" });
    if (!/not (?:an interview or ATS )?guarantee|not.*guarantee/i.test(resource.body)) findings.push({ pathname: resource.pathname, check: "ats-score-qualification-missing" });
    for (const pattern of FORBIDDEN_STALE_CLAIMS) if (pattern.test(resource.body)) findings.push({ pathname: resource.pathname, check: "stale-feature-claim", pattern: pattern.source });
  }
  const catalog = await fetchText("/.well-known/api-catalog");
  if (catalog.status !== 200 || !catalog.contentType.includes("application/linkset+json")) findings.push({ pathname: catalog.pathname, check: "api-catalog-response", status: catalog.status, contentType: catalog.contentType });
  else {
    try {
      const parsed = JSON.parse(catalog.body);
      const entry = parsed?.linkset?.[0];
      if (!entry?.anchor || !entry?.["service-doc"]?.some((item) => item.href === `${origin}/llms.txt`)) findings.push({ pathname: catalog.pathname, check: "api-catalog-linkset" });
    } catch { findings.push({ pathname: catalog.pathname, check: "api-catalog-json" }); }
  }
  for (const markdownPath of ["/blog/ats-friendly-resume-2026.md", "/compare/rolesharp-vs-aiapply.md"]) {
    const markdown = await fetchText(markdownPath);
    if (markdown.status !== 200 || !markdown.contentType.includes("text/markdown")) findings.push({ pathname: markdown.pathname, check: "markdown-twin", status: markdown.status, contentType: markdown.contentType });
  }
  const redirect = await fetchText("/ats-resume-checker");
  if (![301, 308].includes(redirect.status) || normalizePath(redirect.location) !== "/checker") findings.push({ pathname: redirect.pathname, check: "canonical-redirect", status: redirect.status, location: redirect.location });
  const careersRedirect = await fetchText("/careers");
  if (![301, 308].includes(careersRedirect.status) || normalizePath(careersRedirect.location) !== "/roles") findings.push({ pathname: careersRedirect.pathname, check: "canonical-redirect", status: careersRedirect.status, location: careersRedirect.location });
  const buildPage = privatePages.find((page) => page.pathname === "/build");
  if (!buildPage || firstLink(buildPage.body, "canonical") === "" || normalizePath(firstLink(buildPage.body, "canonical")) !== "/resume-builder") {
    findings.push({ pathname: "/build", check: "canonical-owner", expected: "/resume-builder", actual: buildPage ? firstLink(buildPage.body, "canonical") : "" });
  }

  if (!typeCounts.Organization || !typeCounts.WebSite) findings.push({ check: "publisher-entity-schema", typeCounts });
  if (!typeCounts.Person || !typeCounts.AboutPage || !typeCounts.ContactPage) findings.push({ check: "trust-entity-schema", typeCounts });
  if (!typeCounts.BlogPosting || !typeCounts.Article || !typeCounts.Dataset) findings.push({ check: "editorial-schema", typeCounts });
  if (!typeCounts.FAQPage) findings.push({ check: "answer-focused-schema", typeCounts });
  if (!typeCounts.SoftwareApplication && !typeCounts.WebApplication) findings.push({ pathname: "/auto-apply", check: "feature-schema", typeCounts });
  const homeResponse = publicPages.find((page) => page.pathname === "/");
  if (!homeResponse?.body.includes("https://linkedin.com/company/rolesharpai")) findings.push({ pathname: "/", check: "organization-sameas-consistency" });

  findings.sort((left, right) => `${left.pathname ?? ""}|${left.check}`.localeCompare(`${right.pathname ?? ""}|${right.check}`));

  result = {
    schema: "rolesharp-search-surface-audit-v2",
    origin,
    passed: findings.length === 0,
    counts: {
      sitemapFiles: sitemapResponses.length,
      publicPages: publicPathSet.size,
      auditedPages: publicPages.length,
      privatePages: privatePages.length,
      discoveredInternalLinks: discoveredLinks.size,
      structuredInternalLinks: structuredLinks.size,
      socialImages: socialImages.size,
      titleLength: {
        min: Math.min(...sitemappedInventory.map((page) => page.titleLength)),
        max: Math.max(...sitemappedInventory.map((page) => page.titleLength)),
      },
      descriptionLength: {
        min: Math.min(...sitemappedInventory.map((page) => page.descriptionLength)),
        max: Math.max(...sitemappedInventory.map((page) => page.descriptionLength)),
      },
      structuredDataTypes: typeCounts,
      routePages: routeSummary?.pageFiles ?? null,
      routeHandlers: routeSummary?.handlerFiles ?? null,
    },
    routeAudit: routeSummary,
    pages: pageInventory,
    findings,
  };
} catch (error) {
  result = { schema: "rolesharp-search-surface-audit-v2", origin, passed: false, findings: [{ check: "audit-runner", detail: error instanceof Error ? error.message : String(error) }] };
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}

const { pages: inventory = [], ...summary } = result;
await writeFile(resolve(evidenceRoot, "inventory.json"), `${JSON.stringify({ origin, pages: inventory }, null, 2)}\n`, "utf8");
await writeFile(resolve(evidenceRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (!result.passed) process.exitCode = 1;
