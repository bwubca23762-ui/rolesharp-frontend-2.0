"use client";

import { useState } from "react";
import { Check, Copy } from "@/app/icons";
import { Button } from "@/components/ui/primitives";

type CopyState = "idle" | "copied" | "error";

export default function CopyPromptButton({ prompt, title }: { prompt: string; title: string }) {
  const [state, setState] = useState<CopyState>("idle");

  async function copyPrompt() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(prompt);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void copyPrompt()}
        leftIcon={state === "copied" ? <Check size={16} /> : <Copy size={16} />}
        aria-label={`Copy ${title} prompt`}
      >
        {state === "copied" ? "Copied" : "Copy prompt"}
      </Button>
      <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]" aria-live="polite">
        {state === "copied" ? "Ready to paste." : state === "error" ? "Copy failed. Select the prompt and copy it manually." : ""}
      </span>
    </div>
  );
}
