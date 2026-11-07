import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// Every create/generate/check action must no-op a second activation. A
// disabled button alone cannot close the race between click #1 and the
// re-render (double-tap, fast pointer, assistive-tech double activation), so
// each handler carries an in-flight guard, and the builder's create path —
// the only one that mints a billable, persisted artifact per POST — is also
// idempotent server-side via the action_idempotency claim row.

test("the builder's generate path refuses a second concurrent activation", () => {
  const build = source("app/build/page.tsx");
  // Handler guard: the first line of generate(), before any fetch.
  assert.match(build, /async function generate\(\) \{\s*\n\s*if \(busy\) return;/);
  // isLoading carries the disabled + aria-busy contract in one prop.
  assert.match(build, /onConfirm=\{generate\}/);
  assert.match(source("app/build/generation-review.tsx"), /onClick=\{onConfirm\}[\s\S]*?disabled=\{busy\}/);
});

test("builder money actions cannot double-fire", () => {
  const build = source("app/build/page.tsx");
  // Payment: one click, one crypto order. Guard + try/finally + disabled CTA.
  assert.match(build, /async function upgrade\([^)]*\) \{\s*\n\s*if \(upgrading\) return;/);
  assert.match(build, /finally \{ setUpgrading\(false\); \}/);
  // isLoading carries the disabled + aria-busy contract in one prop.
  assert.match(build, /disabled=\{upgrading\} isLoading=\{upgrading\}/);
  // Premium actions (cover / interview / linkedin): guarded and re-armed in finally.
  assert.match(build, /if \(!out\?\.resumeId \|\| extraBusy\) return;/);
  assert.match(build, /finally \{ setExtraBusy\(false\); \}/);
  assert.match(build, /disabled=\{extraBusy \|\| upgrading\}/);
});

test("the generate API replays an identical request instead of creating a duplicate", () => {
  const route = source("app/api/generate/route.ts");
  // The claim rides the same idempotency table /api/improve uses, keyed on the
  // user + exact request content, with the pre-minted resumeId stored up front
  // so a loser of the claim race can still be handed a pollable id.
  assert.match(route, /action_idempotency/);
  assert.match(route, /'generate'/);
  assert.match(route, /jsonb_build_object\('resumeId', \$4::text\)/);
  assert.match(route, /const resumeId = randomUUID\(\);/);
  // Replay paths: a finished resume returns its content (200), an in-flight
  // one returns the same id to poll (202), and only a stale claim with nothing
  // to show is released.
  assert.match(route, /content: saved\.content, atsScore: saved\.ats_score, replayed: true/);
  assert.match(route, /status: "processing", replayed: true \}, \{ status: 202 \}/);
  assert.match(route, /15 \* 60_000/);
  // A claim taken but not enqueued must be released, or a retry would replay
  // a resume that was never created.
  const reserveFail = route.slice(route.indexOf("reserveGeneration(user.id, resumeId"), route.indexOf("let job;"));
  assert.match(reserveFail, /delete from action_idempotency/);
  const enqueueCatch = route.slice(route.indexOf("queue admission failed") - 600, route.indexOf("queue admission failed"));
  assert.match(enqueueCatch, /delete from action_idempotency/);
  // No claim table (DB-less dev): the shield stays off instead of 503-ing.
  assert.match(route, /if \(hasDb\(\)\) \{/);
});

test("a finally-failed generation releases its claim so a retry can run fresh", () => {
  const worker = source("worker/index.ts");
  assert.match(worker, /update action_idempotency set status='failed', updated_at=now\(\)/);
  assert.match(worker, /response->>'resumeId' = \$1/);
  // The claim release applies to every final failure, not only credit spends.
  const failedHandler = worker.slice(worker.indexOf('worker.on("failed"'), worker.indexOf("creditRefundQueue"));
  assert.doesNotMatch(failedHandler, /job\.data\.useCredit/);
});

const toolGuards: Array<[string, string, RegExp, RegExp]> = [
  ["resume maker export", "app/resume-maker/page.tsx", /async function exportFile\([^)]*\) \{\s*\n\s*if \(busy\) return;/, /disabled=\{!!busy\}/],
  ["resume fixer", "app/resume-fixer/page.tsx", /async function check\(\) \{\s*\n\s*if \(busy\) return;/, /disabled=\{!!busy\}/],
  ["resume checker", "app/checker/page.tsx", /async function check\(\) \{\s*\n\s*if \(busy\) return;/, /isLoading=\{busy\}/],
  ["linkedin checker", "app/linkedin-checker/page.tsx", /async function check\(\) \{\s*\n\s*if \(busy\) return;/, /isLoading=\{busy\}/],
  ["skill gap", "app/skill-gap/skill-gap-tool.tsx", /async function run\(\) \{\s*\n\s*if \(busy\) return;/, /disabled=\{busy\}/],
];

for (const [name, path, handlerGuard, disabledPin] of toolGuards) {
  test(`${name}: one click, one run (handler guard + disabled button)`, () => {
    const src = source(path);
    assert.match(src, handlerGuard, `${path} must no-op a second activation`);
    assert.match(src, disabledPin, `${path} button must be disabled while busy`);
  });
}

test("salary estimator: stacked lookups are closed on every entry path", () => {
  const src = source("app/salaries/salary-estimator-client.tsx");
  // Enter key and quick-role chips call lookup() directly — the handler guard
  // is what stops them stacking, and the chips are disabled for feedback.
  assert.match(src, /async function lookup\([^)]*\) \{\s*\n\s*if \(loading\) return;/);
  assert.match(src, /e\.key === "Enter" && !loading && void lookup\(\)/);
  assert.match(src, /disabled=\{loading \|\| dataUnavailable \|\| countries\.length === 0\}/);
});
