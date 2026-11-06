import assert from "node:assert/strict";
import test from "node:test";
import { boundedPage } from "../lib/sql-search";

test("admin page offsets remain finite integers for malformed and extreme requests", () => {
  for (const input of [null, "", "Infinity", "NaN", "-100", "hello"]) assert.equal(boundedPage(input), 1);
  assert.equal(boundedPage("2.9"), 2);
  assert.equal(boundedPage("100000000000000000000"), 10000);
  assert.equal(boundedPage("25"), 25);
});
