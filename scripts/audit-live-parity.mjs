import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? "") : fallback;
};

const origin = option("--base", "https://rolesharp.com").replace(/\/$/, "");
const inventoryPath = resolve(option("--local-inventory", ".omo/evidence/search-surfaces/inventory.json"));
const evidenceRoot = resolve(option("--evidence", ".omo/evidence/live-parity"));
const timeoutMs = Number(option("--timeout", "15000"));
const concurrency = Number(option("--concurrency", "12"));
if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error("invalid timeout");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error("invalid concurrency");

const FORBIDDEN_SITEMAP_PATHS = new Set(["/build", "/careers"]);
const DATA_BACKED_PATH = /^\/(?:companies|roles)\/[^/]+$|^\/resume\/[^/]+\/[^/]+$|^\/(?:jobs|internships)\/[^/]+$/;

const decodeHtml = (value) => String(value ?? "")
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&apos;", "'")
  .replaceAll("&nbsp;", " ");

const textContent = (value) => decodeHtml(String(value ?? "")
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim());

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? "");
  }
  return result;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => attributes(match[0]));
}

function meta(html, selector, value) {
  return tags(html, "meta").find((tag) => tag[selector]?.toLowerCase() === value.toLowerCase())?.content?.trim() ?? "";
}

function link(html, rel) {
  return tags(html, "link").find((tag) => (tag.rel ?? "").toLowerCase().split(/\s+/).includes(rel))?.href?.trim() ?? "";
}

function pathname(value) {
  try {
    const result = new URL(value, origin).pathname.replace(/\/$/, "");
    return result || "/";
  } catch {
    return "";
  }
}

function xmlLocations(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decodeHtml(match[1]).trim());
}

function jsonLdTypes(html) {
  const types = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if (value["@type"]) {
      for (const type of Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]]) types.add(type);
    }
    if (Array.isArray(value["@graph"])) value["@graph"].forEach(visit);
  };
  for (const block of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(block[1])); } catch { types.add("INVALID_JSON_LD"); }
  }
  return [...types].sort();
}

