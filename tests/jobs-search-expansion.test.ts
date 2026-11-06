import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { expandQueryWithTaxonomy } from "../lib/job-search-expansion";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("taxonomy expansion maps a query onto its same-family synonyms", () => {
  // "frontend engineer" is in the taxonomy with alias "frontend developer".
  const expanded = expandQueryWithTaxonomy("frontend engineer");
  assert.equal(expanded[0], "frontend engineer"); // original query always first
  assert.ok(expanded.some((term) => term.includes("frontend developer")));
  assert.ok(expanded.some((term) => term.includes("front end engineer")));
});

test("taxonomy expansion never crosses into related families", () => {
  // ux_research is a RELATED family of product_design — widening into it
  // would surprise the seeker, so it stays out.
  const expanded = expandQueryWithTaxonomy("ux designer");
  assert.ok(!expanded.some((term) => term.includes("research")));
});

test("taxonomy expansion leaves unknown queries alone", () => {
  assert.deepEqual(expandQueryWithTaxonomy("underwater welder"), ["underwater welder"]);
  assert.deepEqual(expandQueryWithTaxonomy(""), [""]);
});

test("taxonomy expansion handles embedded titles and caps the OR-group", () => {
  const expanded = expandQueryWithTaxonomy("senior frontend engineer remote");
  assert.ok(expanded.length >= 2);
  assert.ok(expanded.length <= 6);
});

test("search integration widens via the taxonomy but ranks synonyms below the typed query", () => {
  const jobs = source("lib/jobs.ts");
  assert.match(jobs, /import \{ expandQueryWithTaxonomy \} from "\.\/job-search-expansion"/);
  assert.match(jobs, /expandQueryWithTaxonomy\(rawQuery\)/);
  // Expanded terms each get a fully-escaped ILIKE clause, OR-ed together.
  assert.match(jobs, /clauses\.join\(" or "\)/);
  // Direct title hits score 3, synonym hits 1.5 — recall widens without the
  // exact ask ever ranking below its own synonyms.
  assert.match(jobs, /then 3\$\{expanded \? " else 1\.5" : " else 0"\} end/);
});
