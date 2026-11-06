import { NextRequest, NextResponse } from "next/server";
import { getUserResume, q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { getDevUserResume, updateDevResume } from "@/lib/local-dev-store";
import { z } from "zod";
import { ResumeContent } from "@/lib/types";
import { buildEvidenceCoverLetterWithTone } from "@/lib/evidence-content";

export const runtime = "nodejs";

const Body = z.object({
  resumeId: z.string().uuid(),
  // Optional target override: lets the user tailor the letter to a different
  // company/role than the resume was originally built for.
  company: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  // Premium feature: warm and direct re-voice the same evidence for a
  // different audience. Formal is always available.
  tone: z.enum(["formal", "warm", "direct"]).default("formal"),
});

// Premium-only cover letter, assembled deterministically from the saved resume
// by buildEvidenceCoverLetter. NO model call, and no job description: the body
// schema accepts resumeId plus an optional company/role only. This comment used
// to claim "AI cover letter from the resume + JD (uses Claude)", which is not
// what the code does — see the copy on /cover-letter-generator, which still
// makes the same claim to paying users.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "cover", 10);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid resume ID" }, { status: 400 });
  const { resumeId, company, role } = parsed.data;
  const tone = parsed.data.tone;
  // Tone gating: formal is the base letter every premium user gets; warm and
  // direct are the paid differentiator. Free users never reach this route at
  // all, so the check only needs to distinguish within premium.
  if ((tone === "warm" || tone === "direct") && !user.premium) {
    return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });
  }
  const r = await (env.localDevMode ? getDevUserResume(resumeId, user.id) : getUserResume(resumeId, user.id));
  if (!r) return NextResponse.json({ error: "resume not found" }, { status: 404 });
  const unlocked = "premium_unlock" in r ? r.premium_unlock : r.premiumUnlock;
  const coverLetter = "cover_letter" in r ? r.cover_letter : r.coverLetter;
  if (!user.premium && !unlocked) return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });
  // A saved letter is the memoized default-target result. An explicit target
  // override must regenerate — returning the cached letter would silently
  // ignore the company/role the user just typed. Same logic for tone: a saved
  // letter is always the formal one.
  if (coverLetter && !company && !role && tone === "formal") return NextResponse.json({ coverLetter });
  const parsedContent = ResumeContent.safeParse(r.content);
  if (!parsedContent.success) return NextResponse.json({ error: "resume_invalid" }, { status: 422 });
  const candidateName = (("candidate_name" in r ? r.candidate_name : r.candidateName) as string | null) || "Candidate";
  const text = buildEvidenceCoverLetterWithTone(parsedContent.data, candidateName, { company, role }, tone);
  if (env.localDevMode) {
    await updateDevResume(resumeId, { coverLetter: text });
    return NextResponse.json({ coverLetter: text });
  }
  await q("update resumes set cover_letter=$1 where id=$2 and user_id_text=$3", [text, resumeId, user.id]);
  return NextResponse.json({ coverLetter: text });
}
