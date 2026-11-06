import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { buildAlertEmailHtml, buildAlertText, type AlertJob } from "../lib/job-alerts";
import { env } from "../lib/env";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// Job alerts are the first consumer of the bulk mail pool, and their match
// query is the only search surface that historically bypassed the escaped
// ILIKE idiom — twice: bare un-wildcarded words could only match titles
// exactly equal to the keyword, and the placeholder numbering pointed past
// the word params entirely, so every bind failed and no alert ever sent.
// These pins keep the matcher on the shared idiom and the email handoff on
// the builder's actual contract (a job UUID via ?jobId=, not an apply URL).

const jobs: AlertJob[] = [{
  id: "11111111-2222-3333-4444-555555555555",
  title: "Senior React Developer",
  company: "Acme & Co <Berlin>",
  location: "Berlin",
  salary_min: 50000,
  salary_max: 70000,
  salary_currency: "EUR",
  is_remote: true,
  apply_url: "https://jobs.example/apply/1?a=b&c=d",
  date_posted: "2026-09-01",
}];

test("alert matching uses the shared escaped-ILIKE idiom with sound placeholder numbering", () => {
  const alerts = source("lib/job-alerts.ts");
  // Wildcards around the word come from the shared escaper — never bare words.
  assert.match(alerts, /containsLikePattern/);
  // Placeholders must be numbered off the values array as it is built, not a
  // fixed offset over [country, ...words, limit] (the off-by-one that failed
  // every bind).
  assert.match(alerts, /values\.push\(containsLikePattern\(word\)\)/);
  assert.match(alerts, /title ilike \$\$\{values\.length\}/);
  assert.doesNotMatch(alerts, /i \+ 4/);
});

test("the matcher selects jobs.id and the email hands off to the builder with it", () => {
  const alerts = source("lib/job-alerts.ts");
  assert.match(alerts, /select id, title, company/);
  // The builder resolves ?jobId= only as a 36-char UUID via /api/jobs/[id] —
  // an apply_url never satisfies that, so the CTA must carry the job's id,
  // on the configured site URL, in the same query form the builder itself
  // uses for its login-return link.
  assert.match(alerts, /\$\{env\.siteUrl\}\/build\?jobId=\$\{encodeURIComponent\(j\.id\)\}/);
  assert.doesNotMatch(alerts, /jobId=\$\{escapeHtml\(j\.apply_url\)\}/);
  assert.doesNotMatch(alerts, /rolesharp\.com\/build/);
});

test("alert email renders escaped job rows, the builder handoff, and the pause link", () => {
  const html = buildAlertEmailHtml(
    "react",
    "Germany",
    jobs,
    "https://rolesharp.test/api/job-alerts/unsubscribe?token=tok",
  );
  // Builder handoff: query-form ?jobId= with the job's UUID. The host is
  // whatever env.siteUrl is in the running environment (asserted against it
  // directly so the pin holds in CI, where SITE_URL is rolesharp.com).
  assert.ok(html.includes(`href="${env.siteUrl}/build?jobId=11111111-2222-3333-4444-555555555555"`),
    `CTA must be ${env.siteUrl}/build?jobId=<id>`);
  // Apply link and company text are escaped — & in the URL must not survive raw.
  assert.match(html, /href="https:\/\/jobs\.example\/apply\/1\?a=b&amp;c=d"/);
  assert.match(html, /Acme &amp; Co &lt;Berlin&gt;/);
  assert.match(html, /Pause or unsubscribe/);

  const text = buildAlertText("react", "Germany", jobs, "https://rolesharp.test/unsub");
  assert.match(text, /Senior React Developer at Acme & Co <Berlin>/);
  assert.match(text, /https:\/\/jobs\.example\/apply\/1\?a=b&c=d/);
  assert.match(text, /Pause: https:\/\/rolesharp\.test\/unsub/);
});

test("stored keywords cannot carry newlines into the subject header", () => {
  // The keyword flows into the email subject; create/update collapse all
  // whitespace runs so internal CR/LF can never reach the header.
  const alerts = source("lib/job-alerts.ts");
  const sanitizers = alerts.match(/replace\(/g) ?? [];
  assert.ok(sanitizers.length >= 2, "createAlert and updateAlert must both collapse whitespace");
  assert.match(alerts, /trim\(\)\.replace\(\/\\s\+\/g, " "\)\.slice\(0, 60\)/);
});
