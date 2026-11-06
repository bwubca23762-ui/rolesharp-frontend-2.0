import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { humanizeResumeText, scoreHumanAuthenticity } from "@/lib/ai-humanizer";

export const runtime = "nodejs";

// The deterministic De-AI endpoint behind the /ai-humanizer studio. Text in,
// cleaned text out with full before/after telemetry — the same pure functions
// the /build pipeline runs on generated output and the Bot-Stealth badge uses
// for its score, so all three surfaces can never disagree.

const Body = z.object({
  text: z.string().min(40, "Paste at least a few lines of resume text.").max(40_000),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "tools-humanize", 30);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the text and try again." }, { status: 400 });
  }

  const before = scoreHumanAuthenticity(parsed.data.text);
  const result = humanizeResumeText(parsed.data.text);
  const after = scoreHumanAuthenticity(result.text);

  return NextResponse.json({
    before,
    after,
    result: { text: result.text, counts: result.counts },
    diff: result.diff,
  });
}
