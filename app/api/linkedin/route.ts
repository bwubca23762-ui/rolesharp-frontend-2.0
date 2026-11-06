import { NextRequest, NextResponse } from "next/server";
import { getUserResume, q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { chat } from "@/lib/llm";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { getDevUserResume, updateDevResume } from "@/lib/local-dev-store";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({ resumeId: z.string().uuid() });

// Premium-only: LinkedIn "About" section from the resume (Claude).
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "linkedin", 10);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid resume ID" }, { status: 400 });
  const { resumeId } = parsed.data;
  const r = await (env.localDevMode ? getDevUserResume(resumeId, user.id) : getUserResume(resumeId, user.id));
  if (!r) return NextResponse.json({ error: "resume not found" }, { status: 404 });
  const unlocked = "premium_unlock" in r ? r.premium_unlock : r.premiumUnlock;
  const linkedin = "linkedin" in r ? r.linkedin : r.linkedin;
  if (!user.premium && !unlocked) return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });
  if (linkedin) return NextResponse.json({ linkedin });
  if (env.localDevMode) {
    const text = `I build practical, ATS-friendly application materials and translate complex work into clear outcomes. My background covers ${r.content?.skills?.slice(0, 6).join(", ") || "relevant professional skills"}, and I enjoy improving systems, collaborating well, and delivering measurable results.`;
    await updateDevResume(resumeId, { linkedin: text });
    return NextResponse.json({ linkedin: text });
  }

  try {
    const raw = await chat(
      [
        { role: "system", content: "Write a compelling first-person LinkedIn 'About' section (120-180 words) from this resume. Engaging, keyword-rich, plain text." },
        { role: "user", content: `RESUME:\n${JSON.stringify(r.content)}` },
      ],
      { temperature: 0.6, model: "claude" },
    );
    // Cap stored output — a ~180-word About is <1.5K chars; anything larger is
    // model runaway or injected padding and shouldn't bloat the row.
    const text = String(raw || "").trim().slice(0, 2000);
    if (!text) return NextResponse.json({ error: "The AI is busy right now. Please try again in a moment." }, { status: 502 });
    await q("update resumes set linkedin=$1 where id=$2 and user_id_text=$3", [text, resumeId, user.id]);
    return NextResponse.json({ linkedin: text });
  } catch {
    return NextResponse.json({ error: "The AI is busy right now. Please try again in a moment." }, { status: 502 });
  }
}
