import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlements";
import { getUserResume } from "@/lib/db";
import { renderResumeDocx } from "@/lib/docx";
import { ResumeContent } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { getDevUserResume } from "@/lib/local-dev-store";
import { resumeSourceText, sealHeader, verifyDocxArtifact } from "@/lib/ats-extract";

export const runtime = "nodejs";

// Premium-only: editable Word (.docx) export. DOCX is a tier feature
// (Platform Premium only — see lib/tier-features.ts); the per-resume
// premium_unlock bypass stays available to FREE accounts that spent a credit
// on that resume. It must not re-open the door for students: every
// student-generated resume carries premium_unlock=true from the generator,
// so the bypass is deliberately scoped to non-premium accounts.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(req, "docx", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const { id } = await params;
  const r = await (env.localDevMode ? getDevUserResume(id, user.id) : getUserResume(id, user.id));
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  const features = (await getEntitlement(user)).features;
  const unlocked = "premium_unlock" in r ? r.premium_unlock : r.premiumUnlock;
  const unlockApplies = unlocked && !user.premium;
  if (!features.docxExport && !unlockApplies) return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });

  const parsed = ResumeContent.safeParse(r.content);
  if (!parsed.success) return NextResponse.json({ error: "This resume's data is invalid or outdated. Re-generate it to download." }, { status: 422 });
  const content = parsed.data;
  const name = ("candidate_name" in r ? r.candidate_name : r.candidateName) ?? content.headline ?? "Resume";
  try {
    const buf = await renderResumeDocx(content, name);
    // ATS text-layer seal, same contract as the PDF export route.
    const rowRecord = r as Record<string, unknown>;
    const jd = typeof rowRecord.jd_text === "string" ? rowRecord.jd_text
      : typeof rowRecord.jdText === "string" ? rowRecord.jdText : undefined;
    const seal = await verifyDocxArtifact(buf, {
      sourceText: resumeSourceText(content),
      email: content.contact?.email,
      phone: content.contact?.phone,
      jd,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${name.replace(/[^a-z0-9]+/gi, "_")}_resume.docx"`,
        "X-Ats-Seal": sealHeader(seal),
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not render this document. Please try again." }, { status: 500 });
  }
}
