import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { hasDb, saveResume } from "@/lib/db";
import { env } from "@/lib/env";
import { saveDevResume } from "@/lib/local-dev-store";
import { atsScore } from "@/lib/ats-score";
import { rateLimit } from "@/lib/rate-limit";
import type { ResumeContent } from "@/lib/types";

export const runtime = "nodejs";

// The visual resume maker never touches the generation pipeline (no model, no
// credit), so its output has no save path — exports only. This endpoint gives
// a logged-in maker user a durable copy: same resumes table, ATS-scored by
// the same scorer the builder/checker use, no credit cost.
const Body = z.object({
  name: z.string().min(1).max(160),
  template: z.string().max(40),
  content: z.object({
    headline: z.string().max(200),
    contact: z.object({}).passthrough().optional(),
    summary: z.string().max(4000).optional(),
    skills: z.array(z.string()).max(200),
    experiences: z.array(z.object({
      title: z.string().max(200).optional(),
      company: z.string().max(200).optional(),
      period: z.string().max(80).optional(),
      location: z.string().max(200).optional(),
      bullets: z.array(z.string().max(600)).optional(),
    })),
    education: z.array(z.any()),
    projects: z.array(z.any()).optional(),
    certifications: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    achievements: z.array(z.string()).optional(),
  }),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "resume-save-manual", 20);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many saves right now. Please wait a moment." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  // String, not .flatten(): the client renders this into a <p> — an object
  // child crashes React ("Objects are not valid as a React child").
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid resume content" }, { status: 400 });

  const id = randomUUID();
  // Score with the same engine the builder/checker use so the saved row's
  // number matches what the checker would say about this content.
  const score = atsScore("", parsed.data.content as ResumeContent);
  if (env.localDevMode) {
    await saveDevResume({
      id,
      userId: user.id,
      candidateName: parsed.data.name,
      content: parsed.data.content,
      atsScore: score,
      template: parsed.data.template,
      premiumUnlock: false,
      creditUsed: false,
      jdText: "",
      companyName: null,
      roleTitle: null,
    });
    return NextResponse.json({ id, atsScore: score });
  }
  if (!hasDb()) return NextResponse.json({ error: "Could not save the resume right now." }, { status: 503 });
  const ok = await saveResume({
    id,
    content: parsed.data.content,
    atsScore: score,
    name: parsed.data.name,
    genMs: 0,
    userId: user.id,
    template: parsed.data.template,
  });
  if (!ok) return NextResponse.json({ error: "Could not save the resume right now." }, { status: 503 });
  return NextResponse.json({ id, atsScore: score });
}
