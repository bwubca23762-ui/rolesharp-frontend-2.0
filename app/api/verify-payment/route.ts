import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { fetchRazorpayPayment, razorpayConfigured, verifyRazorpayPaymentSignature } from "@/lib/razorpay";
import { fulfillRazorpayPayment } from "@/lib/razorpay-fulfillment";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "verify-razorpay-payment", 10);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  if (!razorpayConfigured()) return NextResponse.json({ error: "payment_not_configured" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const orderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string" || !orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "missing_payment_fields" }, { status: 400 });
  }
  if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: "signature_mismatch" }, { status: 400 });
  }

  const payment = await fetchRazorpayPayment(paymentId).catch(() => null);
  if (!payment) return NextResponse.json({ error: "provider_unavailable" }, { status: 503 });
  if (payment.id !== paymentId || payment.order_id !== orderId) {
    return NextResponse.json({ error: "payment_conflict" }, { status: 409 });
  }
  if (payment.status === "authorized") {
    return NextResponse.json({ pending: true }, { status: 202 });
  }

  const result = await fulfillRazorpayPayment(payment, user.id);
  if (result.error) return NextResponse.json(result, { status: result.error === "order_not_found" ? 404 : 409 });
  return NextResponse.json(result);
}
