import { NextResponse } from "next/server";
import { GUIDE_FILENAME } from "@/lib/job-search-guide";
import { renderJobSearchGuidePdf } from "@/lib/job-search-guide-pdf";

export const runtime = "nodejs";

// The guide is the same document for everybody and only changes when the code
// changes, so it is rendered once per process and handed out from memory after
// that. No rate limit: without this, a PDF render per request would be the
// expensive part; with it, the second request onward is a buffer copy.
let cached: Promise<Buffer> | null = null;

export async function GET() {
  cached ??= renderJobSearchGuidePdf();
  let pdf: Buffer;
  try {
    pdf = await cached;
  } catch (err) {
    // Do not leave a rejected promise cached — every later request would fail
    // for the lifetime of the process on one bad render.
    cached = null;
    throw err;
  }
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${GUIDE_FILENAME}"`,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
