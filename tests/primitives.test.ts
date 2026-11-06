// Source-contract tests for UI primitives.
//
// The project runs on Node's built-in test runner with tsx and does not
// configure a JSX-rendering harness (no React Testing Library). These tests
// follow the established convention (see tests/frontend-regression.test.ts):
// they read primitive source as text and assert the public API surface,
// variant set, and accessibility contracts remain stable. This catches
// regressions in exported names, variant tokens, focus-visible behaviour,
// motion-reduce guards, ARIA roles, and disabled states without needing a
// DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// This file used to sit in components/ui/primitives/__tests__/, which the
// runner's glob (tests/*.test.ts) never matched — so it never ran. Paths now
// resolve from tests/ like every other suite.
function source(name: string): string {
  return readFileSync(new URL(`../components/ui/primitives/${name}`, import.meta.url), "utf8");
}

// AccessibleDialog is a composite, not a leaf primitive, so it lives one
// directory above the primitives/ barrel.
function sourceUi(name: string): string {
  return readFileSync(new URL(`../components/ui/${name}`, import.meta.url), "utf8");
}

test("Button exports the full variant and size set with accessible motion guards", () => {
  const s = source("Button.tsx");
  assert.match(s, /export function Button/);
  assert.match(s, /export type ButtonProps/);
  // All required variants present.
  for (const v of ["primary", "primaryInverse", "secondary", "outline", "outlineInverse", "ghost", "danger", "accent"]) {
    assert.ok(s.includes(`${v}:`), `Button is missing the "${v}" variant`);
  }
  // Sizes.
  for (const sz of ["sm", "md", "lg"]) {
    assert.ok(s.includes(`${sz}:`), `Button is missing the "${sz}" size`);
  }
  // Loading affordance renders a spinner and disables interaction.
  assert.match(s, /isLoading/);
  assert.match(s, /animate-spin/);
  assert.match(s, /disabled:opacity-50/);
  assert.match(s, /disabled:cursor-not-allowed/);
  // The runtime disabled predicate combines the native `disabled` prop with
  // the loading state so a spinning button cannot be re-activated.
  assert.match(s, /disabled=\{disabled \|\| isLoading\}/);
  // Focus-visible + active feedback + reduced-motion guard.
  assert.match(s, /focus-visible:outline/);
  assert.match(s, /active:translate-y-px/);
  assert.match(s, /motion-reduce:transform-none/);
  // Anchor rendering path exists for `as="a"`.
  assert.match(s, /as === "a"/);
});

test("Card exposes every variant and padding token using semantic color vars", () => {
  const s = source("Card.tsx");
  assert.match(s, /export function Card/);
  for (const v of ["default", "elevated", "interactive", "glass", "gradient", "outline", "dark"]) {
    assert.ok(s.includes(`${v}:`), `Card is missing the "${v}" variant`);
  }
  for (const p of ["none", "sm", "md", "lg"]) {
    assert.ok(s.includes(`${p}:`), `Card is missing the "${p}" padding`);
  }
  // Uses the design token radius and shared transition list.
  assert.match(s, /rounded-\[var\(--radius-lg\)\]/);
  assert.match(s, /transition-\[transform,background-color,border-color,color,box-shadow,opacity\]/);
  // Interactive lift opt-in is present for the dedicated variant.
  assert.match(s, /rs-interactive-lift/);
});

test("Form controls render semantic tokens, focus rings, error affordance, and alert role", () => {
  const s = source("Form.tsx");
  assert.match(s, /export function Label/);
  assert.match(s, /export function Input/);
  assert.match(s, /export function Select/);
  assert.match(s, /export function Textarea/);
  // Named FieldError, not Error — the suite asserted the old name and rotted
  // undetected for as long as it sat outside the runner's glob.
  assert.match(s, /export function FieldError/);
  // Error text is surfaced with role="alert" for assistive tech.
  assert.match(s, /role="alert"/);
  // Error variant flips border + ring to the danger token.
  assert.match(s, /inputError/);
  assert.match(s, /var\(--color-danger\)/);
  // Inputs declare a focus ring + border token in both themes.
  assert.match(s, /focus:ring-2/);
  assert.match(s, /focus:ring-\[var\(--color-primary\)\]/);
  assert.match(s, /var\(--color-dark-border\)/);
  // Minimum tap target height is enforced.
  assert.match(s, /min-h-\[46px\]/);
});

test("Badge covers the full variant matrix with uppercase pill styling", () => {
  const s = source("Badge.tsx");
  assert.match(s, /export function Badge/);
  for (const v of ["default", "primary", "success", "warning", "danger", "premium", "info", "neutral", "outline"]) {
    assert.ok(s.includes(`${v}:`), `Badge is missing the "${v}" variant`);
  }
  assert.match(s, /rounded-full/);
  assert.match(s, /uppercase/);
  assert.match(s, /tracking-wide/);
});

test("EmptyState composes Card and exposes icon/title/description/actions slots", () => {
  const s = source("EmptyState.tsx");
  assert.match(s, /export function EmptyState/);
  // Built on the Card primitive, not a bespoke surface.
  assert.match(s, /import \{ Card \} from "\.\/Card"/);
  // Icon is decorative and hidden from AT.
  assert.match(s, /aria-hidden/);
  // Title is a heading for document outline.
  assert.match(s, /<h2/);
  // Compact density toggle exists.
  assert.match(s, /compact/);
});

test("AccessibleDialog implements focus trap, Escape dismiss, scroll lock, and focus return", () => {
  const s = sourceUi("AccessibleDialog.tsx");
  assert.match(s, /role="dialog"/);
  assert.match(s, /aria-modal="true"/);
  assert.match(s, /aria-label=\{label\}/);
  // Backdrop dismiss on explicit target (avoids closing on inner content).
  assert.match(s, /onMouseDown/);
  assert.match(s, /event\.target === event\.currentTarget/);
  // Escape closes without requiring a Tab traversal.
  assert.match(s, /Escape/);
  // Tab cycles within the dialog (focus trap).
  assert.match(s, /event\.shiftKey/);
  assert.match(s, /last\.focus\(\)/);
  assert.match(s, /first\.focus\(\)/);
  // Background scroll is locked while open.
  assert.match(s, /document\.body\.style\.overflow/);
  // Focus returns to the invoking control on close.
  assert.match(s, /returnFocusRef/);
  assert.match(s, /\.focus\(\)/);
  // The dialog container is programmatically focusable to seed initial focus.
  assert.match(s, /tabIndex=\{-1\}/);
});
