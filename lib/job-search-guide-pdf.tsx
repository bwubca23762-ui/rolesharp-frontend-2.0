import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import {
  GUIDE_LIMITS,
  GUIDE_STEPS,
  GUIDE_SUBTITLE,
  GUIDE_TITLE,
  bulletDemo,
  FILLER_PHRASES,
  LETTER_SHAPES,
} from "./job-search-guide";

// Same renderer as the invoice (lib/invoice-pdf.tsx) and the resume export
// (lib/pdf.tsx). One PDF stack in the app, not three.

const s = StyleSheet.create({
  page: { padding: 44, paddingBottom: 64, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.5, color: "#1f2937" },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", color: "#111827" },
  subtitle: { fontSize: 11, color: "#6b7280", marginTop: 6 },
  lede: { marginTop: 18, paddingTop: 14, borderTop: "1 solid #e5e7eb" },
  step: { marginTop: 22 },
  stepHead: { flexDirection: "row", gap: 8, alignItems: "baseline" },
  n: { fontFamily: "Helvetica-Bold", color: "#4f46e5", width: 16 },
  h: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#111827", flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  rule: { marginTop: 4, marginLeft: 24, fontFamily: "Helvetica-Oblique", color: "#4f46e5" },
  body: { marginTop: 5, marginLeft: 24 },
  li: { marginTop: 3, marginLeft: 24, flexDirection: "row", gap: 6 },
  bullet: { color: "#9ca3af" },
  liText: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  tool: { marginTop: 5, marginLeft: 24, fontSize: 9, color: "#4f46e5" },
  h2: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#111827", marginBottom: 8 },
  block: { marginTop: 26 },
  demo: { marginTop: 10, padding: 12, backgroundColor: "#f9fafb", borderLeft: "2 solid #4f46e5" },
  was: { color: "#9ca3af", textDecoration: "line-through" },
  now: { fontFamily: "Helvetica-Bold", marginTop: 2 },
  note: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  muted: { color: "#6b7280" },
  footer: { position: "absolute", bottom: 30, left: 44, right: 44, fontSize: 8, color: "#9ca3af", textAlign: "center" },
});

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={s.li}>
          <Text style={s.bullet}>•</Text>
          <Text style={s.liText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

function GuideDoc() {
  const demo = bulletDemo();
  return (
    <Document title={GUIDE_TITLE} author="RoleSharp">
      <Page size="A4" style={s.page} wrap>
        <Text style={s.title}>{GUIDE_TITLE}</Text>
        <Text style={s.subtitle}>{GUIDE_SUBTITLE}</Text>
        <View style={s.lede}>
          <Text style={s.muted}>
            Seven steps, in order. Each one is what RoleSharp&apos;s own tools do, written down so you
            can do it by hand if you prefer. Nothing here needs an account.
          </Text>
        </View>

        {GUIDE_STEPS.map((step) => (
          <View key={step.n} style={s.step} wrap={false}>
            <View style={s.stepHead}>
              <Text style={s.n}>{step.n}.</Text>
              <Text style={s.h}>{step.title}</Text>
            </View>
            <Text style={s.rule}>{step.rule}</Text>
            <Text style={s.body}>{step.why}</Text>
            <Bullets items={step.actions} />
            {step.tool ? <Text style={s.tool}>rolesharp.com{step.tool.href} — {step.tool.label}</Text> : null}
          </View>
        ))}

        <View style={s.block} break>
          <Text style={s.h2}>What step 3 looks like</Text>
          <Text style={s.muted}>
            Three lines through the same rewrite the free bullet tool runs. It removes filler and
            fixes shape; anything that would need a fact you did not give comes back as a note.
          </Text>
          {demo.map((review, i) => (
            <View key={i} style={s.demo} wrap={false}>
              <Text style={s.was}>{review.original}</Text>
              <Text style={s.now}>{review.improved}</Text>
              {review.notes.length === 0 ? (
                <Text style={s.note}>Nothing to add — verb, result and number are all here.</Text>
              ) : (
                review.notes.map((note, j) => <Text key={j} style={s.note}>{note}</Text>)
              )}
            </View>
          ))}
        </View>

        <View style={s.block} wrap={false}>
          <Text style={s.h2}>Phrases the score marks down</Text>
          <Text style={s.muted}>
            Each one pushes the verb to the middle of the sentence and the result off the end of it.
          </Text>
          <Bullets items={FILLER_PHRASES} />
        </View>

        <View style={s.block} wrap={false}>
          <Text style={s.h2}>The six letter shapes</Text>
          {LETTER_SHAPES.map((shape) => (
            <View key={shape.name} style={{ marginTop: 8 }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{shape.name} — {shape.leadsWith}</Text>
              <Text style={s.note}>{shape.useWhen}</Text>
            </View>
          ))}
        </View>

        <View style={s.block} wrap={false}>
          <Text style={s.h2}>What this guide will not do</Text>
          <Bullets items={GUIDE_LIMITS} />
        </View>

        <Text style={s.footer} fixed>
          rolesharp.com — free ATS scoring, tailoring, and job-search tools
        </Text>
      </Page>
    </Document>
  );
}

export function renderJobSearchGuidePdf(): Promise<Buffer> {
  return renderToBuffer(<GuideDoc />);
}
