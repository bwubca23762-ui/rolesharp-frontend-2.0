import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CUSTOM_ANALYTICS_RANGE_DAYS,
  lastDaysRange,
  parseAnalyticsRange,
  utcDayString,
} from "../lib/analytics-range";

// The admin range presets and the server range parser have to agree on what
// "last N days" means. Both ends are inclusive, so N days is an offset of N-1.
// Getting this wrong reads one extra day of traffic into every preset and is
// invisible in the UI, which is exactly why it is pinned here.
test("presets round-trip through the server parser with the exact day count", () => {
  for (const days of [1, 7, 30, 90, MAX_CUSTOM_ANALYTICS_RANGE_DAYS]) {
    const range = lastDaysRange(days);
    const parsed = parseAnalyticsRange(range.from, range.to);
    assert.ok(parsed, `range for ${days} days should parse`);
    assert.equal(parsed.days, days, `${days}-day preset should be ${days} days, got ${parsed.days}`);
  }
});

test("a one-day range starts and ends on the same UTC day", () => {
  const range = lastDaysRange(1);
  assert.equal(range.from, range.to);
  assert.equal(parseAnalyticsRange(range.from, range.to)?.days, 1);
});

test("presets stay inside the server's maximum range", () => {
  const tooLong = lastDaysRange(MAX_CUSTOM_ANALYTICS_RANGE_DAYS + 1);
  assert.throws(() => parseAnalyticsRange(tooLong.from, tooLong.to), /date_range_too_large/);
});

test("day strings are UTC, not local", () => {
  // 00:30 UTC on 2 March. Anywhere west of Greenwich the local date is still
  // 1 March, so a local-date implementation would return the wrong bucket.
  const now = new Date("2026-03-02T00:30:00.000Z");
  assert.equal(utcDayString(0, now), "2026-03-02");
  assert.equal(utcDayString(-1, now), "2026-03-01");
  // Crosses a month boundary and a leap-year February.
  assert.equal(utcDayString(-2, now), "2026-02-28");
  assert.equal(lastDaysRange(7, now).from, "2026-02-24");
});

test("a day count that is not a positive integer is rejected", () => {
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => lastDaysRange(bad), /invalid_day_count/, `${bad} should be rejected`);
  }
});
