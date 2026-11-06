import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

import { renderDocumentPdf } from "../lib/document-pdf";
import { renderDocumentDocx } from "../lib/document-docx";
import { renderResumePdf } from "../lib/pdf";
import { ResumeContent } from "../lib/types";
import {
  extractPdfText, resumeSourceText, sealHeader,
  verifyDocxArtifact, verifyPdfArtifact,
} from "../lib/ats-extract";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// The ATS text-layer seal opens the rendered artifact — the same bytes the
// user downloads — and reports what a machine parser actually sees: contact
// details present as literal text, no garbled glyphs, no silently dropped
// sections. A strong content score means nothing if the text layer is broken,
// so these pins cover the seal on real renders, its honest failure mode, and
// its wiring on every export surface.

const CONTACT = { email: "ravi@example.com", phone: "+91 98765 43210" };

const resumeContent = ResumeContent.parse({
  headline: "QA Engineer",
  contact: { ...CONTACT, location: "Bengaluru" },
  summary: "Detail-focused QA engineer with three years of experience in web application testing.",
  skills: ["Selenium", "SQL", "API testing"],
  experiences: [{
    title: "QA Engineer", company: "Acme", period: "2023—2026",
    bullets: ["Cut regression time 40% by automating smoke suites.", "Filed 300+ verified bug reports across three releases."],
  }],
  education: [{ degree: "BSc Computer Science", school: "ABC University", year: "2023" }],
});

test("resume PDF artifact: contacts extract, glyph-free, nothing lost", async () => {
  const pdf = await renderResumePdf(resumeContent, "Ravi Kumar", { template: "basic", watermark: true });
  const seal = verifyPdfArtifact(pdf, {
    sourceText: resumeSourceText(resumeContent),
    email: CONTACT.email,
    phone: CONTACT.phone,
    jd: "We need a QA engineer with Selenium, SQL and API testing experience for web applications.",
  });
  assert.equal(seal.ok, true);
  assert.deepEqual(seal.findings, []);
  const text = extractPdfText(pdf);
  assert.match(text, /ravi@example\.com/u);
  assert.match(text, /QA Engineer/u);
  // The watermark is ordinary text in the same layer — extractable too.
  assert.match(text, /Made with RoleSharp/u);
});

test("generator document PDF and DOCX artifacts pass the seal", async () => {
  const text = "Detail-focused QA engineer.\nravi@example.com  •  +91 98765 43210";
  const sourceText = `QA Engineer — Ravi Kumar\n${text}`;
  const pdfSeal = verifyPdfArtifact(await renderDocumentPdf("QA Engineer — Ravi Kumar", text), {
    sourceText, ...CONTACT,
  });
  assert.equal(pdfSeal.ok, true, JSON.stringify(pdfSeal.findings));

  const docxSeal = await verifyDocxArtifact(await renderDocumentDocx("QA Engineer — Ravi Kumar", text), {
    sourceText, ...CONTACT,
  });
  assert.equal(docxSeal.ok, true, JSON.stringify(docxSeal.findings));
  assert.match(docxSeal.chars + "", /\d+/u);
});

test("a broken artifact fails open with an explicit error, never a fake pass", () => {
  const seal = verifyPdfArtifact(Buffer.from("this is not a pdf at all"), { sourceText: "irrelevant" });
  assert.equal(seal.ok, false);
  assert.equal(seal.findings[0]?.id, "extract_failed");
  assert.equal(seal.findings[0]?.severity, "error");
});

test("dropped sections are reported as word loss against the source text", async () => {
  // Long enough to clear the 40-char extract floor, still ~100x fewer words
  // than the source — the seal must name the loss, not pass silently.
  const short = "Short line padded with a few common words so the extractor floor is safely cleared.";
  const longSource = Array.from({ length: 120 }, (_, i) => `Achievement bullet number ${i} with measurable impact words`).join("\n");
  const seal = verifyPdfArtifact(await renderDocumentPdf("Report", short), { sourceText: longSource });
  assert.equal(seal.ok, false);
  assert.ok(seal.findings.some((f) => f.id === "word_loss" && f.severity === "error"), JSON.stringify(seal.findings));
});

test("missing contact text is a named warning, not a silent pass", async () => {
  // Render a document without the contact line, then ask the seal about it.
  const seal = verifyPdfArtifact(await renderDocumentPdf("Resume", "Body text without any contact line at all, long enough to pass the extract floor."), {
    sourceText: "Body text without any contact line at all, long enough to pass the extract floor.",
    email: "ghost@example.com",
    phone: "+1 555 000 1111",
  });
  const ids = seal.findings.map((f) => f.id);
  assert.ok(ids.includes("contact_email"), JSON.stringify(seal.findings));
  assert.ok(ids.includes("contact_phone"), JSON.stringify(seal.findings));
  assert.equal(seal.ok, true, "warnings must not fail the seal; only errors do");
});

test("hex text operators decode via WinAnsi (em dash, bullet, accented letters)", () => {
  // Extracted from a real renderer probe: the title "QA Engineer — Ravi" emits
  // hex <514120456e67696e656572209720526169> where 0x97 is the WinAnsi em-dash
  // byte, and a bullet separator emits <95>. The extractor must read them the
  // way an ATS does. Streams are FlateDecode — the fixture compresses too.
  const content = "BT\n[<514120456e67696e65657220972052617669> 0] TJ\nET\nBT\n(\x95 ) Tj\nET\n";
  const fake = Buffer.concat([
    Buffer.from("stream\n"),
    deflateSync(Buffer.from(content, "latin1")),
    Buffer.from("\nendstream\n"),
  ]);
  const extracted = extractPdfText(fake);
  assert.match(extracted, /QA Engineer \u2014 Ravi/u);
  assert.match(extracted, /\u2022/u);
});

test("every export route attaches the seal header", () => {
  for (const route of [
    "app/api/resume/[id]/pdf/route.ts",
    "app/api/resume/[id]/docx/route.ts",
    "app/api/tools/export-pdf/route.ts",
    "app/api/tools/export-docx/route.ts",
  ]) {
    assert.match(source(route), /X-Ats-Seal/u, `${route} must attach the seal header`);
    assert.match(source(route), /verify(Pdf|Docx)Artifact/u, `${route} must verify the artifact`);
  }
  // The header is safe for HTTP: encoded, capped, findings trimmed.
  const header = sealHeader({ ok: true, kind: "pdf", chars: 10, findings: [{ id: "x", severity: "warning", detail: "déjà vu — unicode must survive encoding" }] });
  assert.match(header, /^[\x21-\x7E%]+$/u); // printable ASCII + percent-escapes only
});

test("the builder surfaces the seal next to the export buttons", () => {
  const build = source("app/build/page.tsx");
  assert.match(build, /AtsSealNotice/u);
  assert.match(build, /X-Ats-Seal/u);
  assert.match(build, /if \(!out\?\.resumeId \|\| exporting\) return;/);
  // The e2e-pinned link contract survives: href stays on the anchor.
  assert.match(build, /as="a" href=\{`\/api\/resume\/\$\{out\.resumeId\}\/pdf`\}/u);
});

test("the micro generator tools surface the seal too", () => {
  const tool = source("components/tools/MicroGeneratorTool.tsx");
  assert.match(tool, /AtsSealNotice/u);
  assert.match(tool, /X-Ats-Seal/u);
  assert.match(tool, /if \(!output \|\| exporting\) return;/);
});
