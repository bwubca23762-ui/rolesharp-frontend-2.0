import React from "react";
import { Document, Page, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/**
 * Clean PDF rendering of a generator's text output (summary, career summary,
 * resignation letter). Premium perk: watermark-free, letterhead-ready.
 *
 * Deliberately separate from renderResumePdf: these are documents built from
 * free-form pasted text, not structured ResumeContent, so the resume schema
 * does not apply.
 */

const styles = StyleSheet.create({
  page: { padding: 56, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.6, color: "#1f2937" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#111827", marginBottom: 14 },
  body: { whiteSpace: "pre-wrap" },
  footer: { position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", color: "#9ca3af", fontSize: 8 },
});

export async function renderDocumentPdf(title: string, body: string): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
