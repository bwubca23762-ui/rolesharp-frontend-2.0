import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { bookmarkletSource, decodeClip, encodeClip, CLIP_PARAM } from "../lib/job-clipper";
import { linkedinSyncPlan } from "../lib/linkedin-sync";

const source = (path: string) => readFileSync(path, "utf8");

const PROFILE = `Rhea Kumar
Senior Data Analyst at Northwind Retail
About
Analyst turning operations data into decisions.
Experience
Senior Data Analyst — Northwind Retail
Skills
SQL, Tableau, storytelling`;

const RESUME = `Rhea Kumar — Senior Data Analyst
Cut weekly reporting time 40% by rebuilding the warehouse pipeline in dbt, freeing 6 analyst hours per week.
Led the pricing dashboard adopted by 3 regional teams.
Skills: SQL, Python, dbt, Tableau`;

test("bookmarklet round-trips a posting through the clip param", () => {
  const code = bookmarkletSource("https://rolesharp.com/");
  assert.match(code, /^javascript:/u);
  assert.match(code, new RegExp(`/build\\?${CLIP_PARAM}=`));
  // No pointer to the clipboard API or network calls inside the bookmarklet.
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest/u);

  const clip = { t: "Data Analyst — Acme", u: "https://jobs.example.test/1", s: "X".repeat(120) };
  const encoded = encodeClip(clip);
  const decoded = decodeClip(encoded);
  assert.deepEqual(decoded, clip);
  // Junk and short clips are refused, not thrown.
  assert.equal(decodeClip("!!!not-base64!!!"), null);
  assert.equal(decodeClip(encodeClip({ t: "", u: "", s: "too short" })), null);
});

test("clipper page shows code as text, never a javascript: href", () => {
  const page = source("app/tools/job-clipper/job-clipper-client.tsx");
  assert.doesNotMatch(page, /href=\{?["']javascript:/u);
  assert.match(page, /bookmarkletSource/u);
  // The import hook lands the clip in the workspace JD slot and strips the param.
  const ctx = source("lib/workspace-context.ts");
  assert.match(ctx, /decodeClip/u);
  assert.match(ctx, /jdText: clip\.s/u);
  assert.match(ctx, /history\.replaceState/u);
});

test("sync plan separates evidenced-but-unlisted from listed-but-unevidenced", () => {
  const plan = linkedinSyncPlan(PROFILE, RESUME);
  // dbt and python are evidenced in the resume, absent from the profile.
  const missingOnLinkedIn = plan.missingOnLinkedIn.join(" ");
  assert.match(missingOnLinkedIn, /dbt|python/u);
  // "storytelling" is a profile skill the resume never backs.
  assert.match(plan.missingOnResume.join(" "), /storytelling/u);
  // Headline is a name + role, not a cliche — but under-length is reported honestly.
  assert.equal(plan.headline.flagged, false);
  assert.match(plan.headline.note, /characters used/u);
  // The profile carries About/Experience/Skills but no Education.
  assert.ok(plan.sectionGaps.some((gap) => gap.includes("Education")));
  assert.ok(!plan.sectionGaps.some((gap) => gap.includes("About section")));
});

test("sync flags seeker-cliche headlines and missing first lines", () => {
  const cliche = linkedinSyncPlan("Aspiring data professional seeking opportunities\nAbout\n...", RESUME);
  assert.equal(cliche.headline.flagged, true);
  assert.match(cliche.headline.note, /'seeking', not 'doing'/u);
  const empty = linkedinSyncPlan("", RESUME);
  assert.equal(empty.headline.flagged, true);
  assert.match(empty.headline.note, /No headline detected/u);
});
