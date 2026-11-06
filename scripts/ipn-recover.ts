// IPN recovery: prove a candidate NOWPAYMENTS_IPN_SECRET is the right one, and
// replay the callbacks a wrong one threw away.
//
//   npm run ipn:report                  what is stuck, and what is recoverable
//   npm run ipn:check                   does IPN_SECRET_CANDIDATE verify?
//   npm run ipn:replay -- --apply       re-deliver quarantined callbacks
//
// The point of `check`: the old way to test a secret was to make a real payment
// and see whether the callback returned 200 or 400. With one quarantined
// callback this becomes an offline HMAC comparison against a payload
// NOWPayments really signed -- instant, free, and it can be run before touching
// the VPS at all.
//
// The candidate secret comes from the environment, never from argv: argv is
// visible to every user on the box via `ps`. Nothing here prints it.
//
//   read -rsp 'candidate: ' IPN_SECRET_CANDIDATE && export IPN_SECRET_CANDIDATE
//
// `replay` re-POSTs each stored body with its original signature header to the
// live webhook, so the grant runs through the real route rather than a copy of
// it: same signature check, same invoice match, same `premium_granted_at is
// null` guard that makes a duplicate callback a no-op. There is deliberately no
// second implementation of the money path in this file.
import { createHmac, timingSafeEqual } from "node:crypto";
import { Client } from "pg";

const VERBS = ["report", "check", "replay"] as const;
type Verb = (typeof VERBS)[number];

// Nothing above main() may read argv or throw: the test imports this module to
// pin verifies() against lib/nowpay.ts, and an import must not need a database.
const apply = () => process.argv.includes("--apply");
const siteUrl = () => (process.env.SITE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/u, "");

// Mirrors lib/nowpay.ts verifyIpn: HMAC-SHA512 over the body with object keys
// sorted. Duplicated here on purpose -- this script must run standalone on the
// VPS against a DATABASE_URL, with no Next runtime and no app env loaded. The
// test pins the two implementations to the same answer.
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortKeys((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
  }
  return value;
}

export function signatureFor(body: string, secret: string): string | null {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return null; }
  return createHmac("sha512", secret).update(JSON.stringify(sortKeys(parsed))).digest("hex");
}

