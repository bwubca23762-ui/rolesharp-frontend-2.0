import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getUserResume } from "@/lib/db";
import { ResumeContent } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { getDevUserResume } from "@/lib/local-dev-store";
import { resumeSourceText } from "@/lib/ats-extract";

export const runtime = "nodejs";

// Plain-text export: for job portals that only accept pasted text (no file
// upload). Free for every tier — the text is what ATS systems read anyway,
// and gating paste-text would just push users to copy it by hand from the
// PDF. Single-column, no tables, exactly what a parser wants to see.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(req, "txt-export", 30);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { id } = await params;
  const r = await (env.localDevMode ? getDevUserResume(id, user.id) : getUserResume(id, user.id));
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const parsed = ResumeContent.safeParse(r.content);
  if (!parsed.success) return NextResponse.json({ error: "This resume's data is invalid or outdated. Re-generate it to export." }, { status: 422, headers: { "Cache-Control": "private, no-store" } });
  const name = ("candidate_name" in r ? r.candidate_name : r.candidateName) ?? parsed.data.headline ?? "resume";
  const text = resumeSourceText(parsed.data);
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name.replace(/[^a-z0-9]+/gi, "_")}_resume.txt"`,
      "Cache-Control": "private, no-store",
    },
  });
}