async function fetchText(url) {
  const started = performance.now();
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      cacheControl: response.headers.get("cache-control") ?? "",
      cfCacheStatus: response.headers.get("cf-cache-status") ?? "",
      durationMs: Math.round(performance.now() - started),
      body: await response.text(),
    };
  } catch (error) {
    return {
      status: 0,
      contentType: "",
      cacheControl: "",
      cfCacheStatus: "",
      durationMs: Math.round(performance.now() - started),
      body: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function inBatches(items, worker) {
  const output = [];
  for (let index = 0; index < items.length; index += concurrency) {
    output.push(...await Promise.all(items.slice(index, index + concurrency).map(worker)));
  }
  return output;
}

const localInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const localPages = new Map(localInventory.pages.filter((page) => page.sitemapped).map((page) => [page.pathname, page]));
let sitemapFileCount;
let livePaths;
let pages;
if (args.includes("--reuse")) {
  const cached = JSON.parse(await readFile(resolve(evidenceRoot, "inventory.json"), "utf8"));
  if (cached.origin !== origin || !Array.isArray(cached.pages)) throw new Error("cached live inventory does not match the requested origin");
  pages = cached.pages;
  livePaths = pages.map((page) => page.pathname).sort();
  sitemapFileCount = null;
} else {
  const sitemapIndex = await fetchText(`${origin}/sitemap.xml`);
  if (sitemapIndex.status !== 200) throw new Error(`sitemap index returned ${sitemapIndex.status || sitemapIndex.error}`);
  const sitemapUrls = xmlLocations(sitemapIndex.body);
  const sitemapResponses = await inBatches(sitemapUrls, fetchText);
  sitemapFileCount = sitemapResponses.length;
  livePaths = [...new Set(sitemapResponses.flatMap((response) => xmlLocations(response.body)).map(pathname).filter(Boolean))].sort();
  pages = await inBatches(livePaths, async (pagePath) => {
  const response = await fetchText(`${origin}${pagePath}`);
  const html = response.body;
  const title = textContent(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = meta(html, "name", "description");
  const canonical = link(html, "canonical");
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => textContent(match[1]));
  const language = attributes(html.match(/<html\b[^>]*>/i)?.[0] ?? "").lang ?? "";
  const robots = meta(html, "name", "robots").toLowerCase();
  const alternates = tags(html, "link")
    .filter((tag) => (tag.rel ?? "").toLowerCase().split(/\s+/).includes("alternate") && tag.hreflang)
    .map((tag) => ({ hreflang: tag.hreflang, pathname: pathname(tag.href) }))
    .sort((left, right) => left.hreflang.localeCompare(right.hreflang));
  return {
    pathname: pagePath,
    status: response.status,
    contentType: response.contentType,
    cacheControl: response.cacheControl,
    cfCacheStatus: response.cfCacheStatus,
    durationMs: response.durationMs,
    error: response.error ?? "",
    title,
    description,
    canonical,
    language,
    robots,
    h1,
    alternates,
    jsonLdTypes: jsonLdTypes(html),
  };
  });
}

const findings = [];
const drift = [];
const livePathSet = new Set(livePaths);
for (const expectedPath of localPages.keys()) {
  if (!livePathSet.has(expectedPath)) findings.push({ pathname: expectedPath, check: "missing-from-live-sitemap" });
}
for (const livePath of livePaths) {
  if (FORBIDDEN_SITEMAP_PATHS.has(livePath)) findings.push({ pathname: livePath, check: "forbidden-live-sitemap-path" });
  if (!localPages.has(livePath) && !DATA_BACKED_PATH.test(livePath)) {
    drift.push({ pathname: livePath, field: "sitemap", local: "missing", live: "present" });
  }
}

for (const page of pages) {
  if (page.status !== 200 || !page.contentType.includes("text/html")) {
    findings.push({ pathname: page.pathname, check: "page-response", status: page.status, error: page.error });
    continue;
  }
  if (!page.title) findings.push({ pathname: page.pathname, check: "missing-title" });
  if (!page.description) findings.push({ pathname: page.pathname, check: "missing-description" });
  if (page.h1.length !== 1) findings.push({ pathname: page.pathname, check: "h1-count", count: page.h1.length });
  if (pathname(page.canonical) !== page.pathname) findings.push({ pathname: page.pathname, check: "canonical", actual: page.canonical });
  if (page.robots.includes("noindex")) findings.push({ pathname: page.pathname, check: "sitemapped-noindex" });
  if (page.jsonLdTypes.includes("INVALID_JSON_LD")) findings.push({ pathname: page.pathname, check: "invalid-json-ld" });

  const local = localPages.get(page.pathname);
  if (!local) continue;
  for (const [field, localValue, liveValue] of [
    ["title", local.title, page.title],
    ["description", local.description, page.description],
    ["language", local.language, page.language],
    ["h1", JSON.stringify(local.h1), JSON.stringify(page.h1)],
    ["alternates", JSON.stringify((local.alternates ?? []).map((item) => ({ hreflang: item.hreflang, pathname: pathname(item.href) })).sort((left, right) => left.hreflang.localeCompare(right.hreflang))), JSON.stringify(page.alternates)],
  ]) {
    if (localValue !== liveValue) drift.push({ pathname: page.pathname, field, local: localValue, live: liveValue });
  }
}

const durations = pages.filter((page) => page.status > 0).map((page) => page.durationMs).sort((left, right) => left - right);
const percentile = (fraction) => durations[Math.min(durations.length - 1, Math.floor(durations.length * fraction))] ?? null;
const slowPages = pages
  .filter((page) => page.durationMs >= 5_000 || page.status === 0)
  .map(({ pathname: pagePath, status, durationMs, error, cfCacheStatus }) => ({ pathname: pagePath, status, durationMs, error, cfCacheStatus }))
  .sort((left, right) => right.durationMs - left.durationMs);
const liveOnlyDataPaths = livePaths.filter((pagePath) => !localPages.has(pagePath) && DATA_BACKED_PATH.test(pagePath));
const liveOnlyDataFamilies = Object.fromEntries([...new Set(liveOnlyDataPaths.map((pagePath) => pagePath.split("/")[1]))]
  .sort()
  .map((family) => [family, liveOnlyDataPaths.filter((pagePath) => pagePath.startsWith(`/${family}/`)).length]));

const result = {
  schema: "rolesharp-live-parity-v1",
  origin,
  passed: findings.length === 0,
  inSync: drift.length === 0,
  counts: {
    sitemapFiles: sitemapFileCount,
    livePages: livePaths.length,
    localPages: localPages.size,
    successfulPages: pages.filter((page) => page.status === 200).length,
    findings: findings.length,
    drift: drift.length,
    slowPages: slowPages.length,
    liveOnlyDataPages: liveOnlyDataPaths.length,
  },
  liveOnlyDataFamilies,
  latencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: durations.at(-1) ?? null },
  slowPages,
  findings,
  drift,
};

await mkdir(evidenceRoot, { recursive: true });
await writeFile(resolve(evidenceRoot, "inventory.json"), `${JSON.stringify({ origin, pages }, null, 2)}\n`, "utf8");
await writeFile(resolve(evidenceRoot, "summary.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.passed || !result.inSync) process.exitCode = 1;
