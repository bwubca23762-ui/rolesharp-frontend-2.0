import { NextRequest, NextResponse } from "next/server";
import { ResumeContent } from "@/lib/types";
import { renderResumePdf } from "@/lib/pdf";
import { rateLimit } from "@/lib/rate-limit";
import { currentUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlements";
import { ResumePhotoDataUrl } from "@/lib/resume-photo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "manual-pdf", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many exports" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const body = await req.json().catch(() => null);
  const parsed = ResumeContent.safeParse(body?.content);
  if (!parsed.success) return NextResponse.json({ error: "Invalid resume content" }, { status: 400 });
  const photo = ResumePhotoDataUrl.safeParse(body?.photoDataUrl);
  if (!photo.success) return NextResponse.json({ error: "Invalid resume photo" }, { status: 400 });

  const user = await currentUser();
  // Watermark-free PDF is the cleanPdf tier feature (student and paid alike).
  const features = user ? (await getEntitlement(user)).features : null;
  const watermark = !features?.cleanPdf;

  const name = String(body?.name || parsed.data.contact?.email || "resume").replace(/[^a-z0-9]+/gi, "_").slice(0, 80) || "resume";
  // Free templates only: basic, compact, minimal
  const freeTemplates = ["basic", "compact", "minimal"];
  const template = (typeof body?.template === "string" && (user?.premium || freeTemplates.includes(body.template)))
    ? body.template
    : "basic";
  const buf = await renderResumePdf(parsed.data, name, { template, watermark, photoDataUrl: photo.data });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}_resume.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
