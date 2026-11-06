"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Notice, Select } from "@/components/ui/primitives";
import { altitudeAdaptation, type AltitudeAnswer, type AltitudeReadout } from "@/lib/interview-panel";

// Panel simulator (Phase 4): one question, three interviewer personas at
// three altitudes. Deterministic follow-ups from the resume's own evidence;
// persona audio rides the per-voice TTS cache; the Altitude Adaptation
// Score is a deterministic rehearsal signal computed in the client from the
// typed answers — no model call anywhere, so it is free-tier safe and never
// burns the practice session.

type FollowUp = { personaId: string; name: string; altitude: string; question: string; anchorBullet: string | null };

const ALTITUDE_LABEL: Record<string, string> = {
  screening: "screening altitude — brief and concrete",
  probe: "probe altitude — evidence and detail",
  strategic: "strategic altitude — outcomes and framing",
};

export default function PanelSimulator({ resumeId, questions }: { resumeId: string; questions: string[] }) {
  const [question, setQuestion] = useState("");
  const [followUps, setFollowUps] = useState<FollowUp[] | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AltitudeAnswer[]>([]);
  const [draft, setDraft] = useState("");
  const [readout, setReadout] = useState<AltitudeReadout | null>(null);
  const [busy, setBusy] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  useEffect(() => () => {
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  async function loadPanel() {
    if (!question) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/interview/panel", {
        signal: AbortSignal.timeout(30_000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, question }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { followUps: FollowUp[] };
      setFollowUps(data.followUps);
      setStep(0);
      setAnswers([]);
      setDraft("");
      setReadout(null);
    } catch {
      setError("Could not load the panel. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function hearQuestion(personaId: string, text: string) {
    if (audioBusy) return;
    setAudioBusy(true);
    try {
      const res = await fetch("/api/interview/tts", {
        signal: AbortSignal.timeout(50_000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 600), persona: personaId }),
      });
      if (!res.ok) { setAudioUnavailable(true); return; }
      const blob = await res.blob();
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

  function submitAnswer() {
    if (!followUps || !draft.trim()) return;
    const next = [...answers, { personaId: followUps[step].personaId, answer: draft.trim() }];
    setAnswers(next);
    setDraft("");
    if (step + 1 < followUps.length) {
      setStep(step + 1);
    } else {
      setReadout(altitudeAdaptation(next));
    }
  }

  function restart() {
    setFollowUps(null);
    setStep(0);
    setAnswers([]);
    setDraft("");
    setReadout(null);
    setAudioUnavailable(false);
  }

  const current = followUps?.[step];

  return (
    <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 dark:border-[var(--color-dark-border)]">
      <p className="m-0 text-[0.7rem] font-bold! uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        Panel simulator · three interviewers, three altitudes · free
      </p>
      <p className="mt-2 mb-0 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
        The same question, asked by a screener, a hiring manager, and an executive. Answer each in the register that
        interviewer expects. Everything is built from your own resume — the score at the end is a rehearsal signal, not a
        prediction.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="panel-question" className="text-xs font-semibold text-[var(--color-text-muted)]">Practice question</label>
          <Select id="panel-question" value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-1">
            <option value="">Pick a question…</option>
            {questions.map((q) => <option key={q} value={q}>{q}</option>)}
          </Select>
        </div>
        {!followUps && (
          <Button onClick={() => void loadPanel()} disabled={!question || busy} isLoading={busy}>
            Convene the panel
          </Button>
        )}
      </div>

      {error && <Notice variant="danger" role="alert" className="mt-3">{error}</Notice>}

      {current && !readout && (
        <div className="mt-4" role="status">
          <p className="m-0 text-sm font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            {current.name} <span className="ml-1 text-xs font-semibold text-[var(--color-text-muted)]">· interviewer {step + 1} of {followUps!.length}</span>
          </p>
          <p className="mt-1 mb-0 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{ALTITUDE_LABEL[current.altitude]}</p>
          <h4 className="mt-3 mb-0 text-base font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{current.question}</h4>
          {!audioUnavailable ? (
            <Button variant="ghost" size="compact" className="mt-2" onClick={() => void hearQuestion(current.personaId, current.question)} disabled={audioBusy} isLoading={audioBusy}>
              {audioBusy ? "Loading audio..." : "▶ Hear it"}
            </Button>
          ) : (
            <p className="mt-2 mb-0 text-xs text-[var(--color-text-muted)]">Audio isn&rsquo;t available right now — read the question instead.</p>
          )}
          <label className="label mt-3" htmlFor={`panel-answer-${step}`}>Your answer to {current.name}</label>
          <textarea
            id={`panel-answer-${step}`}
            className="field"
            rows={5}
            value={draft}
            maxLength={4_000}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Same core story — different depth and framing for this interviewer."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={submitAnswer} disabled={!draft.trim()}>
              {step + 1 < followUps!.length ? "Next interviewer" : "Get my panel readout"}
            </Button>
            <Button variant="ghost" size="compact" onClick={restart}>Start over</Button>
          </div>
        </div>
      )}

      {readout && followUps && (
        <div className="mt-4" role="status">
          <p className="m-0 text-sm font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            Altitude adaptation: {readout.score}%
          </p>
          <ul className="mt-2 mb-0 list-none space-y-1.5 p-0 text-sm leading-6 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            {readout.postures.map((posture) => (
              <li key={posture.personaId} className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${posture.hit ? "bg-[var(--color-success)]" : "bg-[var(--color-brand-amber-solid)]"}`}
                  aria-hidden="true"
                />
                <strong>{followUps.find((f) => f.personaId === posture.personaId)?.name}</strong> — {posture.posture}: {posture.note}
              </li>
            ))}
          </ul>
          <ul className="mt-3 mb-0 list-disc pl-5 text-sm leading-6 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            {readout.coaching.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="compact" onClick={restart}>Try another question</Button>
          </div>
        </div>
      )}
    </div>
  );
}
