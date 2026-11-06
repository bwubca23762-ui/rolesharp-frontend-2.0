import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { matchResumeToJob } from "@/lib/match-engine";
import { sameOriginRequest } from "@/lib/request-origin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  resumeText: z.string().min(80).max(30_000),
  jdText: z.string().min(80).max(30_000),
}).strict();

// Free, no login — the proven funnel pattern (micro-generators). Rate limited
// per IP because the regex passes over 30k+30k chars are not free.
export async function POST(req: NextRequest) {
  if (!sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host })) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const limited = await rateLimit(req, "resume-match", 10);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Wait a moment." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paste your resume text and the full job description (at least a few sentences each)." }, { status: 400 });

  const result = matchResumeToJob(parsed.data.resumeText, parsed.data.jdText);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
