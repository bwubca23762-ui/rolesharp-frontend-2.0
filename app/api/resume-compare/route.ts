import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { matchResumeToJob, type MatchResult } from "@/lib/match-engine";
import { sameOriginRequest } from "@/lib/request-origin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  resumeA: z.string().min(80).max(30_000),
  resumeB: z.string().min(80).max(30_000),
  jdText: z.string().min(80).max(30_000),
}).strict();

// Compare two resume versions against one job description (T6). Shows which
// version fits better and what each covers that the other misses.
export async function POST(req: NextRequest) {
  if (!sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host })) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const limited = await rateLimit(req, "resume-compare", 8);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Both resumes and the job description are required (at least a few sentences each)." }, { status: 400 });

  const { resumeA, resumeB, jdText } = parsed.data;
  const resultA: MatchResult = matchResumeToJob(resumeA, jdText);
  const resultB: MatchResult = matchResumeToJob(resumeB, jdText);

  // Terms unique to each version's coverage
  const onlyInA = resultA.matched.filter((t) => !resultB.matched.includes(t));
  const onlyInB = resultB.matched.filter((t) => !resultA.matched.includes(t));
  const missingFromBoth = resultA.missing.filter((t) => resultB.missing.includes(t));

  return NextResponse.json(
    {
      a: resultA,
      b: resultB,
      winner: resultA.fitScore > resultB.fitScore ? "a" : resultB.fitScore > resultA.fitScore ? "b" : "tie",
      delta: Math.abs(resultA.fitScore - resultB.fitScore),
      onlyInA,
      onlyInB,
      missingFromBoth,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
