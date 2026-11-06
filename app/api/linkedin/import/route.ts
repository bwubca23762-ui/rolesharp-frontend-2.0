import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { looksLikeLinkedinExport, parseLinkedinProfile } from "@/lib/linkedin-import";

export const runtime = "nodejs";

// The file itself goes through /api/check-resume/upload, which already owns
// size limits, magic-byte validation and PDF extraction. This route only turns
// that extracted text into structured resume content, so there is one upload
// path to harden rather than two.
const Body = z.object({ text: z.string().min(40).max(200_000) });

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "linkedin-import", 20);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the extracted profile text." }, { status: 400 });

  const { text } = parsed.data;
  if (!looksLikeLinkedinExport(text)) {
    return NextResponse.json(
      {
        error: "not_linkedin_export",
        detail:
          "This does not look like a LinkedIn profile export. On your profile choose More, then Save to PDF, and upload that file.",
      },
      { status: 422 },
    );
  }

  try {
    const result = parseLinkedinProfile(text);
    return NextResponse.json(result);
  } catch {
    // The parser throws only when the result would not satisfy ResumeContent.
    // Half-built content must not reach the builder.
    return NextResponse.json(
      { error: "unreadable_export", detail: "We could not read this export. You can still build manually." },
      { status: 422 },
    );
  }
}
