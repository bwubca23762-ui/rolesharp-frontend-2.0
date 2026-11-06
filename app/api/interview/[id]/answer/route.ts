import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getUserResume } from "@/lib/db";
import { env } from "@/lib/env";
import { getDevUserResume } from "@/lib/local-dev-store";
import { ResumeContent } from "@/lib/types";
import {
  evidenceFor,
  consumeSessionOnce,
  getSession,
  questionsFor,
  readoutFor,
  saveSession,
  voiceGatewayFor,
  type SessionState,
} from "@/lib/interview-session";
import { evaluateVoiceAnswer } from "@/lib/voice/answer-audio";

export const runtime = "nodejs";

const Body = z.object({
  resumeId: z.string().uuid(),
  index: z.number().int().min(0),
  answer: z.string().min(1).max(4_000).optional(),
  audio: z.string().min(50).max(8_000_000).optional(),
  mimeType: z.string().regex(/^audio\//).max(60).optional(),
  durationSec: z.number().int().min(3).max(200).optional(),
});

// Submit one practice answer; get the evidence readout back.
// - Typed answer (both tiers): deterministic readout, no model call — the
//   free tier's zero-cost contract.
// - Audio answer (PREMIUM only, per the §0b tier rule — free traffic must
//   ride the last/cheapest gateway, which for audio means the browser's own
//   dictation producing text): one multimodal Gemini call transcribes and
//   adds delivery coaching. The audio lives only in this request; it is
//   never written to disk or the database, and the stored answer is the
//   transcript (user-visible, user-deletable with the resume).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "interview-answer", 30);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const { id: sessionId } = await params;
  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    // Named duration floor: the generic invalid-payload 400 left the client
    // unable to tell a misclick recording (too short) from a malformed body.
    if (parsed.error.issues.some((issue) => issue.path[0] === "durationSec" && issue.code === "too_small")) {
      return NextResponse.json(
        { error: "audio_too_short", message: "Recording must be at least 3 seconds long." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid answer payload" }, { status: 400 });
  }
  const { resumeId, index, answer, audio, mimeType, durationSec } = parsed.data;
  if (!answer && !audio) return NextResponse.json({ error: "Missing answer" }, { status: 400 });

  const r = await (env.localDevMode ? getDevUserResume(resumeId, user.id) : getUserResume(resumeId, user.id));
  if (!r) return NextResponse.json({ error: "resume not found" }, { status: 404 });
  const parsedContent = ResumeContent.safeParse(r.content);
  if (!parsedContent.success) return NextResponse.json({ error: "resume_invalid" }, { status: 422 });

  const session: SessionState | null = await getSession(user.id, sessionId);
  if (!session || session.resumeId !== resumeId) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  if (index < 0 || index >= session.questionCount) return NextResponse.json({ error: "question_out_of_range" }, { status: 400 });

  if (audio) {
    // Tier gate: voice-answer AI is premium. The gateway rule this encodes
    // (voiceGatewayFor) is pinned in tests; free users' browsers do the
    // transcription themselves (dictation) and send text.
    if (session.tier !== "premium") {
      return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });
    }
    if (!mimeType) return NextResponse.json({ error: "Missing answer" }, { status: 400 });
  }

  const { questions, star } = questionsFor(parsedContent.data, session.tier);
  const question = questions[index];
  if (!question) return NextResponse.json({ error: "question_out_of_range" }, { status: 400 });

  const evidence = evidenceFor(parsedContent.data, questions);
  let submitted = answer ?? "";
  let llmCoaching: string[] = [];
  let transcript = "";

  if (audio && mimeType) {
    try {
      const evaluated = await evaluateVoiceAnswer(audio, mimeType, question);
      transcript = evaluated.transcript;
      submitted = transcript;
      llmCoaching = evaluated.llmCoaching;
    } catch (error) {
      const message = error instanceof Error ? error.message : "voice_answer_failed";
      if (message === "voice_unconfigured") return NextResponse.json({ error: "voice_unconfigured" }, { status: 503 });
      return NextResponse.json({ error: "voice_answer_failed" }, { status: 502 });
    }
  }

  // The free monthly session burns HERE — on the first answer actually
  // submitted — not at question retrieval. Idempotent per sessionId, so a
  // retried or double-clicked answer never double-charges.
  const consumption = await consumeSessionOnce(user.id, sessionId, session.tier);
  if (consumption === "limit_reached") {
    return NextResponse.json({ error: "limit_reached", upgrade: true }, { status: 402 });
  }

  const readout = readoutFor(question, submitted, evidence, durationSec);

  const answered = new Set(session.answers.map((a) => a.index));
  answered.add(index);
  session.answers = [
    ...session.answers.filter((a) => a.index !== index),
    { index, answer: submitted, at: new Date().toISOString() },
  ];
  await saveSession(user.id, session);

  const nextIndex = Array.from({ length: session.questionCount }, (_, i) => i)
    .find((i) => i > index && !answered.has(i)) ?? -1;
  const starEntry = star.find((entry) => entry.question === question) ?? null;
  return NextResponse.json({
    readout,
    llmCoaching,
    transcript,
    voiceGateway: audio ? voiceGatewayFor(session.tier) : undefined,
    starEntry,
    answeredCount: answered.size,
    questionCount: session.questionCount,
    nextIndex,
    done: nextIndex === -1,
  });
}
