import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { currentUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlements";
import { renderDocumentPdf } from "@/lib/document-pdf";
import { sealHeader, verifyPdfArtifact } from "@/lib/ats-extract";

export const runtime = "nodejs";

// Premium: download a generator's output as a clean, watermark-free PDF.
// Gated on the cleanPdf tier feature rather than raw user.premium so the
// route and the feature map answer identically by construction.
const Body = z.object({
  title: z.string().min(1).max(120),
  text: z.string().min(1).max(20_000),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "doc-export", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const user = await currentUser();
  const features = user ? (await getEntitlement(user)).features : null;
  if (!features?.cleanPdf) {
    // Same uniform contract as every other gated surface.
    return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid document content" }, { status: 400 });

  const name = parsed.data.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 80) || "document";
  const buf = await renderDocumentPdf(parsed.data.title, parsed.data.text);
  // ATS text-layer seal: report what a parser sees in the rendered bytes.
  const seal = verifyPdfArtifact(buf, { sourceText: `${parsed.data.title}\n${parsed.data.text}` });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "no-store",
      "X-Ats-Seal": sealHeader(seal),
    },
  });
}
