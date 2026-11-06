import { createHash } from "crypto";
import { SUPPORT_EMAIL } from "./contact";
import { env } from "./env";
import { isPaid } from "./nowpay";

// The invoice a paying user receives. Kept as a pure model so the PDF, the
// email and the tests all render the same numbers from one place.
//
// Seller identity is CONFIGURED, never invented: an invoice is a financial
// document and a made-up legal name, address or tax id on one is worse than an
// absent line. Anything unset is omitted rather than guessed.

export type InvoiceParty = {
  readonly name: string;
  readonly addressLines: readonly string[];
  readonly email: string;
  readonly taxId?: string;
  readonly site?: string;
};

export type InvoiceLine = {
  readonly description: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly quantity: number;
  readonly unitAmount: number;
  readonly amount: number;
};

export type Invoice = {
  readonly number: string;
  readonly issuedAt: Date;
  readonly paidAt: Date;
  readonly seller: InvoiceParty;
  readonly buyer: InvoiceParty;
  readonly lines: readonly InvoiceLine[];
  readonly subtotal: number;
  readonly taxLabel: string;
  readonly taxAmount: number;
  readonly total: number;
  readonly currency: string;
  readonly payment: {
    readonly method: string;
    readonly reference: string;
    readonly providerInvoiceId: string | null;
    readonly settledCurrency: string | null;
    readonly status: "Paid";
  };
  readonly notes: readonly string[];
};

export type PaymentRecord = {
  readonly order_id: string;
  readonly plan: string | null;
  readonly status: string;
  readonly price_amount: string | null;
  readonly pay_currency: string | null;
  readonly days: number | null;
  readonly created_at: string | Date;
  readonly premium_granted_at: string | Date | null;
  readonly provider_invoice_id: string | null;
  readonly provider?: "crypto" | "razorpay";
};

// Deterministic so the same payment always yields the same invoice number, with
// no sequence table to keep in sync and no risk of renumbering a document the
// customer already holds. Derived from the order id, which is already unique.
export function invoiceNumber(orderId: string, issuedAt: Date): string {
  const digest = createHash("sha256").update(orderId).digest("hex").slice(0, 6).toUpperCase();
  const day = [
    issuedAt.getUTCFullYear(),
    String(issuedAt.getUTCMonth() + 1).padStart(2, "0"),
    String(issuedAt.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `RS-${day}-${digest}`;
}

export function invoiceEligible(status: string): boolean {
  return isPaid(status) || status === "paid";
}

function planLabel(plan: string | null, days: number): string {
  const term = plan === "yearly" ? "Annual" : plan === "monthly" ? "Monthly" : "Fixed-term";
  return `RoleSharp Premium — ${term} pass (${days} days)`;
}

export function sellerFromEnv(): InvoiceParty {
  const addressLines = (process.env.INVOICE_ADDRESS ?? "")
    .split("|")
    .map((line) => line.trim())
    .filter(Boolean);
  const taxId = (process.env.INVOICE_TAX_ID ?? "").trim();
  return {
    name: (process.env.INVOICE_LEGAL_NAME ?? "").trim() || "RoleSharp",
    addressLines,
    email: SUPPORT_EMAIL,
    site: env.siteUrl,
    ...(taxId ? { taxId } : {}),
  };
}

export function buildInvoice(
  payment: PaymentRecord,
  buyerEmail: string,
  seller: InvoiceParty = sellerFromEnv(),
): Invoice {
  if (!invoiceEligible(payment.status)) {
    throw new Error(`invoice requested for unpaid status: ${payment.status}`);
  }
  // Prefer the moment access was granted. A payment that somehow lacks it still
  // gets a document rather than a crash, dated when the order was created.
  const paidAt = new Date(payment.premium_granted_at ?? payment.created_at);
  const days = payment.days && payment.days > 0 ? payment.days : env.daysMonthly;
  const periodEnd = new Date(paidAt.getTime() + days * 24 * 60 * 60 * 1000);
  const amount = Number(payment.price_amount ?? 0);
  const line: InvoiceLine = {
    description: planLabel(payment.plan, days),
    periodStart: paidAt,
    periodEnd,
    quantity: 1,
    unitAmount: amount,
    amount,
  };
  return {
    number: invoiceNumber(payment.order_id, paidAt),
    issuedAt: paidAt,
    paidAt,
    seller,
    buyer: { name: buyerEmail, addressLines: [], email: buyerEmail },
    lines: [line],
    subtotal: amount,
    taxLabel: "Tax",
    taxAmount: 0,
    total: amount,
    currency: payment.provider === "razorpay"
      ? (payment.pay_currency?.toUpperCase() || "INR")
      : env.premiumCurrency,
    payment: {
      method: payment.provider === "razorpay" ? "Razorpay Standard Checkout" : "Cryptocurrency via NOWPayments",
      reference: payment.order_id,
      providerInvoiceId: payment.provider_invoice_id,
      settledCurrency: payment.pay_currency ? payment.pay_currency.toUpperCase() : null,
      status: "Paid",
    },
    notes: [
      "Paid in full. No balance is due.",
      "This is a one-time fixed-term pass. It does not auto-renew and no further charge will be made.",
      "No tax was charged on this transaction.",
      `Questions about this invoice: ${SUPPORT_EMAIL}`,
    ],
  };
}

export function formatMoney(amount: number, currency: string): string {
  return `${currency === "USD" ? "$" : ""}${amount.toFixed(2)}${currency === "USD" ? "" : ` ${currency}`}`;
}

export function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function invoiceFileName(invoice: Invoice): string {
  return `rolesharp-invoice-${invoice.number}.pdf`;
}