export function verifies(body: string, signature: string, secret: string): boolean {
  const expected = signatureFor(body, secret);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Quarantined = { id: string; order_id: string; signature: string; body: string; received_at: Date };

async function main(): Promise<void> {
  const verb = process.argv[2] as Verb | undefined;
  if (!verb || !VERBS.includes(verb)) {
    throw new Error(`usage: ipn-recover <${VERBS.join("|")}> [--apply]`);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    if (verb === "report") await report(db);
    if (verb === "check") await check(db);
    if (verb === "replay") await replay(db);
  } finally {
    await db.end();
  }
}

async function report(db: Client): Promise<void> {
  const stuck = await db.query<{ status: string; n: string; oldest: Date; total: string }>(
    `select status, count(*)::text as n, min(created_at) as oldest, sum(price_amount)::text as total
     from crypto_payments
     where premium_granted_at is null
     group by status
     order by count(*) desc`,
  );
  console.log("Payments with no premium granted, by gateway status:");
  if (!stuck.rows.length) console.log("  (none)");
  for (const row of stuck.rows) {
    console.log(`  ${row.status.padEnd(20)} ${row.n.padStart(4)}  $${row.total ?? "0"}  oldest ${row.oldest?.toISOString().slice(0, 10) ?? "-"}`);
  }

  const pending = await db.query<{ n: string; orders: string }>(
    `select count(*)::text as n, count(distinct order_id)::text as orders
     from ipn_quarantine`,
  );
  const { n, orders } = pending.rows[0] ?? { n: "0", orders: "0" };
  console.log(`\nQuarantined callbacks awaiting replay: ${n} across ${orders} orders.`);
  if (n === "0") {
    console.log("  Nothing to replay. Callbacks are only captured from the deploy that");
    console.log("  added migration 053 onward -- anything dropped before that is gone and");
    console.log("  has to be reconciled by hand from the NOWPayments dashboard.");
  }

  // Paid-but-ungranted is the population that owes someone something, whether
  // or not a callback survived. This is the reconciliation worklist.
  const owed = await db.query<{ order_id: string; user_id_text: string; email: string | null; price_amount: string; status: string; created_at: Date }>(
    `select c.order_id, c.user_id_text, u.email, c.price_amount::text, c.status, c.created_at
     from crypto_payments c
     left join users u on u.id::text = c.user_id_text
     where c.premium_granted_at is null and c.status <> 'expired'
     order by c.created_at`,
  );
  console.log(`\nReconciliation worklist (${owed.rows.length} orders, oldest first):`);
  for (const row of owed.rows) {
    console.log(`  ${row.created_at.toISOString().slice(0, 10)}  ${row.order_id}  ${(row.email ?? row.user_id_text).padEnd(32)} $${row.price_amount}  ${row.status}`);
  }
}

async function check(db: Client): Promise<void> {
  const candidate = process.env.IPN_SECRET_CANDIDATE;
  if (!candidate) throw new Error("IPN_SECRET_CANDIDATE is required (export it, do not pass it on argv)");

  const rows = (await db.query<Quarantined>(
    "select id::text, order_id, signature, body, received_at from ipn_quarantine order by received_at desc limit 50",
  )).rows;
  if (!rows.length) {
    console.log("No quarantined callbacks to test against.");
    console.log("A secret cannot be proven right without one payload NOWPayments actually signed.");
    process.exitCode = 1;
    return;
  }

  const matched = rows.filter((row) => verifies(row.body, row.signature, candidate));
  console.log(`Tested ${rows.length} quarantined callbacks: ${matched.length} verify with this candidate.`);
  if (matched.length === rows.length) {
    console.log("VERDICT: this is the live secret. Install it and run `replay -- --apply`.");
    return;
  }
  if (matched.length === 0) {
    console.log("VERDICT: wrong secret. Regenerating deactivates the previous value, so only");
    console.log("the newest one from the NOWPayments dashboard can verify.");
    process.exitCode = 1;
    return;
  }
  // Partial: real, and the tell that a rotation happened mid-window.
  const newest = matched[0]?.received_at?.toISOString() ?? "?";
  console.log(`VERDICT: verifies some but not all -- the secret was rotated. Newest match ${newest}.`);
  console.log("Callbacks older than that rotation can never be replayed; reconcile them by hand.");
}

async function replay(db: Client): Promise<void> {
  const rows = (await db.query<Quarantined>(
    "select id::text, order_id, signature, body, received_at from ipn_quarantine order by received_at",
  )).rows;
  console.log(`${rows.length} quarantined callbacks pending.`);
  if (!apply()) {
    for (const row of rows) console.log(`  would replay ${row.order_id} (received ${row.received_at.toISOString()})`);
    console.log("\nDry run. Re-run with --apply to deliver these.");
    return;
  }

  let granted = 0;
  let refused = 0;
  for (const row of rows) {
    let note: string;
    try {
      const res = await fetch(`${siteUrl()}/api/pay/crypto/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-nowpayments-sig": row.signature },
        body: row.body,
        signal: AbortSignal.timeout(30_000),
      });
      note = `http ${res.status}`;
      if (res.ok) granted += 1; else refused += 1;
    } catch (error) {
      note = error instanceof Error ? error.message.slice(0, 120) : "unknown_error";
      refused += 1;
    }
    console.log(`  ${row.order_id}: ${note}`);
    // Only a delivered callback is retired. A refused one stays pending so a
    // later, correct secret can still recover it.
    if (note === "http 200") {
      await db.query("delete from ipn_quarantine where id=$1::bigint", [row.id]);
    } else {
      await db.query("update ipn_quarantine set replay_note=$2 where id=$1::bigint", [row.id, note]);
    }
  }
  console.log(`\nDelivered ${granted}, still refused ${refused}.`);
  if (refused) console.log("Refused means the signature still does not verify: the secret on this box is not the one that signed them.");
}

// Guarded so the test can import verifies()/signatureFor() without a database.
if (process.argv[1]?.includes("ipn-recover")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "ipn_recovery_failed");
    process.exitCode = 1;
  });
}
