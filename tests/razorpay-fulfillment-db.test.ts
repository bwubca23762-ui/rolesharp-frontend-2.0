import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.ROLESHARP_TEST_DATABASE_URL;

test("a captured Razorpay payment grants the matching order exactly once", { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.includes("_qa_"));
  Object.assign(process.env, {
    DATABASE_URL: databaseUrl,
    DISABLE_DB: "false",
    LOCAL_DEV_MODE: "true",
    SMTP_FROM: "",
    REDIS_URL: "redis://127.0.0.1:1",
    RAZORPAY_WEBHOOK_SECRET: "qa-webhook-secret",
  });

  const { POST } = await import("../app/api/pay/razorpay/webhook/route");
  const { fulfillRazorpayPayment } = await import("../lib/razorpay-fulfillment");
  const client = new Client({ connectionString: databaseUrl });
  const id = randomUUID();
  const suffix = id.replaceAll("-", "");
  const payment = { id: `pay_${suffix}`, order_id: `order_${suffix}`, amount: 99900, currency: "INR", status: "captured", amount_refunded: 0 };
  const event = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: payment } } });
  const signature = createHmac("sha256", "qa-webhook-secret").update(event).digest("hex");
  const request = (body: string, signed: string) => new Request("http://localhost/api/pay/razorpay/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": signed },
    body,
  });

  await client.connect();
  try {
    await client.query(
      "insert into users (id,email,password_hash,premium_until) values ($1,$2,'x',now()+interval '5 days')",
      [id, `razorpay-${suffix}@example.test`],
    );
    await client.query(
      `insert into razorpay_payments (razorpay_order_id,receipt,user_id_text,plan,days,amount_paise,currency)
       values ($1,$2,$3,'monthly',30,99900,'INR')`,
      [payment.order_id, suffix, id],
    );
    const readOrder = () => client.query(
      `select r.status,r.razorpay_payment_id,u.premium_until
       from razorpay_payments r join users u on u.id::text=r.user_id_text where r.razorpay_order_id=$1`,
      [payment.order_id],
    ).then(({ rows }) => rows[0]);
    const before = await readOrder();
    assert.equal((await POST(request(event + " ", signature))).status, 401);
    assert.equal((await fulfillRazorpayPayment({ ...payment, status: "authorized" }, id)).error, "payment_not_captured");
    assert.equal((await fulfillRazorpayPayment({ ...payment, amount: 100 }, id)).error, "payment_amount_mismatch");
    assert.equal((await fulfillRazorpayPayment({ ...payment, currency: "USD" }, id)).error, "payment_amount_mismatch");
    assert.equal((await fulfillRazorpayPayment(payment, randomUUID())).error, "order_not_found");
    assert.deepEqual(await readOrder(), before);

    const [webhook, callback] = await Promise.all([
      POST(request(event, signature)).then(async (response) => {
        assert.equal(response.status, 200);
        return response.json();
      }),
      fulfillRazorpayPayment(payment, id),
    ]);
    assert.deepEqual([webhook.idempotent, callback.idempotent].sort(), [false, true]);
    const after = await readOrder();
    assert.equal(after.status, "paid");
    assert.equal(after.razorpay_payment_id, payment.id);
    assert.equal(after.premium_until - before.premium_until, 30 * 86400 * 1000);
    assert.equal((await fulfillRazorpayPayment({ ...payment, id: "pay_other" }, id)).error, "payment_conflict");
    assert.deepEqual(await readOrder(), after);
  } finally {
    await client.query("delete from razorpay_payments where razorpay_order_id=$1", [payment.order_id]);
    await client.query("delete from users where id=$1", [id]);
    await client.end();
  }
});
