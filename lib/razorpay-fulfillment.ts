import type { z } from "zod";
import { withTransaction } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { buildInvoice, type PaymentRecord } from "@/lib/invoice";
import { invoiceEmailHtml, invoiceEmailSubject, invoiceEmailText } from "@/lib/invoice-email";
import type { RazorpayPayment } from "@/lib/razorpay";

type Order = {
  razorpay_payment_id: string | null;
  user_id_text: string;
  status: string;
  plan: string;
  days: number;
  amount_paise: string | number;
  currency: string;
  created_at: string | Date;
};

// Call only with a payment fetched from Razorpay or a signature-verified event.
export async function fulfillRazorpayPayment(payment: z.infer<typeof RazorpayPayment>, userId?: string) {
  if (payment.status !== "captured" || payment.amount_refunded !== 0) {
    return { error: "payment_not_captured" as const };
  }

  const result = await withTransaction(async (query) => {
    const [order] = await query<Order>(
      `select razorpay_payment_id, user_id_text, status, plan, days, amount_paise, currency, created_at
       from razorpay_payments where razorpay_order_id=$1 for update`,
      [payment.order_id],
    );
    if (!order || (userId && order.user_id_text !== userId)) return { error: "order_not_found" as const };
    if (Number(order.amount_paise) !== payment.amount || order.currency.trim() !== payment.currency) {
      return { error: "payment_amount_mismatch" as const };
    }
    if (order.status === "paid" && order.razorpay_payment_id === payment.id) {
      return { ok: true as const, idempotent: true as const };
    }
    if (order.status !== "created") return { error: "payment_conflict" as const };

    const [user] = await query<{ email: string }>(
      `update users set
         premium_until=greatest(coalesce(premium_until, now()), now()) + ($1::int * interval '1 day'),
         premium_source='paid'
       where id::text=$2
       returning email`,
      [order.days, order.user_id_text],
    );
    if (!user) return { error: "user_not_found" as const };
    await query(
      `update razorpay_payments
       set razorpay_payment_id=$1, status='paid', signature_verified_at=now(), premium_granted_at=now(), updated_at=now()
       where razorpay_order_id=$2`,
      [payment.id, payment.order_id],
    );
    return { ok: true as const, idempotent: false as const, order, email: user.email };
  });

  if (result.ok && !result.idempotent) {
    await sendRazorpayInvoiceEmail(result.order, payment.order_id, payment.id, result.email);
  }
  if ("error" in result) return { error: result.error };
  return { ok: true as const, idempotent: result.idempotent };
}

// A receipt-email outage must never turn a completed payment into a failed
// verification response. The invoice is also always available in Settings.
async function sendRazorpayInvoiceEmail(payment: Order, orderId: string, paymentId: string, email: string) {
  try {
    const invoice = buildInvoice({
      order_id: orderId,
      plan: payment.plan,
      status: "paid",
      price_amount: (Number(payment.amount_paise) / 100).toFixed(2),
      pay_currency: payment.currency,
      days: payment.days,
      created_at: payment.created_at,
      premium_granted_at: new Date(),
      provider_invoice_id: paymentId,
      provider: "razorpay",
    } satisfies PaymentRecord, email);
    await sendMail({
      to: email,
      subject: invoiceEmailSubject(invoice),
      text: invoiceEmailText(invoice),
      html: invoiceEmailHtml(invoice),
      type: "invoice",
    });
  } catch (error) {
    console.error("[pay:razorpay] receipt email failed", {
      orderId,
      reason: error instanceof Error ? error.message.slice(0, 200) : "unknown_error",
    });
  }
}
