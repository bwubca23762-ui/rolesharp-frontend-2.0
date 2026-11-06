import { NextRequest, NextResponse } from "next/server";
import { verifyIpn, isPaid, paymentMatchesInvoice } from "@/lib/nowpay";
import { q } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { buildInvoice, type PaymentRecord } from "@/lib/invoice";
import { invoiceEmailHtml, invoiceEmailSubject, invoiceEmailText } from "@/lib/invoice-email";

export const runtime = "nodejs";

// NOWPayments IPN callback. Verifies signature, marks payment, grants premium.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-nowpayments-sig") ?? "";
  if (!verifyIpn(raw, sig)) {
    // A rejected callback used to leave no trace at all: no log, no row, no way
    // to tell a scanner probing /api/* from a real payment we just dropped. One
    // genuine NOWPayments callback was rejected on 2026-08-06 and there is still
    // no way to say which it was. Never log `sig` or the body: the signature is
    // a secret-derived MAC and the body carries payout addresses.
    let orderId = "(unparseable)";
    try {
      const parsed = JSON.parse(raw);
      orderId = typeof parsed?.order_id === "string" ? parsed.order_id : "(absent)";
    } catch { /* keep (unparseable) */ }
    const quarantined = await quarantine(orderId, raw, sig);
    console.error("[pay:ipn] rejected", {
      orderId,
      signaturePresent: sig.length > 0,
      bodyBytes: raw.length,
      quarantined,
      ua: (req.headers.get("user-agent") ?? "").slice(0, 40),
    });
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const orderId: string = body.order_id ?? "";
  const status: string = body.payment_status ?? "";
  const paymentId = String(body.payment_id ?? body.id ?? orderId);

  // The local order is committed before the provider request. A callback can
  // therefore reconcile an invoice whose HTTP response timed out or was lost.
  if (orderId && paymentId) {
    await q(
      `update crypto_payments
       set provider_invoice_id=coalesce(provider_invoice_id,$1),
           status=case when status='invoice_unknown' then 'waiting' else status end,
           invoice_error=null,
           updated_at=now()
       where order_id=$2`,
      [paymentId, orderId],
    ).catch(() => {});
  }

  // resolve user + plan duration from our payment record
  const rec = (await q<{ user_id_text: string; days: number; status: string; price_amount: string }>(
    "select user_id_text, days, status, price_amount::text from crypto_payments where order_id=$1 limit 1",
    [orderId],
  ))[0];
  const userId = rec?.user_id_text;
  const matchesInvoice = !!rec && paymentMatchesInvoice(body, {
    orderId,
    priceAmount: Number(rec.price_amount),
    priceCurrency: "usd",
  });
  if (rec && isPaid(status) && !matchesInvoice) {
    await q(
      `update crypto_payments set status='validation_failed', pay_currency=$1, updated_at=now()
       where order_id=$2 and premium_granted_at is null`,
      [body.pay_currency ?? null, orderId],
    );
    return NextResponse.json({ error: "payment details did not match invoice" }, { status: 400 });
  }
  // Callbacks can arrive out of order. Once access has been granted, retain
  // the paid receipt instead of downgrading it on a delayed waiting update.
  await q(
    `update crypto_payments set status=$1, pay_currency=$2, updated_at=now()
     where order_id=$3 and premium_granted_at is null`,
    [status, body.pay_currency ?? null, orderId],
  );

  // Only a payment created by this app can grant premium. The conditional UPDATE
  // is atomic, so concurrent or duplicate callbacks cannot grant twice.
  if (rec && userId && matchesInvoice) {
    // RETURNING is what makes the receipt idempotent: a duplicate callback
    // finds premium_granted_at already set, updates no row, and emails nobody.
    const granted = await q<GrantedPayment>(
      `with payment as (
         select order_id, user_id_text, days
         from crypto_payments
         where order_id=$1 and premium_granted_at is null
         for update
       ), granted as (
         update users u set
           premium_until=greatest(coalesce(u.premium_until, now()), now()) + (p.days || ' days')::interval,
           premium_source='paid'
         from payment p where u.id::text=p.user_id_text
         returning p.order_id
       )
       update crypto_payments c set premium_granted_at=now()
       from granted g where c.order_id=g.order_id
       returning c.order_id, c.plan, c.status, c.price_amount::text, c.pay_currency,
                 c.days, c.created_at, c.premium_granted_at, c.provider_invoice_id`,
      [orderId],
    );
    if (granted[0]) {
      await sendInvoiceEmail(granted[0], userId);
      // Referral premium bonus (P2): when an invited user buys a Premium pass
      // for the first time, the inviter gets 7 days of Premium. Self-funding —
      // the inviter already has an account, 7 days is marginal cost, and the
      // direct financial incentive makes sharing worth doing.
      await q(
        `with ref as (
           select referred_by from users where id::text = $1 and referred_by is not null
         ), inviter_active as (
           select u.id from users u
           join ref on u.id = ref.referred_by
           where u.premium_until > now()
         )
         update users set
           premium_until = greatest(premium_until, now()) + interval '7 days'
         where id in (select id from inviter_active)
        `,
        [userId],
      ).catch(() => {}); // bonus is best-effort; never blocks the payment grant
    }
  }
  return NextResponse.json({ ok: true, paymentId });
}

type GrantedPayment = PaymentRecord;

// A rejected callback with a wrong secret is indistinguishable from a genuine
// one, so it is kept rather than dropped: see db/migrations/053_ipn_quarantine.
// Stored only when order_id names a payment this app created, which is what
// keeps scanners out of the table. Never throws and never changes the response
// -- an unverified callback must still be refused, quarantined or not.
const MAX_QUARANTINE_BODY_BYTES = 16_384;

async function quarantine(orderId: string, raw: string, sig: string): Promise<boolean> {
  if (!sig || raw.length > MAX_QUARANTINE_BODY_BYTES) return false;
  try {
    const rows = await q<{ id: number }>(
      `insert into ipn_quarantine (order_id, signature, body)
       select $1, $2, $3
       where exists (select 1 from crypto_payments where order_id=$1)
         and not exists (
           select 1 from ipn_quarantine
           where order_id=$1 and signature=$2 and replayed_at is null
         )
       returning id`,
      [orderId, sig, raw],
    );
    return rows.length > 0;
  } catch (error) {
    console.error("[pay:ipn] quarantine failed", {
      orderId,
      reason: error instanceof Error ? error.message.slice(0, 200) : "unknown_error",
    });
    return false;
  }
}

// The customer gets their invoice the moment access is granted. Never let this
// throw into the callback: the money already moved and premium is already on,
// so a mail outage must not turn into a provider retry storm.
async function sendInvoiceEmail(payment: GrantedPayment, userId: string) {
  try {
    const buyer = (await q<{ email: string | null }>(
      "select email from users where id::text=$1 limit 1",
      [userId],
    ))[0];
    if (!buyer?.email) return;
    const invoice = buildInvoice(payment, buyer.email);
    await sendMail({
      to: buyer.email,
      subject: invoiceEmailSubject(invoice),
      text: invoiceEmailText(invoice),
      html: invoiceEmailHtml(invoice),
      type: "invoice",
    });
  } catch (error) {
    console.error("[pay:invoice] receipt email failed", {
      orderId: payment.order_id,
      reason: error instanceof Error ? error.message.slice(0, 200) : "unknown_error",
    });
  }
}
