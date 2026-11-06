import { createHmac, timingSafeEqual } from "crypto";

// NOWPayments integration. Hosted invoice (user picks any supported coin),
// IPN webhook confirms payment. DEV mode (no API key) lets the flow work
// end-to-end for testing — unlocks on a simulated confirm.
export const now = {
  apiKey: process.env.NOWPAYMENTS_API_KEY ?? "",
  ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET ?? "",
  currency: "usd",
  get live() {
    return !!this.apiKey;
  },
  get dev() {
    return !this.live && process.env.NODE_ENV !== "production" && process.env.NOWPAYMENTS_DEV_MODE === "true";
  },
};

const API = "https://api.nowpayments.io/v1";

// Create a hosted invoice for a given price (cents). Returns checkout URL.
export async function createInvoice(orderId: string, siteUrl: string, cents: number, desc: string) {
  if (!now.live) {
    if (now.dev) return { invoiceUrl: `${siteUrl}/build?dev_crypto=${orderId}`, id: `dev_${orderId}`, live: false };
    throw new Error("NOWPayments is not configured");
  }
  const res = await fetch(`${API}/invoice`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json", "x-api-key": now.apiKey },
    body: JSON.stringify({
      price_amount: cents / 100,
      price_currency: now.currency,
      order_id: orderId,
      order_description: desc,
      ipn_callback_url: `${siteUrl}/api/pay/crypto/webhook`,
      success_url: `${siteUrl}/build?paid=1`,
      cancel_url: `${siteUrl}/build?cancelled=1`,
    }),
  });
  if (!res.ok) throw new Error(`nowpayments invoice ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return { invoiceUrl: j.invoice_url as string, id: String(j.id), live: true };
}

// IPN signature = HMAC-SHA512 of the JSON body with keys sorted, using IPN secret.
export function verifyIpn(rawBody: string, signature: string): boolean {
  if (!now.live) return now.dev;
  if (!now.ipnSecret || !signature) return false;
  let parsed: any;
  try { parsed = JSON.parse(rawBody); } catch { return false; }
  const sorted = sortKeys(parsed);
  const expected = createHmac("sha512", now.ipnSecret).update(JSON.stringify(sorted)).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sortKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === "object") {
    return Object.keys(obj).sort().reduce((acc: any, k) => { acc[k] = sortKeys(obj[k]); return acc; }, {});
  }
  return obj;
}

// Statuses that mean "paid enough to grant access".
export function isPaid(status: string) {
  return status === "finished" || status === "confirmed";
}

export function paymentMatchesInvoice(
  body: Record<string, unknown>,
  expected: { orderId: string; priceAmount: number; priceCurrency: string },
): boolean {
  if (String(body.order_id ?? "") !== expected.orderId) return false;
  if (!isPaid(String(body.payment_status ?? ""))) return false;
  if (String(body.price_currency ?? "").toLowerCase() !== expected.priceCurrency.toLowerCase()) return false;
  const received = Number(body.price_amount);
  if (!Number.isFinite(received) || received <= 0) return false;
  // Currency prices are stored to cents. A tiny tolerance avoids binary float
  // noise while rejecting cheaper, reused, or otherwise mismatched invoices.
  return Math.abs(received - expected.priceAmount) < 0.005;
}
