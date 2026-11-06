import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TtlCache } from "../lib/ttl-cache.ts";
import { bulletLines, parseEducation, parseProjects, splitList } from "../lib/resume-form/parse.ts";
import { countryDisplayName, seoCountryName } from "../lib/country-display.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("large application CSS is not inlined into HTML and RSC", () => {
  const config = source("next.config.ts");
  assert.doesNotMatch(config, /inlineCss\s*:\s*true/);
});

test("legacy compatibility CSS cannot grow beyond its audited budget", () => {
  const compatFiles = [
    "shared.css",
    "admin.css",
    "marketing.css",
    "auth.css",
    "tool.css",
    "legacy-bridge.css",
  ];
  const stylesheet = compatFiles
    .map((f) => source(`app/compat/${f}`))
    .join("\n");
  const bytes = Buffer.byteLength(stylesheet, "utf8");
  assert.ok(bytes <= 210_000, `compat CSS grew to ${bytes.toLocaleString()} bytes`);
  assert.equal(
    stylesheet.match(/ROLESHARP FRONTEND SYSTEM — FINAL RESPONSIVE LAYER/gu)?.length,
    1,
    "the final responsive layer must not be copied again",
  );
  assert.doesNotMatch(stylesheet, /End-of-file cascade marker/);
});

