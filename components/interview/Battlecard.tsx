"use client";
import { useState } from "react";
import { Button, Card, GeneratedOutput, Notice } from "@/components/ui/primitives";
import type { Battlecard } from "@/lib/interview-cheatsheet";

// Battlecard UI (Phase 4): one pre-interview page built from the resume's
// own evidence — three rehearsed stories, the numbers the candidate can
// actually cite, and honest bridge lines for listed-but-unevidenced skills.
// Deterministic and free; nothing on the card is invented.

export default function Battlecard({ resumeId }: { resumeId: string }) {
  const [card, setCard] = useState<Battlecard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function build() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/interview/cheatsheet", {
        signal: AbortSignal.timeout(30_000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { battlecard: Battlecard };
      setCard(data.battlecard);
    } catch {
      setError("Could not build the battlecard. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const plain = card
    ? [
        "INTERVIEW BATTLECARD (built from your resume — nothing invented)",
        "",
        ...card.stories.flatMap((story, i) => [
          `Story ${i + 1} — ${story.title} at ${story.company}`,
          `  ${story.bullet}`,
          `  Close with: ${story.star.resultPrompt}`,
          "",
        ]),
        "Numbers you can cite: " + (card.citableNumbers.map((n) => n.value).join(", ") || "none in your resume yet — never invent one"),
        "Your evidenced vocabulary: " + card.evidenceTerms.join(", "),
        "",
        ...card.bridgeLines.map((b) => `• ${b.line}`),
      ].join("\n")
    : "";

  return (
    <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 dark:border-[var(--color-dark-border)]">
      <p className="m-0 text-[0.7rem] font-bold! uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        Interview battlecard · one page from your own evidence · free
      </p>
      <p className="mt-2 mb-0 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
        Three stories worth rehearsing, the numbers you can actually cite, and honest bridges for the skills your resume
        lists but never evidences. Built only from your resume — if a number is not on it, the card will not put it in
        your mouth.
      </p>
      {!card && (
        <Button className="mt-4" onClick={() => void build()} disabled={busy} isLoading={busy}>
          Build my battlecard
        </Button>
      )}
      {error && <Notice variant="danger" role="alert" className="mt-3">{error}</Notice>}
      {card && (
        <div className="mt-4 space-y-4">
          {card.stories.map((story, i) => (
            <Card key={i} padding="sm" className="p-4">
              <p className="m-0 text-[0.7rem] font-bold! uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                Story {i + 1} · {story.title} at {story.company}
              </p>
              <p className="mt-2 mb-0 text-sm font-semibold leading-6 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{story.bullet}</p>
              <p className="mt-2 mb-0 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Close with: {story.star.resultPrompt}
              </p>
            </Card>
          ))}
          {card.citableNumbers.length > 0 && (
            <p className="m-0 text-sm leading-6 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              <strong>Numbers you can cite:</strong> {card.citableNumbers.map((n) => n.value).join(" · ")}
            </p>
          )}
          {card.bridgeLines.length > 0 && (
            <ul className="mb-0 list-disc pl-5 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              {card.bridgeLines.map((bridge) => <li key={bridge.skill}>{bridge.line}</li>)}
            </ul>
          )}
          <GeneratedOutput label="Copy your battlecard" text={plain} />
        </div>
      )}
    </div>
  );
}
