"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui/primitives";
import type { StarEntry } from "@/lib/interview-star";
import type { Readout } from "@/lib/interview-session";

// Interactive practice (VOICE-INTERVIEW-PLAN V-1): one question at a time,
// typed answers, deterministic readouts. Voice rides this exact flow in
// V-2/V-3 — the turn shape, the double-fire guard, and the readout card are
// the contract the audio layer inherits.
type AnswerResponse = {
  readout: Readout;
  llmCoaching?: string[];
  transcript?: string;
  voiceGateway?: "first" | "last";
  starEntry: StarEntry | null;
  answeredCount: number;
  questionCount: number;
  nextIndex: number;
  done: boolean;
};

export default function PracticeSession({
  resumeId,
  sessionId,
  tier,
  questions,
  star,
}: {
  resumeId: string;
  sessionId: string;
  tier: "free" | "premium";
  questions: string[];
  star: StarEntry[];
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [readouts, setReadouts] = useState<Record<number, { readout: Readout; starEntry: StarEntry | null }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // Question audio (V-2): the server caches by content hash, so replaying a
  // question costs a disk read, not credits. One element reused per session.
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  // Voice answers (V-3, premium): MediaRecorder → one multimodal call that
  // transcribes and adds delivery coaching. Safari (no MediaRecorder mime
  // support) hides the mic and keeps the typed path.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRequestedRef = useRef(false);
  const recordStartRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const [micSupported, setMicSupported] = useState(true);
  const chunksRef = useRef<Blob[]>([]);

  // Live elapsed-seconds readout while recording. The 3-second floor is
  // enforced on submit; this makes the floor visible so a misclick is
  // self-evident before the user even stops.
  useEffect(() => {
    if (!recording) return;
    const startedAt = Date.now() - recordSeconds * 1000;
    const timer = setInterval(() => {
      setRecordSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
    // recordSeconds intentionally excluded: capture the start offset once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    const active = recorderRef.current;
    if (active && active.state !== "inactive") {
      active.onstop = null;
      active.ondataavailable = null;
      active.stop();
    }
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
  }, []);

  async function startRecording() {
    if (recording || busy) return;
    setVoiceNote("");
    let stream: MediaStream | null = null;
    try {
      const activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream = activeStream;
      if (typeof MediaRecorder === "undefined") throw new Error("recorder_unavailable");
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(activeStream, { mimeType: mime });
      streamRef.current = activeStream;
      recorderRef.current = rec;
      stopRequestedRef.current = false;
      chunksRef.current = [];
      rec.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      rec.onstop = () => {
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
        for (const track of activeStream.getTracks()) track.stop();
        streamRef.current = null;
        setRecording(false);
        if (stopRequestedRef.current) void submitAudio(rec.mimeType);
      };
      rec.start();
      recordStartRef.current = Date.now();
      setRecordSeconds(0);
      setRecording(true);
      // Hard 3-minute cap per answer — the plan's discipline against a
      // runaway mic and an oversized upload.
      recordingTimerRef.current = setTimeout(() => stopRecording(rec), 180_000);
    } catch {
      for (const track of stream?.getTracks() ?? []) track.stop();
      setMicSupported(false);
      setVoiceNote("Microphone unavailable — type your answer instead.");
    }
  }

  function stopRecording(rec = recorderRef.current) {
    if (!rec || rec.state === "inactive") return;
    stopRequestedRef.current = true;
    setRecording(false);
    rec.stop();
  }

  async function submitAudio(mimeType: string) {
    if (transcribing) return;
    // Client-side duration floor: a tap-tap-submit "answer" is a misclick,
    // not an attempt — tell the user instead of burning the API call on a
    // clip the server would reject anyway.
    const durationSec = Math.round((Date.now() - recordStartRef.current) / 1000);
    if (durationSec < 3) {
      recorderRef.current = null;
      chunksRef.current = [];
      setVoiceNote("Recording was under 3 seconds. Please answer with at least one complete sentence.");
      return;
    }
    // Both flags gate the typed path too: without setBusy, the "Get my
    // readout" button stayed live mid-transcription and a second submit rode
    // the same sessionId concurrently.
    setTranscribing(true);
    setBusy(true);
    setError("");
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("read_failed"));
        reader.readAsDataURL(blob);
      });
      const response = await fetch(`/api/interview/${encodeURIComponent(sessionId)}/answer`, {
        signal: AbortSignal.timeout(90_000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId, index, audio: audioBase64, mimeType,
          durationSec,
        }),
      });
      const data = await response.json().catch(() => ({})) as AnswerResponse & { error?: string; message?: string };
      if (response.status === 402) { setVoiceNote("Voice answers are Premium — type your answer instead."); return; }
      if (response.status === 400 && data.error === "audio_too_short") {
        setVoiceNote(data.message ?? "Recording must be at least 3 seconds long.");
        return;
      }
      if (response.status === 503 && data.error === "voice_unconfigured") {
        setMicSupported(false);
        setVoiceNote("Voice coaching is not configured right now. Type your answer instead.");
        return;
      }
      if (response.status === 502 && data.error === "voice_answer_failed") {
        setVoiceNote("Voice coaching could not process this recording. Try again or type your answer.");
        return;
      }
      if (!response.ok || data.error) {
        setError(data.error === "session_not_found" ? "This practice session expired. Generate the questions again." : "Could not process that recording. Try again or type your answer.");
        return;
      }
      applyAnswer(data);
      if (data.transcript) setVoiceNote(`Heard: “${data.transcript.slice(0, 200)}${data.transcript.length > 200 ? "..." : ""}”`);
    } catch {
      setVoiceNote("Recording failed. Type your answer instead.");
    } finally {
      setTranscribing(false);
      setBusy(false);
      recorderRef.current = null;
      chunksRef.current = [];
    }
  }

  async function playQuestion() {
    if (audioBusy || !question) return;
    setAudioBusy(true);
    try {
      const response = await fetch("/api/interview/tts", {
        signal: AbortSignal.timeout(50_000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question }),
      });
      if (response.status === 503) { setAudioUnavailable(true); return; }
      if (!response.ok) { setAudioUnavailable(true); return; }
      const blob = await response.blob();
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = URL.createObjectURL(blob);
      const audio = new Audio(audioUrlRef.current);
      audioRef.current = audio;
      await audio.play();
    } catch {
      setAudioUnavailable(true);
    } finally {
      setAudioBusy(false);
    }
  }

  const answeredCount = Object.keys(readouts).length;
  const question = questions[index];

  async function submit() {
    if (busy || !answer.trim() || !question) return; // one submit in flight
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/interview/${encodeURIComponent(sessionId)}/answer`, {
        signal: AbortSignal.timeout(30_000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, index, answer: answer.trim() }),
      });
      const data = await response.json().catch(() => ({})) as AnswerResponse & { error?: string };
      if (response.status === 402 && data.error === "limit_reached") {
        setError("Your free practice session for this month has been used. Start a full session with a credit or try again next month.");
        return;
      }
      if (!response.ok || data.error) {
        setError(data.error === "session_not_found" ? "This practice session expired. Generate the questions again." : "Could not record that answer. Try again.");
        return;
      }
      applyAnswer(data);
      setAnswer("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function applyAnswer(data: AnswerResponse) {
    setReadouts((prev) => ({ ...prev, [index]: { readout: data.readout, starEntry: data.starEntry } }));
    if (data.llmCoaching?.length) {
      setReadouts((prev) => ({ ...prev, [index]: { readout: { ...data.readout, coaching: [...data.readout.coaching, ...data.llmCoaching!] }, starEntry: data.starEntry } }));
    }
  }

  function reanswerCurrent() {
    setReadouts((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
    setAnswer("");
    setVoiceNote("");
  }

  if (done) {
    const scores = Object.values(readouts).map((r) => r.readout.score);
    const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return (
      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 dark:border-[var(--color-dark-border)]">
        <h3 className="m-0 text-base font-bold! text-[var(--color-text)]">Practice complete — {answeredCount}/{questions.length} answered</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
          Average evidence match: <strong>{average}%</strong>. This is a rehearsal score against your own resume — not a prediction of any interviewer&rsquo;s decision.
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[var(--color-text)]">
          {Object.entries(readouts).flatMap(([questionIndex, entry]) =>
            entry.readout.coaching.slice(0, 1).map((line, i) => <li key={`${questionIndex}-${i}`}>Q{Number(questionIndex) + 1}: {line}</li>),
          )}
        </ul>
        {tier === "free" && (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            Premium unlocks the full question set and recorded voice answers with coaching.
          </p>
        )}
        <Button variant="outline" size="compact" className="mt-4" onClick={() => { setDone(false); setIndex(0); setReadouts({}); setAnswer(""); }}>
          Restart practice
        </Button>
      </div>
    );
  }

  const entry = readouts[index];
  const starHint = star.find((s) => s.question === question) ?? null;

  return (
    <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 dark:border-[var(--color-dark-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[0.7rem] font-bold! uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          Practice · question {index + 1} of {questions.length} · {tier === "free" ? "free session" : "premium"}
        </p>
        <p className="m-0 text-xs text-[var(--color-text-muted)]">{answeredCount} answered</p>
      </div>
      <h3 className="mt-3 mb-0 text-lg font-bold! text-[var(--color-text)]">{question}</h3>
      {!audioUnavailable ? (
        <Button variant="ghost" size="compact" className="mt-2" onClick={() => void playQuestion()} disabled={audioBusy} isLoading={audioBusy}>
          {audioBusy ? "Loading audio…" : "▶ Hear the question"}
        </Button>
      ) : (
        <p className="mt-2 mb-0 text-xs text-[var(--color-text-muted)]">Audio isn't available right now — read the question instead.</p>
      )}

      {starHint && (
        <details className="mt-3 text-sm text-[var(--color-text-muted)]">
          <summary className="cursor-pointer font-semibold">Your evidence for this question (STAR)</summary>
          <p className="mt-2 mb-0 leading-6">{starHint.situation} {starHint.action} {starHint.resultPrompt}</p>
        </details>
      )}

      {entry ? (
        <div className="mt-4" role="status">
          <p className="m-0 text-sm font-semibold text-[var(--color-text)]">
            Evidence match: {entry.readout.score}%{entry.readout.wordsPerMinute !== undefined && <> · {entry.readout.wordsPerMinute} WPM</>}
            {entry.readout.fillerCount > 0 && <> · {entry.readout.fillerCount} filler{entry.readout.fillerCount === 1 ? "" : "s"}</>}
          </p>
          {entry.readout.evidenceMatched.length > 0 && (
            <p className="mt-2 mb-0 text-sm leading-6 text-[var(--color-text-muted)]">
              Grounded in your resume: {entry.readout.evidenceMatched.join(", ")}.
            </p>
          )}
          {entry.readout.unsupported.length > 0 && (
            <p className="mt-1 mb-0 text-sm leading-6 text-[var(--color-text-muted)]">
              No support for these in your resume: {entry.readout.unsupported.join(", ")} — add evidence or be ready to bridge honestly.
            </p>
          )}
          <ul className="mt-2 mb-0 list-disc pl-5 text-sm leading-6 text-[var(--color-text)]">
            {entry.readout.coaching.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {index + 1 < questions.length && (
              <Button size="compact" onClick={() => { setIndex(index + 1); setAnswer(""); setVoiceNote(""); }}>Next question</Button>
            )}
            {index + 1 === questions.length && (
              <Button size="compact" onClick={() => setDone(true)}>Finish practice</Button>
            )}
            <Button variant="outline" size="compact" onClick={reanswerCurrent}>Re-answer</Button>
          </div>
        </div>
      ) : (
        <>
          <label className="label mt-4" htmlFor={`pv-answer-${index}`}>Your answer</label>
          <textarea
            id={`pv-answer-${index}`}
            className="field"
            rows={5}
            value={answer}
            maxLength={4_000}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Answer as you would out loud: context, what you did, the result."
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={() => void submit()} disabled={busy || transcribing || recording || !answer.trim()} isLoading={busy}>
              {busy ? "Reading your answer..." : "Get my readout"}
            </Button>
            {micSupported && !recording && !transcribing && (tier === "premium" ? (
              <Button variant="outline" onClick={() => void startRecording()} disabled={busy}>🎤 Answer by voice</Button>
            ) : (
              /* Hidden mics teach nothing: free users see the feature exists,
                 gated with the same pattern as the maker's DOCX upsell. */
              <Button
                variant="outline"
                disabled
                title="Voice answers are a Premium feature — upgrade to record your answer and get AI delivery coaching"
              >
                🎤 Answer by voice <span className="ml-1 text-xs font-bold text-[var(--color-primary)]">(Premium)</span>
              </Button>
            ))}
            {recording && (
              <Button variant="danger" onClick={() => stopRecording()}>■ Stop &amp; submit</Button>
            )}
            {transcribing && (
              <span className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-2" role="status">
                <span className="spinner" aria-hidden="true" /> Listening…
              </span>
            )}
            {index + 1 < questions.length && (
              <Button variant="ghost" size="compact" onClick={() => { setIndex(index + 1); setAnswer(""); setVoiceNote(""); }} disabled={busy || recording || transcribing}>
                Skip
              </Button>
            )}
          </div>
          {recording && (
            <p className="mt-2 mb-0 text-xs text-[var(--color-text-muted)] tabular-nums" role="status">
              Recording — {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")} elapsed. Stop after your answer (3-minute limit).
            </p>
          )}
          {voiceNote && <p className="mt-2 mb-0 text-xs leading-5 text-[var(--color-text-muted)]">{voiceNote}</p>}
          {error && <Notice variant="danger" role="alert" className="mt-3">{error}</Notice>}
        </>
      )}
    </div>
  );
}
