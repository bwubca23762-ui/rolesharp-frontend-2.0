import { randomUUID } from "crypto";
import { createInvoice } from "./nowpay";
import { env } from "./env";
import { q } from "./db";

type PaymentPlan = {
  readonly id: string;
  readonly label: string;
  readonly cents: number;
  readonly days: number;
};

type PendingPayment = {
  readonly orderId: string;
  readonly invoiceUrl: string | null;
  readonly providerInvoiceId: string | null;
  readonly live: boolean;
  readonly recovered: boolean;
};

// Cancel a pending/recoverable invoice so a failed redemption does not leave
// a discounted invoice sitting in the 15-minute recovery window — a retry
// without the promo would otherwise recover (and charge) the discounted
// amount, and a second promo could stack onto a second invoice.
export async function cancelPendingInvoice(providerInvoiceId: string) {
  await q(
    `update crypto_payments
     set status='cancelled', updated_at=now()
     where provider_invoice_id=$1 and status in ('invoice_pending', 'invoice_unknown', 'waiting')`,
    [providerInvoiceId],
  );
}

export async function createRecoverableInvoice(
  userId: string,
  plan: PaymentPlan,
): Promise<PendingPayment> {
  const existing = (await q<{
    order_id: string;
    price_amount: string | number | null;
    invoice_url: string | null;
    provider_invoice_id: string | null;
  }>(
    `select order_id, price_amount, invoice_url, provider_invoice_id
     from crypto_payments
     where user_id_text=$1 and plan=$2
       and status in ('invoice_pending', 'invoice_unknown', 'waiting')
       and created_at > now() - interval '15 minutes'
     order by created_at desc
     limit 1`,
    [userId, plan.id],
  ))[0];
  // A reused pending invoice must match the price the user is asking for
  // NOW: the plan's cents can differ from the stored row when a promo was
  // applied (or prices changed) between visits. Paying a stale invoice would
  // charge the wrong amount for the same plan id. Mismatched rows are voided
  // so the fresh insert below takes over.
  const expectedAmount = plan.cents / 100;
  if (existing && Number(existing.price_amount ?? expectedAmount) !== expectedAmount) {
    await q(
      `update crypto_payments
      set status='cancelled'
      where order_id=$1 and status in ('invoice_pending', 'invoice_unknown', 'waiting')`,
      [existing.order_id],
    );
    return createRecoverableInvoice(userId, plan);
  }
  if (existing?.invoice_url) {
    return {
      orderId: existing.order_id,
      invoiceUrl: existing.invoice_url,
      providerInvoiceId: existing.provider_invoice_id,
      live: true,
      recovered: true,
    };
  }
  // Do not issue a second provider request while the first response is unknown.
  if (existing) {
    return {
      orderId: existing.order_id,
      invoiceUrl: null,
      providerInvoiceId: existing.provider_invoice_id,
      live: true,
      recovered: true,
    };
  }

  const orderId = `${plan.id}_${userId}_${randomUUID()}`;
  await q(
    `insert into crypto_payments
       (id, order_id, user_id_text, status, price_amount, plan, days)
     values ($1,$2,$3,'invoice_pending',$4,$5,$6)`,
    [`pending_${orderId}`, orderId, userId, plan.cents / 100, plan.id, plan.days],
  );

  try {
    const invoice = await createInvoice(
      orderId,
      env.siteUrl,
      plan.cents,
      `RoleSharp Premium (${plan.label})`,
    );
    await q(
      `update crypto_payments
       set provider_invoice_id=$1, invoice_url=$2, status='waiting',
           invoice_attempted_at=now(), invoice_error=null, updated_at=now()
       where order_id=$3`,
      [invoice.id, invoice.invoiceUrl, orderId],
    );
    return {
      orderId,
      invoiceUrl: invoice.invoiceUrl,
      providerInvoiceId: invoice.id,
      live: invoice.live,
      recovered: false,
    };
  } catch (error) {
    const unknown = error instanceof Error
      && (error.name === "TimeoutError" || error.name === "AbortError");
    await q(
      `update crypto_payments
       set status=$1, invoice_attempted_at=now(), invoice_error=$2, updated_at=now()
       where order_id=$3`,
      [
        unknown ? "invoice_unknown" : "invoice_failed",
        error instanceof Error ? error.message.slice(0, 500) : "invoice_creation_failed",
        orderId,
      ],
    ).catch(() => {});
    throw error;
  }
}
