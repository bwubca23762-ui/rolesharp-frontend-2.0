import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const APP_DIR = join(process.cwd(), "app");
const BASE = process.env.ROUTE_AUDIT_BASE ?? "http://127.0.0.1:3000";
const REQUEST_TIMEOUT_MS = Number(process.env.ROUTE_AUDIT_TIMEOUT_MS ?? 15_000);
const AUDIT_MUTATIONS = process.env.ROUTE_AUDIT_MUTATIONS === "true";

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function routeFor(file) {
  const rel = relative(APP_DIR, file).split(sep).join("/");
  const route = rel.replace(/(?:^|\/)(?:page|route)\.(?:ts|tsx|js|jsx)$/, "");
  return route ? `/${route}` : "/";
}

function sampleRoute(pattern) {
  return pattern.replace(/\[([^\]]+)\]/g, (_match, key) => {
    if (key === "locale") return "en-us";
    if (key === "country" && (pattern.startsWith("/jobs") || pattern.startsWith("/internships"))) {
      return "united-states";
    }
    if (key === "country") return "us";
    if (key === "company") return "us-google";
    if (key === "role") return "software-engineer";
    if (key === "name") return "pages";
    if (key === "slug" && pattern.startsWith("/blog")) return "ats-friendly-resume-2026";
    if (key === "slug" && pattern.startsWith("/compare")) return "rolesharp-vs-aiapply";
    if (key === "id") return "00000000-0000-4000-8000-000000000000";
    return "sample";
  });
}

async function request(spec) {
  const { pathname, method = "GET" } = spec;
  const safe = method === "GET" || method === "HEAD";
  try {
    const response = await fetch(new URL(pathname, BASE), {
      method,
      redirect: "manual",
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        ...(safe ? {} : { "Content-Type": "application/json" }),
      },
      body: safe ? undefined : "{}",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    return { pathname, method, status: response.status, body, contentType: response.headers.get("content-type") ?? "" };
  } catch (error) {
    return { pathname, method, status: 0, body: "", contentType: "", error: error instanceof Error ? error.message : String(error) };
  }
}

async function inBatches(items, size = 6) {
  const results = [];
  for (let index = 0; index < items.length; index += size) {
    results.push(...await Promise.all(items.slice(index, index + size).map(request)));
  }
  return results;
}

const files = walk(APP_DIR);
// `walk()` returns native paths. Match both POSIX and Windows separators so a
// Windows audit cannot silently report zero discovered routes.
const pageFiles = files.filter((file) => /[\\/]page\.(?:ts|tsx|js|jsx)$/.test(file));
const handlerFiles = files.filter((file) => /[\\/]route\.(?:ts|tsx|js|jsx)$/.test(file));

const pages = pageFiles.map((file) => {
  const pattern = routeFor(file);
  return { file, pattern, pathname: sampleRoute(pattern), dynamic: pattern.includes("[") };
});
const handlers = handlerFiles.map((file) => {
  const source = readFileSync(file, "utf8");
  const methods = [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((match) => match[1]);
  const pattern = routeFor(file);
  return { file, pattern, pathname: sampleRoute(pattern), methods, dynamic: pattern.includes("[") };
});

const pageResults = await inBatches(pages.map((page) => ({ pathname: page.pathname, method: "GET" })));
const pageByPath = new Map(pageResults.map((result) => [result.pathname, result]));
const failures = [];

for (const page of pages) {
  const result = pageByPath.get(page.pathname);
  const intentionalProductionOnly404 = page.pattern.startsWith("/dev/") && result?.status === 404;
  if (!intentionalProductionOnly404 && (!result || result.status === 0 || result.status >= 500 || (!page.dynamic && result.status >= 400))) {
    failures.push({ kind: "page", file: relative(process.cwd(), page.file), pattern: page.pattern, ...result });
  }
}

const handlerRequests = handlers.flatMap((handler) => {
  const safeMethods = handler.methods.filter((method) => method === "GET" || method === "HEAD");
  const mutationMethods = AUDIT_MUTATIONS
    ? handler.methods.filter((method) => method !== "GET" && method !== "HEAD")
    : [];
  const methods = [...safeMethods, ...mutationMethods];
  // In production-safe mode, mutation-only handlers receive a non-mutating GET
  // boundary probe. CI enables method-specific requests against an offline DB.
  return (methods.length ? methods : ["GET"]).map((method) => ({
    pathname: handler.pathname,
    method,
    exported: handler.methods.includes(method),
    handler,
  }));
});
const handlerResults = await inBatches(handlerRequests);
const handlerByRequest = new Map(
  handlerResults.map((result) => [`${result.method} ${result.pathname}`, result]),
);
for (const handler of handlers) {
  const requests = handlerRequests.filter((request) => request.handler === handler);
  if (!handler.methods.length) {
    failures.push({ kind: "handler", file: relative(process.cwd(), handler.file), methods: [], pattern: handler.pattern, error: "no exported HTTP method" });
    continue;
  }
  for (const requestSpec of requests) {
    const result = handlerByRequest.get(`${requestSpec.method} ${requestSpec.pathname}`);
    const intentional503 = result?.status === 503 && requestSpec.pathname === "/api/pay/razorpay/webhook";
    if (
      !result ||
      result.status === 0 ||
      (result.status >= 500 && !intentional503) ||
      (requestSpec.exported && result.status === 405)
    ) {
      failures.push({
        kind: "handler",
        file: relative(process.cwd(), handler.file),
        methods: handler.methods,
        pattern: handler.pattern,
        ...result,
      });
    }
  }
}

const linkedPaths = new Set();
for (const result of pageResults) {
  if (!result.contentType.includes("text/html")) continue;
  for (const match of result.body.matchAll(/href=["'](\/[^"'#?\s]*)/g)) {
    const pathname = match[1].replace(/\/$/, "") || "/";
    if (!pathname.startsWith("/_next/") && !pathname.startsWith("/api/") && !/\.(?:png|jpe?g|webp|svg|ico|css|js|xml|txt)$/i.test(pathname)) {
      linkedPaths.add(pathname);
    }
  }
}
const linkedResults = await inBatches([...linkedPaths].map((pathname) => ({ pathname, method: "GET" })));
for (const result of linkedResults) {
  if (result.status === 0 || result.status >= 400) failures.push({ kind: "internal-link", ...result });
}

const summary = {
  base: BASE,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  mutationAudit: AUDIT_MUTATIONS,
  pageFiles: pages.length,
  handlerFiles: handlers.length,
  handlerRequests: handlerRequests.length,
  exportedMethodsExercised: handlerRequests.filter((request) => request.exported).length,
  mutationMethodsSkipped: AUDIT_MUTATIONS
    ? 0
    : handlers.reduce(
        (count, handler) => count + handler.methods.filter((method) => method !== "GET" && method !== "HEAD").length,
        0,
      ),
  concretePagePaths: new Set(pages.map((page) => page.pathname)).size,
  concreteHandlerPaths: new Set(handlers.map((handler) => handler.pathname)).size,
  discoveredInternalLinks: linkedPaths.size,
  intentionalProduction404s: pages.filter((page) => page.pattern.startsWith("/dev/") && pageByPath.get(page.pathname)?.status === 404).length,
  statuses: [...pageResults, ...handlerResults, ...linkedResults].reduce((counts, result) => {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
    return counts;
  }, {}),
  failures: failures.map((failure) => Object.fromEntries(
    Object.entries(failure).filter(([key]) => key !== "body"),
  )),
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
