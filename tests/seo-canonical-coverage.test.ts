import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// app/layout.tsx sets the site-wide canonical and eleven hreflang alternates.
// Next merges metadata down the layout chain, so a route that declares none of
// its own does not get "no canonical" — it silently inherits the homepage's,
// telling Google the page is a duplicate of "/". Nothing in the type system or
// the build catches that; a new page just quietly starts lying.
//
// This walks every route's own chain, deliberately STOPPING BEFORE the root
// layout — counting the root would make every page pass vacuously, which is the
// exact hole being guarded.

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(repoRoot, "app");

// Routes that legitimately declare nothing of their own.
const EXEMPT = new Set([
  "page.tsx", // the homepage — the root canonical is genuinely its canonical
]);

function read(path: string): string {
  try {
    return readFileSync(join(appDir, path), "utf8");
  } catch {
    return "";
  }
}

// A bare `redirect(...)` route never renders, so it never emits metadata.
function isRedirectOnly(source: string): boolean {
  return /\b(?:redirect|permanentRedirect)\(/u.test(source) && !/export const metadata|generateMetadata/u.test(source);
}

function declaresCanonical(source: string): boolean {
  return source.includes("alternates");
}

function declaresNoindex(source: string): boolean {
  return /index:\s*false|noindex/u.test(source);
}

function routePages(): string[] {
  return readdirSync(appDir, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith("page.tsx"))
    .map((entry) => entry.split("\\").join("/"));
}

test("every route declares its own canonical, or is explicitly exempt", () => {
  const offenders: string[] = [];

  for (const page of routePages()) {
    if (EXEMPT.has(page)) continue;

    const pageSource = read(page);
    if (isRedirectOnly(pageSource)) continue;

    let covered = false;
    // Walk up from the route's own directory, stopping before app/ itself.
    let dir = dirname(page);
    while (dir !== "." && !covered) {
      for (const candidate of [`${dir}/page.tsx`, `${dir}/layout.tsx`]) {
        const source = read(candidate);
        if (declaresCanonical(source) || declaresNoindex(source)) covered = true;
      }
      dir = dirname(dir);
    }

    if (!covered) offenders.push(page);
  }

  assert.deepEqual(
    offenders,
    [],
    `These routes declare neither a canonical nor noindex, so they inherit the homepage canonical and its eleven hreflangs:\n  ${offenders.join("\n  ")}\n` +
      "Fix by adding `alternates: { canonical: ... }` to the route's metadata, " +
      "or `robots: { index: false }` if it should not be indexed.",
  );
});

test("the guard is not vacuous — it rejects a route with no metadata of its own", () => {
  // Guards that silently pass are worse than no guard. Prove the predicates
  // actually reject the shape they exist to catch.
  assert.equal(declaresCanonical("export const metadata = { title: 'x' };"), false);
  assert.equal(declaresNoindex("export const metadata = { title: 'x' };"), false);
  assert.equal(isRedirectOnly("export const metadata = { title: 'x' };"), false);

  assert.equal(declaresCanonical("alternates: { canonical: '/x' }"), true);
  assert.equal(declaresNoindex("robots: { index: false }"), true);
  assert.equal(isRedirectOnly("import { redirect } from 'next/navigation';\nredirect('/y');"), true);
});

test("every route file the walker finds is readable", () => {
  const pages = routePages();
  assert.ok(pages.length > 50, `expected the app router tree, found ${pages.length} pages`);
  for (const page of pages) {
    assert.notEqual(read(page), "", `${relative(repoRoot, join(appDir, page))} could not be read`);
  }
});

test("retired company×role pairs redirect to the nearest defended page; unknown slugs still 404", () => {
  // The July 2026 sitemap published ~400 companies × the full role list
  // (~16k pair URLs). The curated gate has since shrunk, and Search Console
  // counted 16,177 "Not found (404)" for pairs that are retired, not fake.
  // The pair page must 308 a dead-but-real pair to the same company's first
  // allowed pair (or the examples hub), known legacy role aliases have a
  // relevant destination, and unknown companies/roles keep their 404.
  const page = read(join("resume", "[company]", "[role]", "page.tsx"));
  assert.match(page, /if \(!c\) notFound\(\);/u);
  assert.match(page, /if \(!r\) \{/u);
  assert.match(page, /LEGACY_ROLE_DESTINATIONS\[role\]/u);
  assert.match(page, /"data-scientist": \(company\) => `\/resume\/\$\{company\}\/data-scientists`/u);
  assert.match(page, /"product-manager": \(company\) => `\/companies\/\$\{company\}`/u);
  assert.match(page, /"ux-designer": \(company\) => `\/companies\/\$\{company\}`/u);
  assert.match(page, /notFound\(\);/u);
  assert.match(page, /permanentRedirect\(firstAllowed/u);
  assert.match(page, /roleSlugsForSector\(c\.sector\)\[0\]/u);
  assert.match(page, /"\/resume-examples"/u);
});
