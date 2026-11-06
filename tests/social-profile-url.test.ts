import assert from "node:assert/strict";
import test from "node:test";
import { socialProfileUrl } from "../lib/social-profile-url";

test("claim profile links stay on the declared social platform", () => {
  assert.equal(socialProfileUrl("x", "@rolesharpai"), "https://x.com/rolesharpai");
  assert.equal(socialProfileUrl("linkedin", "member-name"), "https://www.linkedin.com/in/member-name");
  for (const handle of ["https://evil.example", "../evil", "user?redirect=evil", ""]) assert.equal(socialProfileUrl("x", handle), null);
  assert.equal(socialProfileUrl("constructor", "valid"), null);
  assert.equal(socialProfileUrl("unknown", "valid"), null);
});
