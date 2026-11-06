import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { getPlan } from "./entitlements";
import { env } from "./env";

export type RazorpayPlanId = "monthly" | "yearly";

export type RazorpayPlan = {
  id: RazorpayPlanId;
  label: string;
  days: number;
  amount: number;
  currency: string;
};

export function getRazorpayPlan(value: unknown): RazorpayPlan | null {
  if (value !== "monthly" && value !== "yearly") return null;
  const amount = value === "monthly"
    ? env.razorpayMonthlyAmountPaise
    : env.razorpayYearlyAmountPaise;
  if (!amount) return null;
  const plan = getPlan(value);
  return { id: value, label: plan.label, days: plan.days, amount, currency: env.razorpayCurrency };
}

export function razorpayConfigured() {
  return Boolean(
    env.razorpayKeyId
      && env.razorpayKeySecret
      && env.razorpayMonthlyAmountPaise
      && env.razorpayYearlyAmountPaise,
  );
}

export function createRazorpayClient() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) return null;
  return new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
}

// Razorpay verifies the order/payment pair with this exact HMAC. Keeping it
// here makes the route small and permits a deterministic test without calling
// a payment provider.
export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret = env.razorpayKeySecret,
) {
  return Boolean(orderId && paymentId) && verifyRazorpayHmac(`${orderId}|${paymentId}`, signature, secret);
}

export function verifyRazorpayHmac(payload: string | Buffer, signature: string, secret: string) {
  if (!secret || !/^[a-f0-9]{64}$/iu.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}

export const RazorpayPayment = z.object({
  id: z.string().regex(/^pay_[a-zA-Z0-9]+$/u),
  order_id: z.string().regex(/^order_[a-zA-Z0-9]+$/u),
  amount: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/u),
  status: z.string(),
  amount_refunded: z.number().int().nonnegative(),
});

export async function fetchRazorpayPayment(paymentId: string) {
  const auth = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Razorpay payment lookup returned HTTP ${response.status}`);
  return RazorpayPayment.parse(await response.json());
}

// Receipts are provider-visible but must not expose a user ID or email. The
// compact UUID format stays below Razorpay's 40-character receipt limit.
export function newRazorpayReceipt() {
  return `rs_${randomUUID().replaceAll("-", "")}`;
}
