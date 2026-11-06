import { inflateSync, inflateRawSync } from "node:zlib";
import { resumeSourceText } from "./resume-source-text";
import { keywordCoverage } from "./ats-score";

// ATS text-layer seal. A resume can score 100 on content and still be
// invisible to an employer's ATS if the exported file's text layer is broken:
// contact details rendered as icon glyphs, kerned glyph runs that decode as
// garbage, sections silently dropped. This module opens the *rendered
// artifact itself* — the same bytes the user downloads — extracts what a
// machine parser sees, and reports the gaps honestly. It never edits the
// document; a keyword the resume does not support stays a stated gap.
//
// The PDF side is scoped to our own @react-pdf/renderer output (standard
// fonts, FlateDecode streams, WinAnsi text operators) so no PDF-parsing
// dependency is needed; if the renderer's output ever changes shape, the
// extractor fails open with an explicit "could not verify" finding rather
// than faking a pass.

export type AtsFinding = { id: string; severity: "error" | "warning"; detail: string };
export type AtsSeal = {
  ok: boolean; // no error-severity findings
  kind: "pdf" | "docx";
  chars: number;
  findings: AtsFinding[];
};

export type AtsExpected = {
  /** The text that went INTO the renderer, flattened — the baseline for word-loss checks. */
  sourceText: string;
  email?: string;
  phone?: string;
  /** Job description, when known — coverage is compared source vs extraction. */
  jd?: string;
};

// ── WinAnsi (PDFDocEncoding-compatible for the printable range) ──
const WIN_ANSI: Record<number, string> = {
  0x80: "\u20AC", 0x82: "\u201A", 0x83: "\u0192", 0x84: "\u201E", 0x85: "\u2026",
  0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02C6", 0x89: "\u2030", 0x8A: "\u0160",
  0x8B: "\u2039", 0x8C: "\u0152", 0x8E: "\u017D", 0x91: "\u2018", 0x92: "\u2019",
  0x93: "\u201C", 0x94: "\u201D", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
  0x98: "\u02DC", 0x99: "\u2122", 0x9A: "\u0161", 0x9B: "\u203A", 0x9C: "\u0153",
  0x9E: "\u017E", 0x9F: "\u0178",
};

function decodeWinAnsi(bytes: Buffer): string {
  let out = "";
  for (const b of bytes) {
    if (b < 0x20 && b !== 0x0a && b !== 0x0d && b !== 0x09) { out += "\uFFFD"; continue; }
    out += WIN_ANSI[b] ?? String.fromCharCode(b);
  }
  return out;
}

function decodeHexString(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  const padded = clean.length % 2 ? clean + "0" : clean;
  return decodeWinAnsi(Buffer.from(padded, "hex"));
}

function decodeLiteralString(raw: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c !== 0x5c) { bytes.push(c); continue; } // backslash
    const n = raw[++i];
    if (n === undefined) break;
    if (n >= "0" && n <= "7") {
      let oct = n;
      while (oct.length < 3 && raw[i + 1] >= "0" && raw[i + 1] <= "7") oct += raw[++i];
      bytes.push(parseInt(oct, 8) & 0xff);
    } else if (n === "n") bytes.push(0x0a);
    else if (n === "r") bytes.push(0x0d);
    else if (n === "t") bytes.push(0x09);
    else if (n === "b") bytes.push(0x08);
    else if (n === "f") bytes.push(0x0c);
    else if (n === "\r") { if (raw[i + 1] === "\n") i++; bytes.push(0x0a); }
    else if (n === "\n") bytes.push(0x0a);
    else bytes.push(n.charCodeAt(0)); // \( \) \\ and any other escaped char
  }
  return decodeWinAnsi(Buffer.from(bytes));
}

/**
 * Extract the text a machine parser sees in a PDF produced by our renderer:
 * inflate every stream, walk BT..ET text blocks, decode hex and literal
 * string tokens. Layout operators and kerning numbers are intentionally
 * ignored — ATS parsers read the strings, not the geometry.
 */
