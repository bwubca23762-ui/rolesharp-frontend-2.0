import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { RazorpayPayment, verifyRazorpayHmac } from "@/lib/razorpay";
import { fulfillRazorpayPayment } from "@/lib/razorpay-fulfillment";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!env.razorpayWebhookSecret) return NextResponse.json({ error: "webhook_unavailable" }, { status: 503 });
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const raw = Buffer.from(await req.arrayBuffer());
  if (!verifyRazorpayHmac(raw, signature, env.razorpayWebhookSecret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }
  if (event?.event !== "payment.captured") return NextResponse.json({ ok: true, ignored: true });

  const payment = RazorpayPayment.safeParse(event.payload?.payment?.entity);
  if (!payment.success) return NextResponse.json({ error: "invalid_payment" }, { status: 400 });
  const result = await fulfillRazorpayPayment(payment.data);
  if (result.error === "order_not_found") return NextResponse.json({ ok: true, ignored: true });
  if (result.error) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}
