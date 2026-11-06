"use client";

import { useEffect, useState } from "react";

/**
 * Visible pause control for the company ticker wall.
 *
 * Hover-to-pause only covered pointer users; touch users and anyone bothered
 * by the constant drift had no way to hold the wall still (usability audit
 * #13). This flips a data attribute on <html> that the ticker CSS honours,
 * so it pauses both rows from one button and survives track re-renders.
 */
export function TickerPause() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) document.documentElement.dataset.tickerPaused = "true";
    else delete document.documentElement.dataset.tickerPaused;
    return () => { delete document.documentElement.dataset.tickerPaused; };
  }, [paused]);

  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => setPaused((value) => !value)}
      className="text-xs font-semibold text-[var(--muted-fg)] underline-offset-4 hover:text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
    >
      {paused ? "Resume motion" : "Pause motion"}
    </button>
  );
}
