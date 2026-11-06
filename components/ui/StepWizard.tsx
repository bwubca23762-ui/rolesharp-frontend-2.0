"use client";
import { Check } from "@/app/icons";

// Horizontal progress bar (numbered dots connected by a line).
// active = filled blue, completed = green check, future = gray.
export default function StepProgress({
  steps,
  current,
  onJump,
}: {
  steps: string[];
  current: number;
  onJump?: (i: number) => void;
}) {
  return (
    <ol className="wizard-steps" aria-label="Progress">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "future";
        return (
          <li key={label} className={`wizard-step ${state}`} aria-current={i === current ? "step" : undefined}>
            <button
              type="button"
              className="wizard-dot"
              disabled={i > current || !onJump}
              onClick={() => onJump?.(i)}
              aria-label={`Step ${i + 1}: ${label}`}
            >
              {state === "done" ? <Check size={16} /> : i + 1}
            </button>
            <span className="wizard-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