test("public shell has one shared session owner", () => {
  const shell = source("app/app-shell.tsx");
  const nav = source("app/nav.tsx");
  assert.match(shell, /<SessionProvider>/);
  assert.match(nav, /useSession\(\)/);
  assert.doesNotMatch(nav, /fetch\(["']\/api\/me/);
  assert.equal(source("app/session-context.tsx").match(/fetch\(["']\/api\/me/g)?.length, 1);
});

test("non-overview admin views use the lightweight session endpoint", () => {
  const panel = source("app/admin/admin-panel.tsx");
  assert.match(panel, /const sessionResponse = await fetch\("\/api\/admin\/session"/);
  assert.match(panel, /if \(includeStats && sessionData\.principal\.permissions\.includes\("analytics\.read"\)\)/);
  assert.match(panel, /if \(includeStats[\s\S]*?await fetch\(`\/api\/admin\/stats\$\{opts\?\.fresh/);
  assert.match(panel, /view === "overview" \|\| view === "system"/);
  assert.match(source("app/api/admin/stats/route.ts"), /STATS_TTL_MS = 15_000/);
  assert.match(source("app/api/admin/analytics/route.ts"), /new TtlCache<Record<string, unknown>>\(20, 30_000\)/);
});

test("generation responds asynchronously and no longer waits for QueueEvents", () => {
  const route = source("app/api/generate/route.ts");
  assert.match(route, /\{ status: 202 \}/);
  assert.doesNotMatch(route, /waitUntilFinished|resumeEvents/);
  assert.doesNotMatch(source("lib/queue.ts"), /QueueEvents/);
});

test("builder autocomplete cancels requests and rejects stale responses", () => {
  const hook = source("app/build/use-autocomplete.ts");
  const companyRoute = source("app/api/companies/search/route.ts");
  assert.match(hook, /new AbortController\(\)/);
  assert.match(hook, /requestSequence/);
  assert.match(hook, /controller\.abort\(\)/);
  assert.match(companyRoute, /new TtlCache<CompanyResult>\(200, 30_000\)/);
  assert.match(companyRoute, /connection\.get\(sharedKey\)/);
  assert.match(companyRoute, /connection\.set\(sharedKey, JSON\.stringify\(results\), "EX", SHARED_CACHE_TTL_SECONDS\)/);
});

test("stable catalogues and fuzzy role search have origin-level performance guards", () => {
  const countries = source("app/api/countries/route.ts");
  assert.match(countries, /export const revalidate = 300/);
  assert.match(source("lib/country-list.ts"), /includeRules \? "detailed" : "summary"/);
  assert.match(source("db/migrations/028_role_search_index.sql"), /create index concurrently if not exists roles_title_trgm/);
  assert.match(source("db/migrations/028_role_search_index.sql"), /title gin_trgm_ops/);
});

test("role-content hubs cap repeated cards and link to the complete directory", () => {
  for (const file of [
    "app/resume-examples/page.tsx",
    "app/cover-letter-examples/page.tsx",
    "app/careers/page.tsx",
  ]) {
    assert.match(source(file), /seoRoleList\(80\)/);
  }
  assert.match(source("app/resume-examples/page.tsx"), /href="\/roles"/);
});

test("bounded TTL cache expires and evicts least recently used entries", async () => {
  const cache = new TtlCache<number>(2, 15);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.get("a"), 1);
  cache.set("c", 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("c"), undefined);
});

test("shared resume form parsing preserves normalized form behavior", () => {
  assert.deepEqual(splitList("React, TypeScript; SQL\nNode"), ["React", "TypeScript", "SQL", "Node"]);
  assert.deepEqual(bulletLines("- Built one\n* Built two\n• Built three"), [
    "Built one",
    "Built two",
    "Built three",
  ]);
  assert.deepEqual(parseEducation("BSc | Example University | 2026 | Honours"), [
    { degree: "BSc", school: "Example University", year: "2026", detail: "Honours" },
  ]);
  assert.deepEqual(parseProjects("RoleSharp | Built | Shipped"), [
    { name: "RoleSharp", detail: "Built - Shipped" },
  ]);
});

test("country names are shared while preserving SEO articles", () => {
  assert.equal(seoCountryName("us"), "the United States");
  assert.equal(seoCountryName("xx"), null);
  assert.match(countryDisplayName("IN"), /India|IN/);
});

test("database and tailoring facades retain stable public entry points", () => {
  const database = source("lib/db.ts");
  assert.match(database, /export \{ hasDb, q, withTransaction \} from "\.\/db\/core"/);
  assert.match(database, /export \{ getCompanyBySlug, matchCompanyByText, searchCompanies \}/);
  // The names must stay exported from ./db/roles; the exact contents of the
  // braces must not be pinned. This asserted the literal line and failed the
  // moment a new export was added beside them, which is a refactor tax, not a
  // guarded invariant.
  // Split on commas rather than substring-matching: "listRoles" is a substring
  // of "listRolesWithSkills", so an includes() check passes even when the
  // export it is guarding has been deleted.
  const roleExports = (database.match(/export \{([^}]*)\} from "\.\/db\/roles"/)?.[1] ?? "")
    .split(",").map((name) => name.trim());
  for (const name of ["getRoleBySlug", "listRoles", "matchRoleByText", "searchRoles"]) {
    assert.ok(roleExports.includes(name), `lib/db.ts stopped re-exporting ${name}`);
  }
  assert.match(database, /from "\.\/db\/resumes"/);
  assert.match(database, /from "\.\/db\/applications"/);
  assert.match(database, /from "\.\/db\/support"/);
  assert.match(source("lib/tailor.ts"), /parseGeneratedContent.*tailor\/normalization/);
});

test("admin routes are split behind lazy boundaries", () => {
  const panel = source("app/admin/admin-panel.tsx");
  const lazyViews = panel.match(/dynamic\(/g) ?? [];
  assert.ok(lazyViews.length >= 10);
  assert.ok(panel.split(/\r?\n/).length < 900);
  assert.doesNotMatch(panel, /function (UsersView|ResumesView|PaymentsView|AnalyticsView)\(/);
});

test("public conversion surfaces keep truthful proof and interactive templates", () => {
  const proof = source("app/social-proof-band.tsx");
  const home = source("app/page.tsx");
  const hero = source("components/marketing/ModernHeroAndMethod.tsx");
  const templates = source("app/resume-templates/template-catalog.tsx");
  const banner = source("app/student-banner.tsx");

  assert.doesNotMatch(proof, /resumes scored/);
  assert.match(proof, /job markets available/);
  assert.match(proof, /Verifiable product coverage/);
  assert.match(proof, /How RoleSharp verifies claims/);
  assert.match(home, /<ModernHeroAndMethod[^>]*\/>/);
  // The 2026-10 rebuild brought TemplateStudio back into the landing
  // composition (owner direction), reversing the earlier Ink & Signal cut.
  assert.match(home, /<TemplateStudio \/>/);
  // The hero leads with the outcome headline; the honesty claims survive in
  // the subhead ("No borrowed titles. No invented metrics.").
  assert.match(hero, /evidence you already have/);
  assert.match(hero, /No borrowed titles/);
  assert.match(hero, /invented metrics/);
  assert.match(templates, /aria-label="Filter resume templates"/);
  assert.match(templates, /role="dialog"/);
  assert.match(banner, /Students get <strong>6 months free<\/strong>/);
  assert.match(banner, /Claim student access/);
});
