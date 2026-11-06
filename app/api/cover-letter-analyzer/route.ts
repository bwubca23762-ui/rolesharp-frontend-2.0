import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { currentUser } from "@/lib/auth";
import { analyzeCoverLetter } from "@/lib/cover-letter-analyzer";
import { getEntitlement } from "@/lib/entitlements";

export const runtime = "nodejs";

// Premium: deterministic scoring of a pasted cover letter (same engine the
// interview tools trust). No model call, nothing stored.
const Body = z.object({
  letter: z.string().min(80).max(20_000),
  targetCompany: z.string().trim().max(120).optional(),
  targetRole: z.string().trim().max(120).optional(),
});

export async function POST(req:NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "cover-analyze", 15);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  // Gate on the coverLetterAI tier feature, not raw user.premium — the
  // tier map owns this decision (lib/tier-features.ts): today both premium
  // sources carry it, tomorrow's tier change must not require a code edit here.
  const features = (await getEntitlement(user)).features;
  if (!features.coverLetterAI) return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paste your cover letter text (at least a paragraph)." }, { status: 400 });

  return NextResponse.json(analyzeCoverLetter(parsed.data.letter, {
    company: parsed.data.targetCompany,
    role: parsed.data.targetRole,
  }));
}
