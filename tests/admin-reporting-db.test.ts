import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const databaseUrl = process.env.ROLESHARP_TEST_DATABASE_URL;

test("admin Razorpay summaries convert paise once and keep currencies separate", { skip: !databaseUrl }, async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(databaseUrl!).hostname));
  const source = readFileSync(new URL("../app/api/admin/stats/route.ts", import.meta.url), "utf8");
  const sql = source.match(/`(select currency,[\s\S]+?from razorpay_payments group by currency order by currency)`/)?.[1];
  assert.ok(sql, "Execute the actual summary query");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(`create temp table razorpay_payments (
      amount_paise bigint,currency char(3),status text,created_at timestamptz
    ) on commit drop;
    insert into razorpay_payments values
      (99900,'INR','paid',now()), (649900,'INR','paid',now()-interval '60 days'),
      (99900,'INR','failed',now()), (99900,'INR','refunded',now()),
      (99900,'INR','created',now()), (1200,'USD','paid',now());`);
    const rows = (await client.query(sql)).rows;
    assert.deepEqual(rows.map((row) => ({ ...row, revenue: Number(row.revenue), revenue_30: Number(row.revenue_30) })), [
      { currency: "INR", paid: 2, failed: 2, revenue: 7498, revenue_30: 999 },
      { currency: "USD", paid: 1, failed: 0, revenue: 12, revenue_30: 12 },
    ]);
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
