import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  comparisonWinnerCounts,
  getCompetitor,
  isCompetitorEvidenceCurrent,
  rowHasCurrentEvidence,
} from "../content/competitors.ts";
import { competitorToMarkdown } from "../lib/md-render.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function kickresume() {
  const competitor = getCompetitor("rolesharp-vs-kickresume");
  assert.ok(competitor, "Kickresume comparison must exist");
  return competitor;
}

test("Kickresume comparison removes contradicted headline claims from every static source", () => {
  const competitor = kickresume();
  const serialized = JSON.stringify(competitor);
  const comparisonGrid = source("components/CompareTable.tsx");

  for (const stale of [
    "1 free resume total",
    "1 resume total",
    "Kickresume $19/mo",
    "Kickresume: 1 free",
    "Kickresume offers a discount",
    "Kickresume generates and formats well but doesn't do company-specific tailoring",
  ]) {
    assert.ok(!serialized.includes(stale), `stale Kickresume claim remained in competitor data: ${stale}`);
    assert.ok(!comparisonGrid.includes(stale), `stale Kickresume claim remained in comparison grid: ${stale}`);
  }

  assert.match(serialized, /Free creation and downloads while using free customization options/);
  assert.match(serialized, /Free score advertised; deeper word analysis promoted as Premium/);
  assert.match(serialized, /ISIC, ITIC, or UNiDAYS/);
  assert.match(serialized, /Accepts job title, company name, and full job ad/);
  assert.match(comparisonGrid, /Variable — verify current pricing/);
});

test("disputed and expired evidence fails closed instead of contributing a winner", () => {
  const competitor = kickresume();
  const pricing = competitor.rows.find((row) => row.feature === "Premium pricing");
  assert.ok(pricing);
  assert.equal(rowHasCurrentEvidence(competitor, pricing, "2026-08-03"), false);

  const currentCounts = comparisonWinnerCounts(competitor, "2026-08-03");
  assert.deepEqual(currentCounts, { us: 0, them: 1, comparable: 7 });

  const expiredCounts = comparisonWinnerCounts(competitor, "2026-12-01");
  assert.deepEqual(expiredCounts, { us: 0, them: 0, comparable: 1 });

  const freeAccess = competitor.evidence?.find((item) => item.id === "kickresume-free-access");
  assert.ok(freeAccess);
  assert.equal(isCompetitorEvidenceCurrent(freeAccess, "2026-09-03"), true);
  assert.equal(isCompetitorEvidenceCurrent(freeAccess, "2026-09-04"), false);
});

test("Markdown and HTML use the same governed comparison and label non-current evidence", () => {
  const competitor = kickresume();
  const markdown = competitorToMarkdown(competitor, "https://rolesharp.com");
  const htmlSource = source("app/compare/[slug]/page.tsx");
  const markdownRoute = source("app/compare-md/[slug]/route.ts");
  const llmsFull = source("app/llms-full.txt/route.ts");

  assert.match(markdown, /Evidence last captured 2026-08-03/);
  assert.match(markdown, /Premium pricing \(not scored — evidence disputed or due for review\)/);
  assert.match(markdown, /Varies by billing period, promotion, and potentially session or location/);
  assert.match(markdown, /## Evidence and review status/);
  assert.match(markdown, /https:\/\/www\.kickresume\.com\/en\/pricing\//);
  assert.match(markdown, /status: disputed; volatility: high/);
  assert.doesNotMatch(markdown, /1 resume total|Kickresume \$19\/mo|ATS score included free \|[^\n]*\| Paid/);

  assert.match(htmlSource, /comparisonWinnerCounts\(c\)/);
  assert.match(htmlSource, /rowHasCurrentEvidence\(c, r\)/);
  assert.match(htmlSource, /Expired, disputed, or non-equivalent claims are not counted as wins/);
  assert.match(htmlSource, /Evidence and review status/);
  assert.match(htmlSource, /href=\{item\.sourceUrl\}/);
  assert.match(markdownRoute, /competitorToMarkdown\(competitor, env\.siteUrl\)/);
  assert.match(llmsFull, /COMPETITORS\.map\(\(c\) => competitorToMarkdown\(c, site\)\)/);
});
