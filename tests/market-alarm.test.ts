import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { demandDecision } from "../lib/market-alarm";

const source = (path: string) => readFileSync(path, "utf8");

test("demand alarm rises only on a real base and a real jump", () => {
  // Small bases are noise: 3 vs 0 is not a trend.
  assert.equal(demandDecision(3, 0).rising, false);
  assert.equal(demandDecision(4, 2).rising, false);
  // No growth, no alarm.
  assert.equal(demandDecision(10, 10).rising, false);
  assert.equal(demandDecision(8, 12).rising, false);
  // Real jump over a real base.
  assert.equal(demandDecision(9, 5).rising, true);
  assert.equal(demandDecision(9, 5).multiplier, 1.8);
  // Below the 1.5× threshold stays quiet.
  assert.equal(demandDecision(7, 5).rising, false);
});

test("the alarm frames the signal as our index, never the whole market", () => {
  const banner = source("components/dashboard/MarketAlarm.tsx");
  assert.match(banner, /RoleSharp&rsquo;s job index, not\s*the whole market|our index/u);
  // No signal → renders nothing.
  assert.match(banner, /if \(!done \|\| !signal\) return null;/u);
  const lib = source("lib/market-alarm.ts");
  assert.match(lib, /from job_campaigns/u);
  assert.match(lib, /desiredTitles/u);
  // Two dated counts only — no query of user text into the index.
  assert.match(lib, /interval '7 days'/u);
  const route = source("app/api/market-alarm/route.ts");
  assert.match(route, /currentUser/u);
});
