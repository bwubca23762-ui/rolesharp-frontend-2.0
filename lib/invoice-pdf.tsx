import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatDate, formatMoney, type Invoice } from "./invoice";

// Same renderer as the resume export (lib/pdf.tsx), so there is one PDF stack
// in the app rather than two.

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.45, color: "#1f2937" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#111827" },
  paid: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#047857" },
  muted: { color: "#6b7280" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 24 },
  col: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  h2: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#6b7280", letterSpacing: 1, marginBottom: 4 },
  block: { marginTop: 22 },
  th: { flexDirection: "row", borderBottom: "1 solid #d1d5db", paddingBottom: 5, marginBottom: 6 },
  tr: { flexDirection: "row", paddingVertical: 4 },
  cDesc: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  cNum: { width: 44, textAlign: "right" },
  cAmt: { width: 78, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 12, paddingVertical: 3 },
  totalLabel: { width: 120, textAlign: "right" },
  totalValue: { width: 78, textAlign: "right" },
  grand: { borderTop: "1 solid #d1d5db", marginTop: 4, paddingTop: 6 },
  note: { marginTop: 3, fontSize: 9, color: "#6b7280" },
  footer: { position: "absolute", bottom: 28, left: 40, right: 40, fontSize: 8, color: "#9ca3af", textAlign: "center" },
});

function Party({ heading, name, addressLines, email, taxId, site }: {
  heading: string; name: string; addressLines: readonly string[]; email: string; taxId?: string; site?: string;
}) {
  return (
    <View style={s.col}>
      <Text style={s.h2}>{heading}</Text>
      <Text style={s.bold}>{name}</Text>
      {addressLines.map((line, i) => <Text key={i}>{line}</Text>)}
      <Text>{email}</Text>
      {site ? <Text style={s.muted}>{site}</Text> : null}
      {taxId ? <Text style={s.muted}>Tax ID: {taxId}</Text> : null}
    </View>
  );
}

function InvoiceDoc({ invoice }: { invoice: Invoice }) {
  const c = invoice.currency;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View style={s.col}>
            <Text style={s.title}>Invoice</Text>
            <Text style={s.paid}>PAID</Text>
          </View>
          <View style={[s.col, { alignItems: "flex-end" }]}>
            <Text style={s.bold}>{invoice.number}</Text>
            <Text style={s.muted}>Issued {formatDate(invoice.issuedAt)}</Text>
            <Text style={s.muted}>Paid {formatDate(invoice.paidAt)}</Text>
          </View>
        </View>

        <View style={[s.row, s.block]}>
          <Party heading="FROM" {...invoice.seller} />
          <Party heading="BILL TO" {...invoice.buyer} />
        </View>

        <View style={s.block}>
          <View style={s.th}>
            <Text style={[s.cDesc, s.h2]}>DESCRIPTION</Text>
            <Text style={[s.cNum, s.h2]}>QTY</Text>
            <Text style={[s.cAmt, s.h2]}>UNIT</Text>
            <Text style={[s.cAmt, s.h2]}>AMOUNT</Text>
          </View>
          {invoice.lines.map((line, i) => (
            <View key={i}>
              <View style={s.tr}>
                <Text style={s.cDesc}>{line.description}</Text>
                <Text style={s.cNum}>{line.quantity}</Text>
                <Text style={s.cAmt}>{formatMoney(line.unitAmount, c)}</Text>
                <Text style={s.cAmt}>{formatMoney(line.amount, c)}</Text>
              </View>
              <Text style={s.note}>
                Access period {formatDate(line.periodStart)} to {formatDate(line.periodEnd)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.block}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalValue}>{formatMoney(invoice.subtotal, c)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{invoice.taxLabel}</Text>
            <Text style={s.totalValue}>{formatMoney(invoice.taxAmount, c)}</Text>
          </View>
          <View style={[s.totalRow, s.grand]}>
            <Text style={[s.totalLabel, s.bold]}>Total paid</Text>
            <Text style={[s.totalValue, s.bold]}>{formatMoney(invoice.total, c)}</Text>
          </View>
        </View>

        <View style={s.block}>
          <Text style={s.h2}>PAYMENT</Text>
          <Text>Method: {invoice.payment.method}</Text>
          <Text>Status: {invoice.payment.status}</Text>
          {invoice.payment.settledCurrency ? <Text>Settled in: {invoice.payment.settledCurrency}</Text> : null}
          <Text style={s.muted}>Order reference: {invoice.payment.reference}</Text>
          {invoice.payment.providerInvoiceId
            ? <Text style={s.muted}>Provider invoice: {invoice.payment.providerInvoiceId}</Text>
            : null}
        </View>

        <View style={s.block}>
          <Text style={s.h2}>NOTES</Text>
          {invoice.notes.map((note, i) => <Text key={i} style={s.note}>{note}</Text>)}
        </View>

        <Text style={s.footer} fixed>
          {invoice.number} · {invoice.seller.name} · {invoice.seller.email}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: Invoice): Promise<Buffer> {
  return renderToBuffer(<InvoiceDoc invoice={invoice} />);
}
