import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { buildInvoice, invoiceEligible, invoiceFileName, type PaymentRecord } from "@/lib/invoice";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
type Params = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  // Rendering a PDF is the expensive part of this route, so bound it per user.
  const limited = await rateLimit(req, "invoice-download", 20);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }
  const { orderId } = await params;

  // The owner is in the WHERE, not checked after the fetch: another user's
  // order id must not be able to select a row at all.
  const rows = await q<PaymentRecord & { email: string | null }>(
    `select p.order_id, p.plan, p.status, p.price_amount, p.pay_currency, p.days,
            p.created_at, p.premium_granted_at, p.provider_invoice_id, p.provider, u.email
     from (
       select order_id, user_id_text, plan, status, price_amount::text as price_amount, pay_currency, days,
              created_at, premium_granted_at, provider_invoice_id, 'crypto'::text as provider
       from crypto_payments
       union all
       select razorpay_order_id as order_id, user_id_text, plan, status, (amount_paise / 100.0)::text as price_amount,
              currency as pay_currency, days, created_at, premium_granted_at, razorpay_payment_id as provider_invoice_id,
              'razorpay'::text as provider
       from razorpay_payments
     ) p
     join users u on u.id::text = p.user_id_text
     where p.order_id = $1 and p.user_id_text = $2
     limit 1`,
    [orderId, user.id],
  );
  const payment = rows[0];
  if (!payment) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!invoiceEligible(payment.status)) {
    // An unpaid order has no invoice. Saying so beats a 404 the user reads as
    // "my payment vanished".
    return NextResponse.json({ error: "not_paid", status: payment.status }, { status: 409 });
  }

  const invoice = buildInvoice(payment, payment.email ?? user.email);
  const pdf = await renderInvoicePdf(invoice);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceFileName(invoice)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
