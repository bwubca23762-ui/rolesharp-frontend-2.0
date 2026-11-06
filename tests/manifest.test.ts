import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "../app/manifest";

const source = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

test("the manifest is installable: the fields a browser actually requires", () => {
  const m = manifest();
  assert.ok(m.name && m.short_name);
  assert.equal(m.start_url, "/");
  assert.equal(m.display, "standalone");
  // Chrome will not offer the install prompt without an icon of at least 192px.
  assert.ok(m.icons?.some((icon) => /512/.test(String(icon.sizes))));
});

test("every icon the manifest names exists on disk at the size it claims", () => {
  // A manifest pointing at a missing file fails silently: no install prompt, no
  // error anybody sees.
  for (const icon of manifest().icons ?? []) {
    const file = readFileSync(join(process.cwd(), "public", String(icon.src).replace(/^\//, "")));
    assert.equal(`${file.readUInt32BE(16)}x${file.readUInt32BE(20)}`, String(icon.sizes));
  }
});

test("a maskable icon is offered, not just any", () => {
  // Shipping only `any` gets the icon letterboxed inside a white circle on
  // Android's adaptive-icon shapes.
  const purposes = (manifest().icons ?? []).map((icon) => icon.purpose);
  assert.ok(purposes.includes("maskable"));
  assert.ok(purposes.includes("any"));
});

test("manifest and viewport agree on the theme colour", () => {
  // Two sources for one colour is how a splash screen ends up a different
  // shade from the page it opens.
  const layout = source("app/layout.tsx");
  assert.ok(layout.includes(String(manifest().theme_color)), "layout.tsx no longer uses the manifest theme colour");
});

test("no service worker was added with it", () => {
  // Deliberate: a stale cached shell serving an old build is a worse bug than
  // having no offline support. If one is ever added, this test is the reminder
  // to think about cache invalidation first.
  assert.throws(() => readFileSync(join(process.cwd(), "public", "sw.js")));
});
