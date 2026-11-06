import { getAccessToken, voiceConfigured, voiceProject } from "./gcp-auth";
import { env } from "../env";

// V-3 (VOICE-INTERVIEW-PLAN): the premium voice-answer path. ONE multimodal
// Gemini call does the transcribe-and-evaluate in a single round trip —
// audio in, structured JSON out. The deterministic evidence readout (V-1)
// still computes the score and matched/unsupported terms SERVER-SIDE from
// the transcript; this module adds the LLM-reviewed delivery coaching lines
// on top. The free tier never reaches here: browser dictation produces text
// client-side at zero cost, which is the §0b tier rule in action (free →
// last/cheapest, which for audio means no AI at all; premium → first,
// Vertex).

const ANSWER_MODEL = "gemini-2.5-flash";

export type VoiceAnswerResult = {
  transcript: string;
  llmCoaching: string[];
};

export async function evaluateVoiceAnswer(
  audioBase64: string,
  mimeType: string,
  question: string,
): Promise<VoiceAnswerResult> {
  if (!voiceConfigured()) throw new Error("voice_unconfigured");
  const token = await getAccessToken();
  if (!token) throw new Error("voice_unconfigured");
  const project = voiceProject();
  const location = env.gcpVoiceLocation;
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${ANSWER_MODEL}:generateContent`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: [
            "You are a supportive interview practice partner. The candidate answered this question by voice:",
            "",
            `QUESTION: ${question}`,
            "",
            "Your job: (1) transcribe the spoken answer faithfully, and (2) add at most two short coaching lines about DELIVERY and STRUCTURE — pacing, filler words, clarity, whether the answer opens with the point. Never suggest adding numbers, experiences, or claims the candidate did not say; never grade the person.",
            "",
            'Reply with ONLY JSON: {"transcript": "...", "coaching": ["...", "..."]}',
          ].join("\n") },
          { inlineData: { mimeType, data: audioBase64 } },
        ],
      }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`voice_answer_failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: { transcript?: string; coaching?: string[] } = {};
  try { parsed = JSON.parse(text) as { transcript?: string; coaching?: string[] }; } catch { /* lenient */ }
  const transcript = (parsed.transcript ?? "").trim();
  if (!transcript) throw new Error("voice_answer_empty");
  return {
    transcript,
    llmCoaching: (parsed.coaching ?? []).filter((line) => typeof line === "string" && line.trim()).slice(0, 2),
  };
}
