import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../components/ui/admin/button";
import { BreadcrumbLink } from "../components/ui/admin/breadcrumb";

test("admin link buttons slot icons and shortcuts into one anchor", () => {
  const html = renderToStaticMarkup(createElement(Button, {
    asChild: true,
    leftIcon: createElement("span", { "data-icon": "left" }, "↗"),
    rightIcon: createElement("span", { "data-icon": "right" }, "→"),
    shortcut: "G W",
  }, createElement("a", { href: "/admin/workflows" }, "Open workflows")));
  assert.equal((html.match(/<a\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<button/);
  assert.match(html, /href="\/admin\/workflows"/);
  assert.match(html, /data-icon="left"/);
  assert.match(html, /data-icon="right"/);
  assert.match(html, /<kbd[^>]*>G W<\/kbd>/);
});

test("loading labels preserve the slotted link and ordinary button content", () => {
  for (const asChild of [true, false]) {
    const child = asChild ? createElement("a", { href: "/admin/workflows" }, "Open workflows") : "Open workflows";
    const html = renderToStaticMarkup(createElement(Button, { asChild, isLoading: true, loadingText: "Loading…" }, child));
    assert.match(html, /Loading…/);
    assert.doesNotMatch(html, /Open workflows/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, asChild ? /<a\b/ : /<button\b/);
  }
});

test("breadcrumb links apply styles to their anchor rather than a fragment", () => {
  const html = renderToStaticMarkup(createElement(BreadcrumbLink, { asChild: true, className: "qa-breadcrumb" }, createElement("a", { href: "/admin" }, "Admin")));
  assert.match(html, /<a[^>]*class="[^"]*qa-breadcrumb/);
  assert.match(html, /href="\/admin"/);
  assert.equal((html.match(/<a\b/g) ?? []).length, 1);
});
