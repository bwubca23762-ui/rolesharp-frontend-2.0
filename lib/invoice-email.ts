import { env } from "./env";
import { formatDate, formatMoney, type Invoice } from "./invoice";
import { escapeHtml } from "./escape-html";

// The receipt the customer gets in their inbox. Deliberately HTML and text
// only: rendering the PDF here would put @react-pdf/renderer on the payment
// callback path, where a slow render or an OOM would cost a granted upgrade.
// The PDF stays one authenticated click away.


export function invoiceDownloadUrl(invoice: Invoice): string {
  return `${env.siteUrl}/api/account/invoice/${encodeURIComponent(invoice.payment.reference)}`;
}

export function invoiceEmailSubject(invoice: Invoice): string {
  return `Your RoleSharp invoice ${invoice.number}`;
}

export function invoiceEmailText(invoice: Invoice): string {
  const c = invoice.currency;
  const lines = invoice.lines.map((line) =>
    `  ${line.description}\n    Access period ${formatDate(line.periodStart)} to ${formatDate(line.periodEnd)}\n    ${line.quantity} x ${formatMoney(line.unitAmount, c)} = ${formatMoney(line.amount, c)}`,
  );
  return [
    `Invoice ${invoice.number} — PAID`,
    `Issued ${formatDate(invoice.issuedAt)} · Paid ${formatDate(invoice.paidAt)}`,
    "",
    "FROM",
    invoice.seller.name,
    ...invoice.seller.addressLines,
    invoice.seller.email,
    invoice.seller.taxId ? `Tax ID: ${invoice.seller.taxId}` : "",
    "",
    "BILL TO",
    invoice.buyer.email,
    "",
    "ITEMS",
    ...lines,
    "",
    `Subtotal: ${formatMoney(invoice.subtotal, c)}`,
    `${invoice.taxLabel}: ${formatMoney(invoice.taxAmount, c)}`,
    `Total paid: ${formatMoney(invoice.total, c)}`,
    "",
    "PAYMENT",
    `Method: ${invoice.payment.method}`,
    `Status: ${invoice.payment.status}`,
    invoice.payment.settledCurrency ? `Settled in: ${invoice.payment.settledCurrency}` : "",
    `Order reference: ${invoice.payment.reference}`,
    "",
    `Download the PDF: ${invoiceDownloadUrl(invoice)}`,
    "",
    ...invoice.notes,
  ].filter((line) => line !== "").join("\n");
}

export function invoiceEmailHtml(invoice: Invoice): string {
  const c = invoice.currency;
  const e = escapeHtml;
  const cell = "padding:6px 0;font-size:14px;color:#1f2937;";
  const muted = "font-size:13px;color:#6b7280;";
  const rows = invoice.lines.map((line) => `
    <tr>
      <td style="${cell}">
        <strong>${e(line.description)}</strong><br />
        <span style="${muted}">Access period ${formatDate(line.periodStart)} to ${formatDate(line.periodEnd)}</span>
      </td>
      <td style="${cell}text-align:right;">${line.quantity}</td>
      <td style="${cell}text-align:right;">${e(formatMoney(line.amount, c))}</td>
    </tr>`).join("");
  const sellerAddress = invoice.seller.addressLines.map((line) => `${e(line)}<br />`).join("");
  return `<!doctype html>
<html><body style="margin:0;background:#f9fafb;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;background:#ffffff;">
    <h1 style="margin:0;font-size:24px;color:#111827;">Invoice</h1>
    <p style="margin:4px 0 0;font-weight:bold;color:#047857;">PAID</p>
    <p style="${muted}margin:16px 0 0;">
      <strong style="color:#111827;">${e(invoice.number)}</strong><br />
      Issued ${formatDate(invoice.issuedAt)} · Paid ${formatDate(invoice.paidAt)}
    </p>

    <table role="presentation" width="100%" style="margin-top:24px;border-collapse:collapse;">
      <tr>
        <td valign="top" style="${cell}width:50%;">
          <div style="${muted}letter-spacing:1px;">FROM</div>
          <strong>${e(invoice.seller.name)}</strong><br />
          ${sellerAddress}
          ${e(invoice.seller.email)}<br />
          ${invoice.seller.taxId ? `<span style="${muted}">Tax ID: ${e(invoice.seller.taxId)}</span>` : ""}
        </td>
        <td valign="top" style="${cell}width:50%;">
          <div style="${muted}letter-spacing:1px;">BILL TO</div>
          ${e(invoice.buyer.email)}
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" style="margin-top:24px;border-collapse:collapse;">
      <tr style="border-bottom:1px solid #d1d5db;">
        <th align="left" style="${muted}letter-spacing:1px;padding-bottom:6px;">DESCRIPTION</th>
        <th align="right" style="${muted}letter-spacing:1px;padding-bottom:6px;">QTY</th>
        <th align="right" style="${muted}letter-spacing:1px;padding-bottom:6px;">AMOUNT</th>
      </tr>
      ${rows}
    </table>

    <table role="presentation" width="100%" style="margin-top:16px;border-collapse:collapse;">
      <tr><td align="right" style="${cell}">Subtotal</td><td align="right" style="${cell}width:110px;">${e(formatMoney(invoice.subtotal, c))}</td></tr>
      <tr><td align="right" style="${cell}">${e(invoice.taxLabel)}</td><td align="right" style="${cell}">${e(formatMoney(invoice.taxAmount, c))}</td></tr>
      <tr style="border-top:1px solid #d1d5db;">
        <td align="right" style="${cell}font-weight:bold;">Total paid</td>
        <td align="right" style="${cell}font-weight:bold;">${e(formatMoney(invoice.total, c))}</td>
      </tr>
    </table>

    <div style="margin-top:24px;">
      <div style="${muted}letter-spacing:1px;">PAYMENT</div>
      <p style="${cell}margin:4px 0;">
        Method: ${e(invoice.payment.method)}<br />
        Status: ${e(invoice.payment.status)}<br />
        ${invoice.payment.settledCurrency ? `Settled in: ${e(invoice.payment.settledCurrency)}<br />` : ""}
        <span style="${muted}">Order reference: ${e(invoice.payment.reference)}</span>
      </p>
    </div>

    <p style="margin:24px 0;">
      <a href="${e(invoiceDownloadUrl(invoice))}"
         style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">
        Download PDF invoice
      </a>
    </p>

    <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
      ${invoice.notes.map((note) => `<p style="${muted}margin:4px 0;">${e(note)}</p>`).join("")}
    </div>
  </div>
</body></html>`;
}