export function extractPdfText(buf: Buffer): string {
  const latin = buf.toString("latin1");
  let out = "";
  for (const s of latin.matchAll(/stream\r?\n/g)) {
    const start = (s.index ?? 0) + s[0].length;
    const end = latin.indexOf("endstream", start);
    if (end < 0) continue;
    const chunk = buf.subarray(start, end);
    let content = "";
    try { content = inflateSync(chunk).toString("latin1"); }
    catch { try { content = inflateRawSync(chunk).toString("latin1"); } catch { continue; } }
    for (const block of content.matchAll(/BT([\s\S]*?)ET/g)) {
      for (const t of block[1].matchAll(/<([0-9A-Fa-f\s]*)>|\(((?:\\.|[^\\()])*)\)/g)) {
        out += t[1] !== undefined ? decodeHexString(t[1]) : decodeLiteralString(t[2]);
      }
      out += "\n";
    }
  }
  return out;
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** DOCX text layer: the word/document.xml body, tags stripped, entities decoded. */
export async function extractDocxText(buf: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const doc = zip.file("word/document.xml");
  if (!doc) return "";
  const xml = await doc.async("string");
  return xml
    .replace(/<w:p\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => XML_ENTITIES[e] ?? e);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function verifyExtracted(kind: AtsSeal["kind"], extracted: string, expected: AtsExpected): AtsSeal {
  const findings: AtsFinding[] = [];
  const chars = extracted.length;

  if (chars < 40) {
    findings.push({
      id: "extract_failed",
      severity: "error",
      detail: "The file's text layer could not be read — an ATS would see an empty document. Re-export, and if this repeats, report it.",
    });
    return { ok: false, kind, chars, findings };
  }

  const replacement = (extracted.match(/\uFFFD/g) ?? []).length;
  if (replacement > 5) {
    findings.push({ id: "garbled_text", severity: "error", detail: `${replacement} unreadable characters in the text layer — an ATS may garble parts of this file.` });
  } else if (replacement > 0) {
    findings.push({ id: "garbled_text", severity: "warning", detail: `${replacement} character${replacement === 1 ? "" : "s"} may not survive an ATS parse (usually a special symbol).` });
  }

  if (expected.email && !extracted.toLowerCase().includes(expected.email.toLowerCase())) {
    findings.push({ id: "contact_email", severity: "warning", detail: "The contact email is not present as selectable text — an ATS could not read it. Check for icon fonts or symbols in the header." });
  }
  if (expected.phone) {
    const digits = expected.phone.replace(/\D/g, "");
    const extractedDigits = extracted.replace(/\D/g, "");
    if (digits.length >= 7 && !extractedDigits.includes(digits.slice(-7))) {
      findings.push({ id: "contact_phone", severity: "warning", detail: "The contact phone number is not present as selectable text — an ATS could not read it." });
    }
  }

  const sourceWords = countWords(expected.sourceText);
  const extractedWords = countWords(extracted);
  if (sourceWords > 20) {
    const ratio = extractedWords / sourceWords;
    if (ratio < 0.5) {
      findings.push({ id: "word_loss", severity: "error", detail: `Only ${Math.round(ratio * 100)}% of the resume text is machine-readable — whole sections would be invisible to an ATS.` });
    } else if (ratio < 0.8) {
      findings.push({ id: "word_loss", severity: "warning", detail: `About ${Math.round(ratio * 100)}% of the resume text is machine-readable — some content may not reach an ATS.` });
    }
  }

  if (expected.jd && countWords(expected.jd) > 20) {
    const sourceCoverage = keywordCoverage(expected.jd, expected.sourceText);
    const extractedCoverage = keywordCoverage(expected.jd, extracted);
    if (sourceCoverage - extractedCoverage >= 15) {
      findings.push({ id: "coverage_loss", severity: "warning", detail: `Keyword coverage drops from ${sourceCoverage}% in the document to ${extractedCoverage}% in the machine-readable text layer.` });
    }
  }

  return { ok: !findings.some((f) => f.severity === "error"), kind, chars, findings };
}

export function verifyPdfArtifact(buf: Buffer, expected: AtsExpected): AtsSeal {
  return verifyExtracted("pdf", extractPdfText(buf), expected);
}

export async function verifyDocxArtifact(buf: Buffer, expected: AtsExpected): Promise<AtsSeal> {
  return verifyExtracted("docx", await extractDocxText(buf), expected);
}

/**
 * Serialize a seal for the X-Ats-Seal response header. encodeURIComponent keeps
 * it header-safe (ASCII); findings are capped so the header stays small.
 */
export function sealHeader(seal: AtsSeal): string {
  return encodeURIComponent(JSON.stringify({
    ok: seal.ok,
    kind: seal.kind,
    findings: seal.findings.slice(0, 5).map((f) => ({ id: f.id, severity: f.severity, detail: f.detail.slice(0, 140) })),
  }));
}

// Client tools need the flattened resume text without this module's node:zlib
// deps, so the function lives in its own pure module; re-exported here to keep
// the existing server import paths stable.
export { resumeSourceText };
