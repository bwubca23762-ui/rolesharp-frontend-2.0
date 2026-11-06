import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ResumeContent } from "./types";
import { displayHeadline } from "./resume-display";

// Pure-JS PDF (no headless Chrome). ~150ms vs Puppeteer's ~800ms.
// Free tier: 'basic' template + watermark. Premium: any template, no watermark.

const PALETTES: Record<string, { accent: string; rule: string; serif?: boolean }> = {
  basic: { accent: "#111827", rule: "#cccccc" },
  modern: { accent: "#4f46e5", rule: "#c7d2fe" },
  compact: { accent: "#0f766e", rule: "#99f6e4" },
  // premium templates
  executive: { accent: "#1e3a5f", rule: "#cbd5e1", serif: true }, // serif, corporate navy
  elegant: { accent: "#7c3aed", rule: "#e9d5ff" }, // refined violet
  minimal: { accent: "#0f172a", rule: "#e5e7eb" }, // ultra-clean monochrome
  technical: { accent: "#0369a1", rule: "#bae6fd" }, // engineer blue
};

function styles(template: string) {
  const p = PALETTES[template] ?? PALETTES.basic;
  const compact = template === "compact";
  const body = p.serif ? "Times-Roman" : "Helvetica";
  const bold = p.serif ? "Times-Bold" : "Helvetica-Bold";
  return StyleSheet.create({
    page: { padding: compact ? 28 : 32, fontSize: compact ? 9 : p.serif ? 9.5 : 10, fontFamily: body, lineHeight: 1.4, color: "#1f2937" },
    name: { fontSize: compact ? 17 : 20, fontFamily: bold, color: p.accent, lineHeight: 1.15, marginBottom: 3 },
    head: { color: p.accent, marginBottom: 8, fontFamily: bold, lineHeight: 1.2 },
    h2: { fontSize: compact ? 11 : 12, fontFamily: bold, marginTop: p.serif ? 9 : 10, marginBottom: 3, borderBottom: `1 solid ${p.rule}`, color: p.accent },
    role: { fontFamily: bold },
    bullet: { marginLeft: 10 },
    wm: { position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", color: "#9ca3af", fontSize: 8 },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
    headerCopy: { flexGrow: 1, flexShrink: 1 },
    photo: { width: 64, height: 64, objectFit: "cover", borderRadius: 4 },
  });
}

function ResumeDoc({
  content, name, template = "basic", watermark = false, photoDataUrl,
}: { content: ResumeContent; name: string; template?: string; watermark?: boolean; photoDataUrl?: string }) {
  const s = styles(template);
  const headline = displayHeadline(content.headline, name);
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View style={s.headerCopy}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.head}>{headline}</Text>
            {content.contact && (
              <Text style={{ color: "#475569", marginBottom: 6 }}>
                {[content.contact.email, content.contact.phone, content.contact.location, content.contact.linkedin, ...(content.contact.links ?? [])].filter(Boolean).join("  •  ")}
              </Text>
            )}
          </View>
          {photoDataUrl && (
            // react-pdf's Image is a PDF primitive, not an HTML image.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={photoDataUrl} style={s.photo} />
          )}
        </View>
        <Text style={s.h2}>Professional Summary</Text>
        <Text>{content.summary}</Text>

        <Text style={s.h2}>Skills</Text>
        <Text>{content.skills.join(" • ")}</Text>

        <Text style={s.h2}>Experience</Text>
        {content.experiences.length ? content.experiences.map((e, i) => (
          <View key={i} style={{ marginBottom: 6 }}>
            <Text style={s.role}>{e.title}{e.company ? ` — ${e.company}` : ""} {e.period ? `(${e.period})` : ""}</Text>
            {e.bullets.map((b, j) => <Text key={j} style={s.bullet}>• {b}</Text>)}
          </View>
        )) : <Text>Entry-level candidate: see projects, education, and certifications.</Text>}

        {!!content.projects?.length && (
          <>
            <Text style={s.h2}>Projects</Text>
            {content.projects.map((p, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <Text style={s.role}>{p.name}</Text>
                <Text style={s.bullet}>• {p.detail}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={s.h2}>Education</Text>
        {content.education.map((ed, i) => (
          <Text key={i}>{ed.degree}{ed.school ? `, ${ed.school}` : ""} {ed.year ?? ""}{ed.detail ? ` — ${ed.detail}` : ""}</Text>
        ))}

        {!!content.certifications?.length && (
          <>
            <Text style={s.h2}>Certifications</Text>
            <Text>{content.certifications.join(" • ")}</Text>
          </>
        )}

        {!!content.achievements?.length && (
          <>
            <Text style={s.h2}>Achievements</Text>
            {content.achievements.map((a, i) => <Text key={i} style={s.bullet}>• {a}</Text>)}
          </>
        )}

        {!!content.languages?.length && (
          <>
            <Text style={s.h2}>Languages</Text>
            <Text>{content.languages.join(" • ")}</Text>
          </>
        )}

        {watermark && <Text style={s.wm} fixed>Made with RoleSharp — upgrade to remove this</Text>}
      </Page>
    </Document>
  );
}

export async function renderResumePdf(
  content: ResumeContent, name: string, opts?: { template?: string; watermark?: boolean; photoDataUrl?: string },
): Promise<Buffer> {
  return renderToBuffer(
    <ResumeDoc content={content} name={name} template={opts?.template ?? "basic"} watermark={opts?.watermark ?? false} photoDataUrl={opts?.photoDataUrl} />,
  );
}
