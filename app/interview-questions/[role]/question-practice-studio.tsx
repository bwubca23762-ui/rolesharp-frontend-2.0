"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Label, Textarea } from "@/components/ui/primitives";

type QuestionItem = {
  question: string;
  category: "behavioral" | "technical" | "situational";
  lookingFor: string;
};

const CAT_LABELS = [
  { id: "all", label: "All Questions" },
  { id: "behavioral", label: "Behavioral" },
  { id: "technical", label: "Technical" },
  { id: "situational", label: "Situational" },
] as const;

export default function QuestionPracticeStudio({
  roleTitle,
  questions,
}: {
  roleTitle: string;
  questions: QuestionItem[];
}) {
  const [selectedCat, setSelectedCat] = useState<"all" | "behavioral" | "technical" | "situational">("all");
  const [activeIdx, setActiveIdx] = useState(0);
  const [starDraft, setStarDraft] = useState("");
  const [copiedQuestion, setCopiedQuestion] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [timerRunning, setTimerRunning] = useState(false);
  const practiceHeading = useRef<HTMLHeadingElement>(null);

  const visible = selectedCat === "all" ? questions : questions.filter((q) => q.category === selectedCat);
  const currentQuestion = visible[activeIdx] ?? visible[0] ?? questions[0];

  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerRunning]);

  const wordCount = starDraft.trim() ? starDraft.trim().split(/\s+/).length : 0;
  const hasMetric = /\d+%|\$\d+|\b\d+\b/.test(starDraft);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-12 lg:items-start">
      <div className="min-w-0 space-y-4 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter question category">
            {CAT_LABELS.map((cat) => {
              const active = selectedCat === cat.id;
              const count = cat.id === "all" ? questions.length : questions.filter((q) => q.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={active}
                  disabled={count === 0}
                  onClick={() => {
                    setSelectedCat(cat.id);
                    setActiveIdx(0);
                    setTimerRunning(false);
                    setSecondsLeft(120);
                  }}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors disabled:opacity-50 motion-reduce:transition-none ${
                    active
                      ? "bg-[var(--surface-2)] text-[var(--fg)]"
                      : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="text-xs tabular-nums text-[var(--muted-fg)]">({count})</span>
                </button>
              );
            })}
          </div>
          <Button as="a" href="/interview-prep" variant="outline" size="compact">
            Practise with a resume
          </Button>
        </div>

        <div className="space-y-3">
          {visible.map((q, idx) => {
            const isSelected = currentQuestion?.question === q.question;
            return (
              <Card
                key={q.question}
                padding="sm"
                className={isSelected ? "outline-1 outline-offset-1 outline-[var(--primary)]" : ""}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Badge variant={q.category === "technical" ? "primary" : q.category === "behavioral" ? "success" : "info"}>
                    {q.category}
                  </Badge>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="compact"
                      onClick={() => {
                        navigator.clipboard?.writeText(q.question).then(() => {
                          setCopiedQuestion(q.question);
                          setTimeout(() => setCopiedQuestion(null), 1800);
                        }).catch(() => {});
                      }}
                    >
                      {copiedQuestion === q.question ? "Copied" : "Copy question"}
                    </Button>
                    <Button
                      variant={isSelected ? "primary" : "outline"}
                      size="compact"
                      aria-pressed={isSelected}
                      type="button"
                      onClick={() => {
                        setActiveIdx(idx);
                        setSecondsLeft(120);
                        setTimerRunning(false);
                        practiceHeading.current?.focus();
                      }}
                    >
                      {isSelected ? "Open practice" : "Rehearse"}
                    </Button>
                  </div>
                </div>
                <h2 className="mt-2.5 text-base font-bold! leading-snug text-[var(--fg)]">{q.question}</h2>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-fg)]">
                  <strong className="text-[var(--fg)]">Strong answers show:</strong> {q.lookingFor}
                </p>
              </Card>
            );
          })}
        </div>
      </div>

      <Card as="section" aria-labelledby="rehearsal-heading" className="min-w-0 lg:col-span-5 lg:sticky lg:top-24">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
          <h2 id="rehearsal-heading" ref={practiceHeading} tabIndex={-1} className="scroll-mt-28 text-xl font-semibold tracking-tight">Practise your answer</h2>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-[var(--surface-2)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs font-bold tabular-nums text-[var(--fg)]">
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="compact"
              onClick={() => {
                if (secondsLeft === 0) setSecondsLeft(120);
                setTimerRunning((running) => !running);
              }}
            >
              {timerRunning ? "Pause" : secondsLeft < 120 && secondsLeft > 0 ? "Resume" : "Start timer"}
            </Button>
          </div>
        </div>

        {currentQuestion && (
          <div className="mt-3 rounded-[14px] border border-black/[0.07] dark:border-white/[0.1] bg-[var(--surface-2)] p-3">
            <p className="text-sm font-semibold text-[var(--fg)]">{currentQuestion.question}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-fg)]">
              Strong answers show: {currentQuestion.lookingFor}
            </p>
          </div>
        )}

        <div className="mt-3">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2">
            <Label htmlFor="star-notes" className="mb-0">Answer notes</Label>
            <Button variant="ghost" size="compact"
              type="button"
              onClick={() =>
                setStarDraft(
                  "Situation: At [Company], our [system/workflow] faced [challenge].\nTask: I was responsible for [goal].\nAction: I built/led [specific technical or operational steps].\nResult: Reduced [metric] by [X%] across [scope].",
                )
              }
            >
              Use STAR outline
            </Button>
          </div>
          <Textarea
            id="star-notes"
            rows={7}
            value={starDraft}
            onChange={(e) => setStarDraft(e.target.value)}
            placeholder={`Outline your ${roleTitle} story here before saying it out loud...`}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-fg)]">
          <span>{wordCount} words (~{Math.max(10, Math.round(wordCount / 2.2))}s spoken)</span>
          <span className={hasMetric ? "font-bold text-emerald-700 dark:text-emerald-300" : ""}>
            {hasMetric ? "Number included" : "Add a result you can quantify"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!starDraft.trim()}
            onClick={() => {
              navigator.clipboard?.writeText(`${currentQuestion?.question}\n\n${starDraft}`).then(() => {
                setCopiedDraft(true);
                setTimeout(() => setCopiedDraft(false), 2000);
              }).catch(() => {});
            }}
          >
            {copiedDraft ? "Copied" : "Copy question and notes"}
          </Button>
          <Button as="a" href={`/build#role=${encodeURIComponent(roleTitle)}`} variant="outline" size="sm">
            Tailor resume for {roleTitle}
          </Button>
        </div>
      </Card>
    </div>
  );
}
