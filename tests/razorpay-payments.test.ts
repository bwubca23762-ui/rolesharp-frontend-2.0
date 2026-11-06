import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { loadEnvironment } from "../lib/env";
import { newRazorpayReceipt, verifyRazorpayPaymentSignature } from "../lib/razorpay";
import nextConfig from "../next.config";

test("billing permits bank popups and Razorpay form posts without relaxing other pages", async () => {
  const rules = await nextConfig.headers!();
  const billing = rules.find((rule) => rule.source === "/settings")!;
  assert.equal(billing.headers.find((h) => h.key === "Cross-Origin-Opener-Policy")?.value, "same-origin-allow-popups");
  assert.match(billing.headers.find((h) => h.key === "Content-Security-Policy")!.value, /form-action 'self' https:\/\/api\.razorpay\.com(?:;|$)/);
  const global = rules.find((rule) => rule.source === "/((?!embed).*)")!;
  assert.equal(global.headers.find((h) => h.key === "Cross-Origin-Opener-Policy")?.value, "same-origin");
  assert.match(global.headers.find((h) => h.key === "Content-Security-Policy")!.value, /form-action 'self';/);
});

test("Razorpay payment signatures use the order_id|payment_id payload", () => {
  const orderId = "order_test_123";
  const paymentId = "pay_test_456";
  const secret = "test_secret";
  const signature = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret), true);
  assert.equal(verifyRazorpayPaymentSignature(orderId, "pay_other", signature, secret), false);
  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, "0".repeat(64), secret), false);
});

test("Razorpay amounts are explicit, in paise, and enforce the provider minimum", () => {
  const configured = loadEnvironment({
    NODE_ENV: "test",
    DISABLE_DB: "true",
    RAZORPAY_KEY_ID: "rzp_test_example",
    RAZORPAY_KEY_SECRET: "secret",
    RAZORPAY_MONTHLY_AMOUNT_PAISE: "9900",
    RAZORPAY_YEARLY_AMOUNT_PAISE: "69900",
  });
  assert.equal(configured.razorpayCurrency, "INR");
  assert.equal(configured.razorpayMonthlyAmountPaise, 9900);
  assert.equal(configured.razorpayYearlyAmountPaise, 69900);
  assert.throws(() => loadEnvironment({
    NODE_ENV: "test",
    DISABLE_DB: "true",
    RAZORPAY_MONTHLY_AMOUNT_PAISE: "99",
  }), /RAZORPAY_MONTHLY_AMOUNT_PAISE/);
});

test("Razorpay receipts are opaque and remain inside the 40-character provider limit", () => {
  const receipt = newRazorpayReceipt();
  assert.match(receipt, /^rs_[a-f0-9]{32}$/u);
  assert.ok(receipt.length <= 40);
});
