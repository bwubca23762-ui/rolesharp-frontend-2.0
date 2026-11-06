import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("preview and development routes are hidden from search indexes", () => {
  const robots = read("app/robots.txt/route.ts");
  assert.ok(robots.includes('"/dev"'));
  for (const path of ["/landing-full", "/landing-preview"]) {
    assert.ok(!robots.includes(`"${path}"`), `crawlers must be able to read noindex on ${path}`);
  }
  assert.match(read("app/dev/jobs-primitives/layout.tsx"), /index: false, follow: false/);
  assert.match(read("app/landing-full/layout.tsx"), /index: false, follow: false/);
  assert.match(read("app/landing-preview/page.tsx"), /index: false, follow: false/);
  assert.match(read("app/api/pay/crypto/dev-confirm/route.ts"), /if \(env\.production\) return new NextResponse\("Not Found", \{ status: 404 \}\)/);
});

test("heavy route groups have error boundaries, and safe routes have loading boundaries", () => {
  const routes = ["jobs", "companies", "roles", "salaries", "interview-prep", "resumes", "auto-apply", "daily-matches"];
  for (const route of routes) {
    assert.ok(existsSync(join(process.cwd(), "app", route, "error.tsx")), `${route} error boundary missing`);
  }
  for (const route of ["interview-prep", "auto-apply", "daily-matches"]) {
    assert.ok(existsSync(join(process.cwd(), "app", route, "loading.tsx")), `${route} loading boundary missing`);
  }
  // A segment loading boundary streams 200 before notFound()/redirect() can
  // set the correct status. Keep it off these route trees by design.
  for (const route of ["jobs", "companies", "roles", "salaries", "resumes"]) {
    assert.ok(!existsSync(join(process.cwd(), "app", route, "loading.tsx")), `${route} can return a real 404/redirect`);
  }
});

test("legacy account and overview entries resolve to canonical workspace routes", () => {
  assert.match(read("app/overview/page.tsx"), /permanentRedirect\(\"\/dashboard\"\)/);
  assert.match(read("app/account/page.tsx"), /redirect\(\"\/settings\?tab=account\"\)/);
  const settings = read("app/settings/page.tsx");
  for (const tab of ["billing", "credits", "account"]) assert.ok(settings.includes(`\"${tab}\"`));
});

test("legacy counters and empty states delegate to shared UI primitives", () => {
  assert.match(read("app/count-up.tsx"), /<AnimatedCounter/);
  assert.match(read("components/ui/EmptyState.tsx"), /<PrimitiveEmptyState/);
});

test("migration discovery sorts complete SQL filenames deterministically", () => {
  assert.match(read("scripts/verify-db-integrity.ts"), /filter\(\(name\) => name\.endsWith\("\.sql"\)\)\.sort\(\)/);
  const migrations = readdirSync(join(process.cwd(), "db/migrations")).filter((name) => name.endsWith(".sql"));
  const sorted = [...migrations].sort();
  assert.deepEqual(sorted, [...sorted].sort());
  for (const prefix of ["055_", "056_", "057_"]) {
    const pair = sorted.filter((name) => name.startsWith(prefix));
    assert.equal(pair.length, 2, `expected both migrations with ${prefix} prefix`);
    assert.deepEqual(pair, [...pair].sort());
  }
});
