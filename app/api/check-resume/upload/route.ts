import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { rateLimit } from "@/lib/rate-limit";
import { validateResumeFile } from "@/lib/upload-security";

export const runtime = "nodejs";

class PdfToolUnavailableError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024;
const execFileAsync = promisify(execFile);

function cleanText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfWithPoppler(bytes: Buffer) {
  const dir = await mkdtemp(join(tmpdir(), "resumeai-pdf-"));
  const file = join(dir, "upload.pdf");
  try {
    await writeFile(file, bytes);
    try {
      const { stdout } = await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", file, "-"], { timeout: 10_000, maxBuffer: 2_000_000 });
      return stdout || "";
    } catch (err) {
      // Missing system binary: distinguish a deployment/dependency problem from a bad file.
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new PdfToolUnavailableError("pdftotext_unavailable");
      }
      throw err;
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function extractPdfText(bytes: Buffer) {
  return extractPdfWithPoppler(bytes);
}

async function extractDocxText(bytes: Buffer) {
  const dir = await mkdtemp(join(tmpdir(), "resumeai-docx-"));
  const file = join(dir, "upload.docx");
  try {
    await writeFile(file, bytes);
    const script = join(process.cwd(), "scripts", "extract-docx.mjs");
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--max-old-space-size=128", script, file],
      { timeout: 10_000, maxBuffer: 1_100_000 },
    );
    return stdout || "";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "upload", 10);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "Upload the resume as multipart/form-data with a file field." },
      { status: 415 },
    );
  }
  // Reject a declared oversized multipart body before Next.js buffers/parses it.
  // Allow a small envelope for multipart boundaries and field headers.
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "File is too large. Upload a resume under 5 MB." }, { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a resume file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large. Upload a resume under 5 MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let text = "";

  try {
    const kind = validateResumeFile(file.name, file.type, bytes);
    if (kind === "txt") {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } else if (kind === "docx") {
      text = await extractDocxText(bytes);
    } else {
      text = await extractPdfText(bytes);
    }
  } catch (err) {
    if (err instanceof PdfToolUnavailableError) {
      return NextResponse.json({ error: "PDF text extraction is temporarily unavailable. Please try again later, or upload a DOCX/TXT file." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not read this file. If it is a PDF, export it as a text-based PDF instead of a scan, or upload DOCX/TXT." }, { status: 422 });
  }

  text = cleanText(text);
  if (text.length > 1_000_000) {
    return NextResponse.json({ error: "Extracted resume text is too large." }, { status: 413 });
  }
  // 80, not 40: /api/check-resume (and generate) reject text under 80 chars,
  // so a 40-79 char import would pass here and then fail at scoring time.
  // Reject at the door with the same threshold the scorers enforce.
  if (text.length < 80) {
    return NextResponse.json({ error: `We could not find enough readable resume text (at least 80 characters — this file has ${text.length}). Scanned/image-only PDFs need OCR or a DOCX/TXT upload.` }, { status: 422 });
  }

  return NextResponse.json({
    filename: file.name,
    size: file.size,
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  });
}
