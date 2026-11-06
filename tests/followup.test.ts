import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { buildFollowupDraft, pickCitedBullet } from "../lib/followup";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// Follow-up drafts for quiet applications. Three absolute rules, each pinned:
// drafts only (nothing in this feature has a send path), claims only (every
// sentence traces to the application the candidate already submitted), and
// capped (two per application, seven days apart, enforced in SQL).

test("the draft is built entirely from submitted claims", () => {
  const draft = buildFollowupDraft({
    company: "Acme", role: "Data Analyst", appliedAt: "2026-08-01T00:00:00.000Z",
    followUpCount: 0, jobUrl: "https://jobs.example/1",
    candidateName: "Ravi Kumar",
    bullets: ["Cut regression time 40% by automating smoke suites.", "Wrote weekly SQL reports."],
    seed: 1,
  });
  assert.match(draft.subject, /Following up — Data Analyst application/u);
  assert.match(draft.body, /Data Analyst position on 2026-08-01/u);
  assert.ok(draft.body.includes("Acme team"));
  // The cited bullet is a real submitted claim, quoted verbatim.
  assert.ok(draft.body.includes(draft.citedBullet ?? ""));
  assert.equal(draft.citedBullet, "Cut regression time 40% by automating smoke suites.");
  assert.match(draft.body, /Original posting: https:\/\/jobs\.example\/1/u);
  assert.match(draft.body, /Ravi Kumar/u);
});

test("a second follow-up is visibly the second — and stays modest", () => {
  const draft = buildFollowupDraft({
    company: "Acme", role: "Data Analyst", appliedAt: "2026-08-01T00:00:00.000Z",
    followUpCount: 1, candidateName: "Ravi", bullets: ["Shipped the thing."], seed: 1,
  });
  assert.match(draft.subject, /following up again, briefly/u);
});

test("the cited bullet prefers a metric, deterministically", () => {
  const bullets = ["A plain sentence.", "Cut costs 30% with caching.", "Improved onboarding 18%.", "Another plain one."];
  assert.equal(pickCitedBullet(bullets, 0), "Cut costs 30% with caching.");
  assert.equal(pickCitedBullet(bullets, 1), "Improved onboarding 18%.");
  // Same input, same pick — drafts are stable, not random.
  assert.equal(pickCitedBullet(bullets, 0), pickCitedBullet(bullets, 0));
  // No bullets: the draft simply omits the highlight line.
  const none = buildFollowupDraft({ company: "Acme", role: "Data Analyst", appliedAt: "2026-08-01T00:00:00.000Z", followUpCount: 0, bullets: [] });
  assert.equal(none.citedBullet, null);
  assert.doesNotMatch(none.body, /second look/u);
});

test("selection and caps live in SQL; the route never sends mail", () => {
  const route = source("app/api/followups/route.ts");
  assert.match(route, /a\.updated_at < now\(\) - interval '\$\{FOLLOWUP_QUIET_DAYS\} days'/u);
  assert.match(route, /follow_up_count < \$\{FOLLOWUP_MAX_PER_APPLICATION\}/u);
  assert.match(route, /follow_up_at < now\(\) - interval '\$\{FOLLOWUP_MIN_SPACING_DAYS\} days'/u);
  // The POST re-checks the cap in the UPDATE itself — a stale client or a
  // double-submit cannot produce a third nudge.
  assert.match(route, /follow_up_count < \$\{FOLLOWUP_MAX_PER_APPLICATION\}\s*\n\s*returning id/u);
  assert.doesNotMatch(route, /sendMail|sendBulkMail|dispatch|smtp/iu);
  const lib = source("lib/followup.ts");
  assert.doesNotMatch(lib, /sendMail|fetch\(|nodemailer|smtp/iu);
  assert.match(source("db/migrations/063_application_follow_up_count.sql"), /follow_up_count int not null default 0/u);
  // The tracker panel is drafts-and-copy only — copy lives on the shared
  // GeneratedOutput surface now (its own copy button per draft).
  const panel = source("app/tracker/followups-panel.tsx");
  assert.match(panel, /GeneratedOutput/u);
  assert.match(panel, /markSent/u);
  assert.doesNotMatch(panel, /sendMail|smtp|mailto:/iu);
});
