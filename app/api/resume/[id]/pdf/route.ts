import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getUserResume } from "@/lib/db";
import { renderResumePdf } from "@/lib/pdf";
import { ResumeContent } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { getDevUserResume } from "@/lib/local-dev-store";
import { resumeSourceText, sealHeader, verifyPdfArtifact } from "@/lib/ats-extract";

export const runtime = "nodejs";

// Tiered download: free => basic template + watermark; premium => chosen
// template, no watermark.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // PDF rendering is CPU-heavy on the 8GB box — throttle per IP.
  const limited = await rateLimit(req, "pdf", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const { id } = await params;
  const r = await (env.localDevMode ? getDevUserResume(id, user.id) : getUserResume(id, user.id));
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });

  const premium = user.premium || !!("premium_unlock" in r ? r.premium_unlock : r.premiumUnlock);
  const template = premium ? (r.template ?? "basic") : "basic";

  const parsed = ResumeContent.safeParse(r.content);
  if (!parsed.success) return NextResponse.json({ error: "This resume's data is invalid or outdated. Re-generate it to download." }, { status: 422 });
  const content = parsed.data;
  const name = ("candidate_name" in r ? r.candidate_name : r.candidateName) ?? content.headline ?? "Resume";
  try {
    const pdf = await renderResumePdf(content, name, { template, watermark: !premium });
    // ATS text-layer seal: open the artifact this download serves and report
    // what a machine parser actually sees (contacts present as text, no
    // garbled glyphs, nothing dropped). Findings ride a response header — the
    // file itself is byte-for-byte the download.
    const rowRecord = r as Record<string, unknown>;
    const jd = typeof rowRecord.jd_text === "string" ? rowRecord.jd_text
      : typeof rowRecord.jdText === "string" ? rowRecord.jdText : undefined;
    const seal = verifyPdfArtifact(pdf, {
      sourceText: resumeSourceText(content),
      email: content.contact?.email,
      phone: content.contact?.phone,
      jd,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name.replace(/[^a-z0-9]+/gi, "_")}_resume.pdf"`,
        "X-Ats-Seal": sealHeader(seal),
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not render this PDF. Please try again." }, { status: 500 });
  }
}
