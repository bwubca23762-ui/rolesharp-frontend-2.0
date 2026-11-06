import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getUserResume } from "@/lib/db";
import { getDevUserResume } from "@/lib/local-dev-store";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { ResumeContent } from "@/lib/types";
import { battlecardFor } from "@/lib/interview-cheatsheet";

export const runtime = "nodejs";

const Body = z.object({ resumeId: z.string().uuid() });

// Interview battlecard (Phase 4): deterministic per resume, no model call on
// any tier. Login + ownership mirror /api/interview; every line on the card
// traces back to the stored resume content.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "interview-cheatsheet", 20);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const r = await (env.localDevMode
    ? getDevUserResume(parsed.data.resumeId, user.id)
    : getUserResume(parsed.data.resumeId, user.id));
  if (!r) return NextResponse.json({ error: "resume not found" }, { status: 404 });
  const parsedContent = ResumeContent.safeParse(r.content);
  if (!parsedContent.success) return NextResponse.json({ error: "resume_invalid" }, { status: 422 });

  return NextResponse.json({ battlecard: battlecardFor(parsedContent.data) });
}
