import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildInvoice,
  formatMoney,
  invoiceEligible,
  invoiceFileName,
  invoiceNumber,
  type PaymentRecord,
} from "../lib/invoice";
import { invoiceEmailHtml, invoiceEmailSubject, invoiceEmailText } from "../lib/invoice-email";
import { renderInvoicePdf } from "../lib/invoice-pdf";
import { isPaid } from "../lib/nowpay";

const source = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const paid: PaymentRecord = {
  order_id: "yearly_2f1c0b6e-0000-4000-8000-000000000001_abc",
  plan: "yearly",
  status: "finished",
  price_amount: "79",
  pay_currency: "btc",
  days: 365,
  created_at: "2026-08-06T10:00:00.000Z",
  premium_granted_at: "2026-08-06T12:48:00.000Z",
  provider_invoice_id: "6373785972",
};

test("the invoice number is stable for a payment and unique across payments", () => {
  // Derived from the order id rather than a counter, so re-issuing a document
  // the customer already holds cannot renumber it, and there is no sequence
  // table to fall out of sync with the payments it describes.
  const issued = new Date("2026-08-06T12:48:00.000Z");
  const first = invoiceNumber(paid.order_id, issued);
  assert.equal(first, invoiceNumber(paid.order_id, issued));
  assert.match(first, /^RS-20260806-[0-9A-F]{6}$/);
  assert.notEqual(first, invoiceNumber("monthly_other_order", issued));
});

test("only a completed payment produces an invoice", () => {
  assert.equal(invoiceEligible("finished"), true);
  assert.equal(invoiceEligible("confirmed"), true);
  for (const status of ["waiting", "expired", "failed", "refunded", "validation_failed"]) {
    assert.equal(invoiceEligible(status), false, `${status} must not be invoiceable`);
  }
  assert.throws(() => buildInvoice({ ...paid, status: "waiting" }, "buyer@example.com"), /unpaid status/);
});

test("every section of the invoice is populated from the payment", () => {
  const invoice = buildInvoice(paid, "buyer@example.com");
  assert.equal(invoice.payment.status, "Paid");
  assert.equal(invoice.payment.reference, paid.order_id);
  assert.equal(invoice.payment.providerInvoiceId, "6373785972");
  assert.equal(invoice.payment.settledCurrency, "BTC");
  assert.equal(invoice.buyer.email, "buyer@example.com");
  assert.ok(invoice.seller.name, "the seller block must never be empty");
  assert.ok(invoice.seller.email.includes("@"));

  assert.equal(invoice.lines.length, 1);
  const [line] = invoice.lines;
  assert.match(line.description, /Annual pass \(365 days\)/);
  assert.equal(line.quantity, 1);
  assert.equal(line.unitAmount, 79);
  // 365 days of access, counted from the moment premium was granted.
  assert.equal(line.periodStart.toISOString(), "2026-08-06T12:48:00.000Z");
  assert.equal(line.periodEnd.toISOString(), "2027-08-06T12:48:00.000Z");

  assert.equal(invoice.subtotal, 79);
  assert.equal(invoice.taxAmount, 0);
  assert.equal(invoice.total, 79);
  assert.ok(invoice.notes.some((n) => /does not auto-renew/.test(n)),
    "a one-time pass must say so on the document");
  assert.match(invoiceFileName(invoice), /^rolesharp-invoice-RS-\d{8}-[0-9A-F]{6}\.pdf$/);
});

test("a payment missing its grant timestamp still yields a dated document", () => {
  // Never crash on a money document. Fall back to the order date.
  const invoice = buildInvoice({ ...paid, premium_granted_at: null }, "buyer@example.com");
  assert.equal(invoice.paidAt.toISOString(), "2026-08-06T10:00:00.000Z");
});

test("money always carries two decimals", () => {
  assert.equal(formatMoney(79, "USD"), "$79.00");
  assert.equal(formatMoney(0, "USD"), "$0.00");
  assert.equal(formatMoney(12.5, "USD"), "$12.50");
  assert.equal(formatMoney(79, "EUR"), "79.00 EUR");
});

test("the emailed invoice carries every section and escapes the buyer address", () => {
  const invoice = buildInvoice(paid, "buyer+tag@example.com");
  const text = invoiceEmailText(invoice);
  const html = invoiceEmailHtml(invoice);
  assert.match(invoiceEmailSubject(invoice), /RS-\d{8}-[0-9A-F]{6}/);
  for (const section of ["FROM", "BILL TO", "Total paid", "Order reference", "PAYMENT"]) {
    assert.ok(text.includes(section), `plain text is missing ${section}`);
  }
  assert.ok(text.includes("$79.00"));
  assert.ok(text.includes("/api/account/invoice/"), "the text part must link the PDF");
  assert.ok(html.includes("Download PDF invoice"));
  assert.ok(html.includes("Total paid"));

  const injected = buildInvoice(paid, "<script>alert(1)</script>@example.com");
  assert.ok(!invoiceEmailHtml(injected).includes("<script>"),
    "an address must never reach the email as markup");
});

test("the invoice renders to a real PDF", async () => {
  const pdf = await renderInvoicePdf(buildInvoice(paid, "buyer@example.com"));
  assert.ok(pdf.length > 1000, "a one-page invoice should not be near-empty");
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
});

test("the download route scopes the payment to its owner and refuses unpaid orders", () => {
  // An invoice exposes an email address and an amount. Fetching one by guessing
  // another account's order id must select no row at all, not be filtered after.
  const route = source("app/api/account/invoice/[orderId]/route.ts");
  assert.match(route, /where p\.order_id = \$1 and p\.user_id_text = \$2/,
    "the owner must be in the WHERE clause");
  assert.match(route, /invoiceEligible\(payment\.status\)/);
  assert.match(route, /login_required/);
  assert.match(route, /Cache-Control": "private, no-store/);
});

test("the receipt email is sent once per grant, and never breaks the callback", () => {
  const webhook = source("app/api/pay/crypto/webhook/route.ts");
  // The conditional grant is what makes this idempotent: a duplicate callback
  // updates no row, so RETURNING is empty and no second receipt goes out.
  assert.match(webhook, /returning c\.order_id/);
  assert.match(webhook, /if \(granted\[0\]\) \{[\s\S]*?sendInvoiceEmail/);
  assert.match(webhook, /catch \(error\) \{[\s\S]*pay:invoice/,
    "a mail failure must not throw into the payment callback");
});

test("the billing table offers an invoice on exactly the paid statuses", () => {
  // billing.tsx is a client component and cannot import lib/nowpay, so the two
  // lists are duplicated on purpose. This is the assertion that keeps them equal.
  const billing = source("app/settings/panels/billing.tsx");
  const declared = billing.match(/const PAID_STATUSES = \[([^\]]+)\]/);
  assert.ok(declared, "billing.tsx must declare PAID_STATUSES");
  const statuses = declared[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
  // Razorpay calls a captured charge "paid" while NOWPayments uses its own
  // finished/confirmed statuses. Both providers share this billing history.
  assert.deepEqual(statuses, ["finished", "confirmed", "paid"]);
  for (const status of statuses.filter((status) => status !== "paid")) assert.equal(isPaid(status), true, `${status} disagrees with isPaid()`);
  assert.match(billing, /\/api\/account\/invoice\//);
});
