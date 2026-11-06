import { z } from "zod";

export const INTERNSHIP_REPORT_RISKS = ["high", "suspicious", "unconfirmed"] as const;
export const INTERNSHIP_REPORT_CATEGORIES = [
  "Fake offer letter",
  "Upfront payment",
  "Identity or data theft",
  "Unpaid or ghosted",
  "Training fee scam",
] as const;

const MAX_EVIDENCE_FILES = 3;
const MAX_EVIDENCE_FILE_BYTES = 1024 * 1024;
const MAX_EVIDENCE_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil((MAX_EVIDENCE_FILE_BYTES * 4) / 3) + 8;

const evidenceSchema = z.object({
  name: z.string().trim().min(1).max(180),
  type: z.enum(["image/png", "image/jpeg", "application/pdf"]),
  data: z.string().min(4).max(MAX_BASE64_LENGTH),
}).strict();

export const internshipReportSchema = z.object({
  company: z.string().trim().min(2).max(160),
  location: z.string().trim().min(2).max(160),
  platform: z.string().trim().max(120).optional().default(""),
  risk: z.enum(INTERNSHIP_REPORT_RISKS),
  categories: z.array(z.enum(INTERNSHIP_REPORT_CATEGORIES)).min(1).max(5)
    .refine((items) => new Set(items).size === items.length, "Categories must be unique"),
  description: z.string().trim().min(40).max(4000),
  sourceUrl: z.string().trim().max(2048).optional().default(""),
  evidence: z.array(evidenceSchema).max(MAX_EVIDENCE_FILES).optional().default([]),
}).strict();

export const internshipCommentSchema = z.object({
  body: z.string().trim().min(2).max(1000),
}).strict();

export function safeHttpUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type ValidatedEvidence = {
  name: string;
  type: "image/png" | "image/jpeg" | "application/pdf";
  bytes: Buffer;
};

function signatureMatches(type: ValidatedEvidence["type"], bytes: Buffer) {
  if (type === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function decodeEvidence(files: Array<{ name: string; type: ValidatedEvidence["type"]; data: string }>) {
  const decoded: ValidatedEvidence[] = [];
  let total = 0;
  for (const file of files) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(file.data) || file.data.length % 4 !== 0) {
      throw new Error("invalid_evidence_encoding");
    }
    const bytes = Buffer.from(file.data, "base64");
    if (!bytes.length || bytes.length > MAX_EVIDENCE_FILE_BYTES || !signatureMatches(file.type, bytes)) {
      throw new Error("invalid_evidence_file");
    }
    total += bytes.length;
    if (total > MAX_EVIDENCE_TOTAL_BYTES) throw new Error("evidence_total_too_large");
    decoded.push({ name: file.name.replace(/[\\/\u0000-\u001f\u007f]/g, "_").slice(0, 180), type: file.type, bytes });
  }
  return decoded;
}
