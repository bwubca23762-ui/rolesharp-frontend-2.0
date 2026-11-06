import { AlignmentType, Document, ImageRun, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { ResumeContent } from "./types";
import { displayHeadline } from "./resume-display";
import { photoDataUrlBuffer } from "./resume-photo";

// Editable Word export (premium perk).
export async function renderResumeDocx(content: ResumeContent, name: string, opts?: { photoDataUrl?: string }): Promise<Buffer> {
  const headline = displayHeadline(content.headline, name);
  const photo = photoDataUrlBuffer(opts?.photoDataUrl);
  const children: Paragraph[] = [
    ...(photo ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: photo.data, type: photo.type, transformation: { width: 72, height: 72 } })] })] : []),
    new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 36 })] }),
    new Paragraph({ children: [new TextRun({ text: headline, color: "4f46e5", bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: [content.contact?.email, content.contact?.phone, content.contact?.location, content.contact?.linkedin, ...(content.contact?.links ?? [])].filter(Boolean).join("  •  "), color: "475569" })] }),
    new Paragraph({ text: "Professional Summary", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ children: [new TextRun(content.summary)] }),
    new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ children: [new TextRun(content.skills.join(" • "))] }),
    new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2 }),
  ];
  for (const e of content.experiences) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${e.title}${e.company ? " — " + e.company : ""}${e.period ? " (" + e.period + ")" : ""}`, bold: true })],
      }),
    );
    for (const b of e.bullets) children.push(new Paragraph({ text: b, bullet: { level: 0 } }));
  }
  if (!content.experiences.length) {
    children.push(new Paragraph({ children: [new TextRun("Entry-level candidate: see projects, education, and certifications.")]}));
  }
  if (content.projects?.length) {
    children.push(new Paragraph({ text: "Projects", heading: HeadingLevel.HEADING_2 }));
    for (const p of content.projects) {
      children.push(new Paragraph({ children: [new TextRun({ text: p.name, bold: true })] }));
      children.push(new Paragraph({ text: p.detail, bullet: { level: 0 } }));
    }
  }
  children.push(new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_2 }));
  for (const ed of content.education) {
    children.push(new Paragraph({ children: [new TextRun(`${ed.degree}${ed.school ? ", " + ed.school : ""} ${ed.year ?? ""}${ed.detail ? " — " + ed.detail : ""}`)] }));
  }
  if (content.certifications?.length) {
    children.push(new Paragraph({ text: "Certifications", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ children: [new TextRun(content.certifications.join(" • "))] }));
  }
  if (content.achievements?.length) {
    children.push(new Paragraph({ text: "Achievements", heading: HeadingLevel.HEADING_2 }));
    for (const a of content.achievements) children.push(new Paragraph({ text: a, bullet: { level: 0 } }));
  }
  if (content.languages?.length) {
    children.push(new Paragraph({ text: "Languages", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ children: [new TextRun(content.languages.join(" • "))] }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
