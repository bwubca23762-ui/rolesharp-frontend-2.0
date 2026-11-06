import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

// Editable Word rendering of a generator's text output — the DOCX twin of
// renderDocumentPdf (lib/document-pdf.tsx), with the same reason to exist:
// generator output is free-form text, not structured ResumeContent, so
// renderResumeDocx's schema does not apply. Premium perk (Platform Premium
// only — students are deliberately excluded from DOCX, see
// lib/tier-features.ts).
export async function renderDocumentDocx(title: string, body: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
    ...body
      .split(/\n/)
      .map((line) => new Paragraph({ children: [new TextRun({ text: line, font: "Calibri" })] })),
  ];
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBuffer(doc);
}
