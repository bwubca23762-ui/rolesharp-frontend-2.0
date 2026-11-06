import { NextRequest, NextResponse } from "next/server";
import { ResumeContent } from "@/lib/types";
import { renderResumeDocx } from "@/lib/docx";
import { rateLimit } from "@/lib/rate-limit";
import { currentUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlements";
import { ResumePhotoDataUrl } from "@/lib/resume-photo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "manual-docx", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many exports" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  // DOCX is a tier feature (Platform Premium only — students deliberately
  // excluded, see lib/tier-features.ts), not a synonym for user.premium:
  // premium_until is source-blind, so gating on it handed students a feature
  // their tier does not carry.
  const features = (await getEntitlement(user)).features;
  if (!features.docxExport) return NextResponse.json({ error: "premium_required" }, { status: 402 });

  const body = await req.json().catch(() => null);
  const parsed = ResumeContent.safeParse(body?.content);
  if (!parsed.success) return NextResponse.json({ error: "Invalid resume content" }, { status: 400 });
  const photo = ResumePhotoDataUrl.safeParse(body?.photoDataUrl);
  if (!photo.success) return NextResponse.json({ error: "Invalid resume photo" }, { status: 400 });

  const name = String(body?.name || parsed.data.contact?.email || "resume").replace(/[^a-z0-9]+/gi, "_").slice(0, 80) || "resume";
  const buf = await renderResumeDocx(parsed.data, name, { photoDataUrl: photo.data });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}_resume.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
