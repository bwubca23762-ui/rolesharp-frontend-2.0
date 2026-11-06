import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FILLER_PHRASES,
  GUIDE_LIMITS,
  GUIDE_STEPS,
  bulletDemo,
} from "../lib/job-search-guide";
import { WEAK_PHRASES } from "../lib/resume-checker";
import { renderJobSearchGuidePdf } from "../lib/job-search-guide-pdf";

const source = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

test("the guide's filler list is the checker's list, not a copy of it", () => {
  // The whole claim of this page is that it comes from the product. A second
  // hand-maintained list would drift the moment the score changed, and the
  // guide would be advising against phrases nothing penalises.
  assert.deepEqual([...FILLER_PHRASES], [...WEAK_PHRASES]);
});

test("every step links somewhere that exists", () => {
  // A lead magnet is handed to people who have never used the site. A 404 in
  // it is worse than no link, and these hrefs are typed by hand.
  for (const step of GUIDE_STEPS) {
    if (!step.tool) continue;
    const route = step.tool.href.replace(/^\//, "");
    assert.ok(
      existsSync(join(process.cwd(), "app", route, "page.tsx")),
      `step ${step.n} links to ${step.tool.href}, which has no page`,
    );
  }
});

test("the steps are ordered and each one carries a rule and something to do", () => {
  assert.deepEqual(GUIDE_STEPS.map((s) => s.n), GUIDE_STEPS.map((_, i) => i + 1));
  for (const step of GUIDE_STEPS) {
    assert.ok(step.rule.length > 0, `step ${step.n} has no rule`);
    assert.ok(step.actions.length >= 2, `step ${step.n} says what to think, not what to do`);
  }
});

test("the demonstration shows a rewrite and a pass, not only complaints", () => {
  const demo = bulletDemo();
  assert.equal(demo.length, 3);
  // A "before/after" where nothing changes is not a demonstration.
  assert.ok(demo.some((r) => r.improved !== r.original), "no line was actually rewritten");
  assert.ok(demo.some((r) => r.notes.length > 0), "no line named what was missing");
  // The third line already has verb, result and number. If strengthenBullets
  // starts complaining about it, the guide shows the tool nagging a good bullet.
  assert.deepEqual(demo[2].notes, [], "the strong example picked up a note");
});

test("the guide says what it will not do", () => {
  assert.ok(GUIDE_LIMITS.length >= 3);
});

test("the guide renders to a real PDF", async () => {
  const pdf = await renderJobSearchGuidePdf();
  assert.ok(pdf.length > 5000, "a multi-page guide should not be near-empty");
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
});

test("the download route caches one render and does not cache a failure", () => {
  const route = source("app/api/job-search-guide/pdf/route.ts");
  // Rendering per request is the expensive part; caching a rejected promise is
  // how one bad render becomes a permanently broken endpoint.
  assert.match(route, /cached \?\?= renderJobSearchGuidePdf\(\)/);
  assert.match(route, /catch[\s\S]*cached = null/);
});

test("the guide is crawlable and reachable from the nav", () => {
  // It is a logged-out entry point. A guide nothing links to earns nothing.
  assert.match(source("app/sitemaps/[name]/route.ts"), /"\/job-search-guide"/);
  assert.match(source("app/navigation-registry.ts"), /href: "\/job-search-guide"/);
});
