import nodemailer from "nodemailer";
import { connection } from "./queue";
import { env } from "./env";
import { logMail, type Mail, type MailStatus } from "./email";

// ── Bulk mail pool ──
// Transactional mail (verification, receipts) keeps the Cloudflare transport
// and its own 200/day budget in lib/email.ts. Bulk streams — job alerts now,
// daily matches next — send through a pool of numbered SMTP accounts
// (BREVO and friends), each with its own daily budget, so the pool's total
// capacity is accounts × BULK_DAILY_LIMIT (3 × 300 = 900/day for the owner's
// three Brevo free accounts).
//
// Redis is still ONE connection and that is deliberate: it only stores the
// per-account daily counters (mail:bulk:{n}:{utc-day}) and the queue. The
// 200/day ceiling lives on the Cloudflare account, not in Redis — which is
// exactly why multiple Redis accounts could never have raised it.

export type BulkAccount = {
  index: number;
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

export function bulkDailyLimit(source: NodeJS.ProcessEnv = process.env): number {
  return Math.max(1, Number(source.BULK_DAILY_LIMIT ?? "300"));
}

// Numbered accounts, BULK_SMTP_1_* .. BULK_SMTP_10_*. An account exists when
// both host and FROM are set; a half-configured account is skipped so a typo
// can never half-wire the pool. There is deliberately NO fallback to the
// shared SMTP_* vars: production carries SMTP_HOST for the legacy local
// relay, and a fallback would silently flip alerts onto it the moment this
// module ships. The pool is active only when a numbered account exists.
export function parseBulkAccounts(source: NodeJS.ProcessEnv = process.env): BulkAccount[] {
  const accounts: BulkAccount[] = [];
  for (let i = 1; i <= 10; i++) {
    const host = (source[`BULK_SMTP_${i}_HOST`] ?? "").trim();
    const from = (source[`BULK_SMTP_${i}_FROM`] ?? "").trim();
    if (!host || !from) continue;
    accounts.push({
      index: i,
      host,
      from,
      port: Number(source[`BULK_SMTP_${i}_PORT`] ?? "587"),
      secure: (source[`BULK_SMTP_${i}_SECURE`] ?? "false").toLowerCase() === "true",
      user: (source[`BULK_SMTP_${i}_USER`] ?? "").trim() || undefined,
      pass: source[`BULK_SMTP_${i}_PASS`],
    });
  }
  return accounts;
}

let memoized: BulkAccount[] | null = null;
export function bulkAccounts(): BulkAccount[] {
  if (!memoized) memoized = parseBulkAccounts();
  return memoized;
}

export function bulkConfigured(): boolean {
  return bulkAccounts().length > 0;
}

export function bulkCapacity(): number {
  return bulkAccounts().length * bulkDailyLimit();
}

export function bulkKey(index: number, today: string): string {
  return `mail:bulk:${index}:${today}`;
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// Read-only usage check for rotation ordering. Never INCRs: checking every
// account on every send must not burn budget on accounts we are about to skip.
export async function bulkUsedToday(account: BulkAccount): Promise<number> {
  try {
    const used = await connection.get(bulkKey(account.index, utcToday()));
    return Number(used || 0);
  } catch {
    // Redis unavailable: treat the account as full. Uncounted bulk sending is
    // the exact failure the budgets exist to prevent — bulk mail can wait.
    return Number.MAX_SAFE_INTEGER;
  }
}

// Least-used first, ties broken by account index for determinism. Exported
// for tests; exhausted accounts are filtered by the caller.
export function pickBulkAccounts(accounts: BulkAccount[], usedByIndex: Map<number, number>): BulkAccount[] {
  return [...accounts]
    .filter((a) => (usedByIndex.get(a.index) ?? 0) < bulkDailyLimit())
    .sort((a, b) => (usedByIndex.get(a.index) ?? 0) - (usedByIndex.get(b.index) ?? 0) || a.index - b.index);
}

// Atomically claims one slot; returns false when the account turned out to be
// over budget (concurrent senders can overshoot the read-then-claim window).
async function claimBulkSlot(account: BulkAccount): Promise<boolean> {
  const key = bulkKey(account.index, utcToday());
  try {
    const n = await connection.incr(key);
    if (n === 1) {
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 5, 0);
      const ttlSec = Math.max(60, Math.ceil((tomorrow.getTime() - Date.now()) / 1000));
      await connection.expire(key, ttlSec);
    }
    return n <= bulkDailyLimit();
  } catch {
    return false;
  }
}

function transporterFor(account: BulkAccount) {
  return nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.secure,
    ignoreTLS: !account.secure && account.port === 25,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: account.user || account.pass ? { user: account.user, pass: account.pass } : undefined,
  });
}

export class BulkBudgetExhaustedError extends Error {
  constructor() {
    super("Bulk daily limit reached on every account");
    this.name = "BulkBudgetExhaustedError";
  }
}

export async function sendBulkMail(mail: Mail): Promise<MailStatus> {
  const accounts = bulkAccounts();
  if (!accounts.length) throw new Error("Bulk mail transport is not configured");

  if (env.localDevMode) {
    console.log("[bulk-mail:dev]", JSON.stringify({ type: mail.type ?? "bulk", subject: mail.subject }));
    return "queued";
  }

  const usedByIndex = new Map<number, number>();
  for (const account of accounts) usedByIndex.set(account.index, await bulkUsedToday(account));

  for (const account of pickBulkAccounts(accounts, usedByIndex)) {
    if (!(await claimBulkSlot(account))) continue;
    try {
      const result = await transporterFor(account).sendMail({
        from: account.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        replyTo: mail.replyTo,
        // List-Unsubscribe and friends ride here; nodemailer emits them as
        // top-level SMTP headers.
        headers: mail.headers,
      });
      if (result.rejected?.includes(mail.to)) throw new Error("SMTP rejected the recipient");
      // Accepted by the relay is not proof of inbox delivery — same honesty
      // rule as the transactional SMTP path: the log records "queued".
      await logMail(mail, "queued", undefined, `bulk:${account.index}`);
      return "queued";
    } catch (error) {
      // This account's provider failed (throttle, auth, rejection): log it and
      // let the next account take the mail. The claimed slot is consumed —
      // failed attempts count against the account like successful ones.
      await logMail(mail, "failed", error, `bulk:${account.index}`);
    }
  }

  throw new BulkBudgetExhaustedError();
}
