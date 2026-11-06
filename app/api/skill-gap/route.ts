import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRoleBySlug } from "@/lib/db";
import { env } from "@/lib/env";
import { getDevRoleBySlug } from "@/lib/local-dev-store";
import { analyseSkillGap, nextSteps } from "@/lib/skill-gap";
import type { MapRole } from "@/lib/career-map";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  resumeText: z.string().min(80).max(30000),
  targetSlug: z.string().max(120),
  currentSlug: z.string().max(120).optional(),
});

async function role(slug: string): Promise<MapRole | null> {
  const row = env.localDevMode
    ? await getDevRoleBySlug(slug).catch(() => null)
    : await getRoleBySlug(slug).catch(() => null);
  return (row as MapRole | null) ?? null;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "skill-gap", 20);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  // String, not .flatten(): the client renders this into a <p> — an object
// child crashes React ("Objects are not valid as a React child").
if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  const { resumeText, targetSlug, currentSlug } = parsed.data;

  const target = await role(targetSlug);
  if (!target) return NextResponse.json({ error: "unknown_target_role" }, { status: 404 });
  // A current role that cannot be resolved degrades to "no current role" rather
  // than failing: the analysis is still useful without it, it just cannot tell
  // undocumented from unproven.
  //
  // The same role on both sides is NOT skipped. "I am a Data Analyst and I want
  // a better Data Analyst job" is a normal thing to ask, and dropping the
  // current role there labels every gap "nothing in your history points at
  // this" — the harshest and least accurate reading available, about the one
  // person we know does the job.
  const current = currentSlug ? await role(currentSlug) : null;

  const gap = analyseSkillGap(resumeText, target, current);
  return NextResponse.json(
    { ...gap, steps: nextSteps(gap) },
    // The request carries a resume. Nothing about this response is cacheable.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
