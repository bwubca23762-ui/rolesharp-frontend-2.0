import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { currentUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlements";
import { renderDocumentDocx } from "@/lib/document-docx";
import { sealHeader, verifyDocxArtifact } from "@/lib/ats-extract";

export const runtime = "nodejs";

// Platform Premium: download a generator's output as an editable Word file —
// the DOCX twin of /api/tools/export-pdf. Gated on the docxExport tier
// feature rather than raw user.premium: students are premium but deliberately
// carry docxExport: false (lib/tier-features.ts), and premium_until is
// source-blind so it cannot tell them apart.
const Body = z.object({
  title: z.string().min(1).max(120),
  text: z.string().min(1).max(20_000),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "docx-export", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const user = await currentUser();
  const features = user ? (await getEntitlement(user)).features : null;
  if (!features?.docxExport) {
    // Same uniform contract as every other gated surface.
    return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid document content" }, { status: 400 });

  const name = parsed.data.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 80) || "document";
  const buf = await renderDocumentDocx(parsed.data.title, parsed.data.text);
  // ATS text-layer seal, same contract as the PDF export route.
  const seal = await verifyDocxArtifact(buf, { sourceText: `${parsed.data.title}\n${parsed.data.text}` });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}.docx"`,
      "Cache-Control": "no-store",
      "X-Ats-Seal": sealHeader(seal),
    },
  });
}
