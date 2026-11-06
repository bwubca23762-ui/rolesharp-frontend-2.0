import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { parseBulkAccounts, pickBulkAccounts, bulkDailyLimit, bulkKey, type BulkAccount } from "../lib/bulk-mail";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// The bulk pool is the delivery path for job alerts (and, next, daily
// matches). Its whole point is that the per-account daily budgets are
// honest — one account per 300/day, least-used rotation, exhausted accounts
// skipped — so these tests pin the pure contracts the rotation depends on.

function account(index: number): BulkAccount {
  return { index, host: `smtp${index}.example`, port: 587, secure: false, from: `bulk${index}@rolesharp.test` };
}

const threeEnv = {
  BULK_SMTP_1_HOST: "smtp-relay.brevo.com",
  BULK_SMTP_1_FROM: "alerts@rolesharp.com",
  BULK_SMTP_1_USER: "key-one",
  BULK_SMTP_1_PASS: "secret-one",
  BULK_SMTP_2_HOST: "smtp-relay.brevo.com",
  BULK_SMTP_2_FROM: "matches@rolesharp.com",
  BULK_SMTP_2_USER: "key-two",
  BULK_SMTP_2_PASS: "secret-two",
  BULK_SMTP_3_HOST: "smtp-relay.brevo.com",
  BULK_SMTP_3_FROM: "no-reply@rolesharp.com",
  BULK_SMTP_3_USER: "key-three",
  BULK_SMTP_3_PASS: "secret-three",
  BULK_DAILY_LIMIT: "300",
} as unknown as NodeJS.ProcessEnv;

test("parseBulkAccounts reads the numbered accounts and skips half-configured ones", () => {
  const accounts = parseBulkAccounts(threeEnv);
  assert.equal(accounts.length, 3);
  assert.deepEqual(accounts.map((a) => a.index), [1, 2, 3]);
  assert.equal(accounts[0].host, "smtp-relay.brevo.com");
  assert.equal(accounts[0].from, "alerts@rolesharp.com");
  assert.equal(accounts[0].user, "key-one");
  assert.equal(accounts[0].port, 587);
  assert.equal(accounts[0].secure, false);

  // A typo in one account (missing FROM) must not half-wire the pool.
  const broken = parseBulkAccounts({
    BULK_SMTP_1_HOST: "smtp.example",
    BULK_SMTP_2_HOST: "smtp.example",
    BULK_SMTP_2_FROM: "ok@rolesharp.com",
  } as unknown as NodeJS.ProcessEnv);
  assert.deepEqual(broken.map((a) => a.index), [2]);

  // No numbered accounts means NO pool — even when the legacy SMTP_* relay is
  // configured. Otherwise deploying the module would silently flip alerts
  // onto that relay on day one.
  const none = parseBulkAccounts({
    SMTP_HOST: "smtp.example",
    SMTP_FROM: "no-reply@rolesharp.com",
  } as unknown as NodeJS.ProcessEnv);
  assert.deepEqual(none, []);
});

test("pickBulkAccounts rotates least-used first and skips exhausted accounts", () => {
  const accounts = [account(1), account(2), account(3)];
  const limit = bulkDailyLimit(threeEnv);
  assert.equal(limit, 300);

  // Fresh pool: deterministic index order.
  const fresh = pickBulkAccounts(accounts, new Map());
  assert.deepEqual(fresh.map((a) => a.index), [1, 2, 3]);

  // Least-used first: account 2 has the most headroom.
  const rotated = pickBulkAccounts(accounts, new Map([
    [1, 120], [2, 20], [3, 90],
  ]));
  assert.deepEqual(rotated.map((a) => a.index), [2, 3, 1]);

  // An account at (or over) its budget is dropped entirely, never scheduled.
  const full = pickBulkAccounts(accounts, new Map([
    [1, limit], [2, limit + 5], [3, 10],
  ]));
  assert.deepEqual(full.map((a) => a.index), [3]);

  // Ties break by index so two empty pools behave identically on every worker.
  const tied = pickBulkAccounts(accounts, new Map([[1, 50], [2, 50], [3, 50]]));
  assert.deepEqual(tied.map((a) => a.index), [1, 2, 3]);
});

test("budget keys are per-account and per-UTC-day", () => {
  assert.equal(bulkKey(2, "2026-08-29"), "mail:bulk:2:2026-08-29");
});

test("alert capacity follows the pool, not the transactional budget", () => {
  // Source pins: the sub-cap must derive from the pool when one exists and
  // keep the legacy 75% transactional fallback when it does not.
  const alerts = source("lib/job-alerts.ts");
  assert.match(alerts, /bulkConfigured\(\) \? bulkCapacity\(\) : Math\.floor\(Number\(process\.env\.EMAIL_DAILY_LIMIT \?\? "200"\) \* 0\.75\)/);
  assert.match(alerts, /sendBulkMail\(/);
  assert.match(alerts, /BulkBudgetExhaustedError/);
  // The batch must be able to drain 900/day across the 30-min ticks.
  assert.match(alerts, /limit 100/);

  // The bulk module must never touch the Cloudflare transport or the
  // transactional counter — two streams, two budgets, one Redis.
  const bulk = source("lib/bulk-mail.ts");
  assert.doesNotMatch(bulk, /cloudflare|EMAIL_DAILY_LIMIT/);
  assert.match(bulk, /mail:bulk:\$\{index\}/);
  assert.match(bulk, /replyTo: mail\.replyTo/);
});
