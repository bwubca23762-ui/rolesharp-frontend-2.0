import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";
import { getAccessToken, voiceConfigured, voiceProject } from "./gcp-auth";

// Question audio (VOICE-INTERVIEW-PLAN V-2). Our interview questions are
// deterministic per resume+role, so synthesized audio is cached by content
// hash on disk and amortizes to ~zero for repeats — the number that makes the
// free tier's cached-TTS-only rule affordable. Gemini TTS on Vertex returns
// raw PCM (L16); we wrap a 44-byte WAV header so browsers can play it
// directly, no audio dependency added.

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_VOICE = "Kore";
export const SAMPLE_RATE = 24_000;

// Panel simulator (Phase 4): three interviewer personas at different
// altitudes. One prebuilt Gemini voice each — the content-hash cache is
// already namespaced per voice (questionCacheKey hashes voice::text), so a
// persona's questions amortize to disk reads exactly like the single-voice
// questions did. Free tier stays cached-TTS-only; personas add no model call.
export type InterviewPersona = {
  id: string;
  name: string;
  voice: string;
  altitude: "screening" | "probe" | "strategic";
  /** Delivery instruction prepended to the question text at synthesis time. */
  stylePrompt: string;
};

export const INTERVIEW_PERSONAS: readonly InterviewPersona[] = [
  {
    id: "recruiter",
    name: "The screener",
    voice: "Aoede",
    altitude: "screening",
    stylePrompt: "Read this interview question warmly and briskly, like a friendly recruiter doing a first screen:",
  },
  {
    id: "hiring_manager",
    name: "The hiring manager",
    voice: "Charon",
    altitude: "probe",
    stylePrompt: "Read this interview question in a steady, skeptical tone, like a hiring manager digging into the details:",
  },
  {
    id: "executive",
    name: "The executive",
    voice: "Puck",
    altitude: "strategic",
    stylePrompt: "Read this interview question with calm authority, like a senior executive thinking about outcomes:",
  },
];

export function personaFor(id: string): InterviewPersona | null {
  return INTERVIEW_PERSONAS.find((persona) => persona.id === id) ?? null;
}

export function questionCacheKey(text: string, voice = TTS_VOICE): string {
  return createHash("sha256").update(`${voice}::${text}`).digest("hex").slice(0, 40);
}

export function cachePath(key: string): string {
  // Voice cache lives next to the app data; the VPS layout already treats
  // this directory as disposable-per-deploy state that can be regenerated.
  return path.join(process.cwd(), "data", "voice-cache", `${key}.wav`);
}

// 44-byte canonical PCM WAV header: RIFF/WAVE, fmt (PCM, mono, 16-bit),
// data chunk sized to the payload.
export function wavHeader(pcmLength: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcmLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcmLength, 40);
  return header;
}

export function pcmToWav(pcm: Buffer): Buffer {
  return Buffer.concat([wavHeader(pcm.length), pcm]);
}

export async function cachedQuestionAudio(
  text: string,
  voice = TTS_VOICE,
  stylePrompt?: string,
): Promise<{ file: string; cached: boolean } | null> {
  const key = questionCacheKey(text, voice);
  const file = cachePath(key);
  try {
    await readFile(file);
    return { file, cached: true };
  } catch {
    // not cached — synthesize below
  }
  if (!voiceConfigured()) return null;
  const audio = await synthesizeSpeech(text, voice, stylePrompt);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, audio);
  return { file, cached: false };
}

export async function synthesizeSpeech(
  text: string,
  voice = TTS_VOICE,
  stylePrompt?: string,
): Promise<Buffer> {
  const token = await getAccessToken();
  if (!token) throw new Error("voice_unconfigured");
  const project = voiceProject();
  const location = env.gcpVoiceLocation;
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${TTS_MODEL}:generateContent`;
  const instruction = stylePrompt ?? "Read this interview question warmly and clearly:";
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${instruction} ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`tts_failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) throw new Error("tts_empty_response");
  const pcm = Buffer.from(inline.data, "base64");
  return pcmToWav(pcm);
}
