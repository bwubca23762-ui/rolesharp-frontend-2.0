import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { cachedQuestionAudio, personaFor, questionCacheKey } from "@/lib/voice/tts";
import { voiceConfigured } from "@/lib/voice/gcp-auth";

export const runtime = "nodejs";

const Body = z.object({ text: z.string().min(1).max(600), persona: z.string().max(40).optional() });

// Question audio (V-2). Login-required and rate-limited; the audio is cached
// by content hash, so the free tier's cached-TTS rule holds — repeats cost
// disk reads, not credits. The text must be the deterministic interview
// question the client already received; the cache key pins exactly what was
// synthesized.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "interview-tts", 30);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid text" }, { status: 400 });

  if (!env.gcpVoiceEnabled || !voiceConfigured()) {
    return NextResponse.json({ error: "voice_unconfigured" }, { status: 503 });
  }

  // An unknown persona id falls back to the default voice — the panel UI is
  // the only caller that sends this, and a stale client must still get audio.
  const persona = parsed.data.persona ? personaFor(parsed.data.persona) : null;

  const key = questionCacheKey(parsed.data.text, persona?.voice);
  try {
    const result = await cachedQuestionAudio(parsed.data.text, persona?.voice, persona?.stylePrompt);
    if (!result) return NextResponse.json({ error: "voice_unconfigured" }, { status: 503 });
    const audio = await readFile(result.file);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=86400",
        "X-Voice-Cache": result.cached ? "hit" : "miss",
        "X-Voice-Key": key,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "tts_failed";
    // Surface synthesis failures as 502 with a stable code prefix so the
    // client shows a plain "audio unavailable" line, never a broken player.
    return NextResponse.json({ error: message.startsWith("tts_failed") || message.startsWith("gcp_") ? "tts_failed" : "tts_failed", detail: message.slice(0, 120) }, { status: 502 });
  }
}
