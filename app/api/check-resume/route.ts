import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRoleBySlug, searchRoles } from "@/lib/db";
import { checkResume } from "@/lib/resume-checker";
import { recruiterFeedback } from "@/lib/recruiter-feedback";
import { rateLimit } from "@/lib/rate-limit";
import { COMPANY_TYPE_KEYS } from "@/lib/resume-guidance";
import { historyUserIdFromRequest, recordToolRun } from "@/lib/tool-runs-server";

export const runtime = "nodejs";

const Body = z.object({
  resumeText: z.string().min(80).max(30000),
  targetRole: z.string().max(160).optional(),
  targetCompany: z.string().max(160).optional(),
  roleSlug: z.string().max(120).optional(),
  jdText: z.string().max(20000).optional(),
  country: z.string().max(80).optional(),
  companyType: z.enum(COMPANY_TYPE_KEYS).optional(),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "check", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  // String, not .flatten(): the client renders this into a <p> — an object
// child crashes React ("Objects are not valid as a React child").
if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  const data = parsed.data;
  // Resolve the role norm even from a typed title (the fixer never sends a
  // slug) so role required_skills feed the keyword scoring, same as generate.
  let role = data.roleSlug ? await getRoleBySlug(data.roleSlug).catch(() => null) : null;
  if (!role && data.targetRole && data.targetRole.trim().length >= 2) {
    try {
      const matches = await searchRoles(data.targetRole.trim(), 3);
      const wanted = data.targetRole.trim().toLowerCase();
      const hit = matches.find((m) => m.title.toLowerCase() === wanted)
        ?? matches.find((m) => m.title.toLowerCase().includes(wanted));
      if (hit) role = await getRoleBySlug(hit.slug).catch(() => null);
    } catch {}
  }
  const result = checkResume({
    resumeText: data.resumeText,
    targetRole: data.targetRole || role?.title,
    targetCompany: data.targetCompany,
    jdText: data.jdText,
    country: data.country,
    roleSkills: role?.required_skills ?? [],
    preferredRoleSkills: role?.preferred_skills ?? [],
    companyType: data.companyType,
  });
  // The same analysis, said the way a recruiter would say it. Derived here so
  // every caller of the checker gets it without asking for it separately.
  // Premium history: record the run for accounts whose tier carries
  // toolHistory. Fire-and-forget — history never blocks or fails a check.
  const historyUserId = await historyUserIdFromRequest();
  if (historyUserId) {
    recordToolRun(historyUserId, "ats_check", { score: result.score, summary: data.targetRole || role?.title || null });
  }
  return NextResponse.json({ ...result, recruiter: recruiterFeedback(data.resumeText, result) });
}
