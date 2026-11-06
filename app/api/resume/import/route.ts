import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { parseResumeText } from "@/lib/resume-import";
import { currentUser } from "@/lib/auth";
import { looksLikeLinkedinExport, parseLinkedinProfile } from "@/lib/linkedin-import";

export const runtime = "nodejs";

// The file itself goes through /api/check-resume/upload, which already owns
// size limits, magic-byte validation and PDF/DOCX extraction. This route only
// turns extracted text into structured resume content — one hardened upload
// path, two parsers behind it.
const Body = {
  // mirrors the LinkedIn importer's contract
  min: 40,
  max: 200_000,
};

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "resume-import", 20);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (text.length < Body.min || text.length > Body.max) {
    return NextResponse.json({ error: "Send the extracted resume text." }, { status: 400 });
  }

  // A LinkedIn export has its own dedicated parser with stricter anchors.
  if (looksLikeLinkedinExport(text)) {
    try {
      const result = parseLinkedinProfile(text);
      return NextResponse.json({ ...result, source: "linkedin" });
    } catch {
      return NextResponse.json(
        { error: "unreadable_resume", detail: "We could not read this export. You can still build manually." },
        { status: 422 },
      );
    }
  }

  let result;
  try {
    result = parseResumeText(text);
  } catch {
    return NextResponse.json(
      { error: "unreadable_resume", detail: "We could not read this resume's structure. You can still build manually." },
      { status: 422 },
    );
  }

  const user = await currentUser();
  if (!user?.premium) {
    // Free tier: prove the parse worked without handing over the editable
    // draft. Enough to show the value; not enough to skip the builder.
    const content = result.content;
    const firstRole = content.experiences[0];
    return NextResponse.json({
      source: "generic",
      premiumRequired: true,
      name: result.name,
      found: result.found,
      warnings: result.warnings,
      preview: {
        sectionsFound: result.found.length,
        skillsSample: content.skills.slice(0, 6),
        latestRole: firstRole ? { title: firstRole.title, company: firstRole.company, period: firstRole.period ?? "" } : null,
      },
    });
  }

  return NextResponse.json({ ...result, source: "generic" });
}
