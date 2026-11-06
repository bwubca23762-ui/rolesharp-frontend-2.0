"use client";
import { useEffect, useRef, useState } from "react";

// SVG donut ring (NOT css border-radius). Animates stroke-dashoffset on mount.
// Color thresholds: <60 red, 60-79 amber, >=80 green. Respects reduced-motion.
// Counter counts up from 0 to score over 800ms (matches stroke animation duration).
export default function ScoreRing({
  score,
  size = 132,
  stroke = 12,
  label = "/ 100",
  animate = true,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  animate?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [displayNum, setDisplayNum] = useState(animate ? 0 : clamped);
  const [strokeTarget, setStrokeTarget] = useState(animate ? 0 : clamped);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!animate) { setDisplayNum(clamped); setStrokeTarget(clamped); return; }
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setDisplayNum(clamped); setStrokeTarget(clamped); return; }

    // Trigger stroke animation via CSS transition
    const t = requestAnimationFrame(() => setStrokeTarget(clamped));

    // Count-up effect for numerical display over 800ms
    const duration = 800;
    const start = performance.now();
    const from = 0;

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Use same easing as stroke: cubic-bezier(.16,1,.3,1) approximation
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayNum(Math.round(from + (clamped - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(t);
      cancelAnimationFrame(rafRef.current);
    };
  }, [clamped, animate]);

  const color = clamped >= 80 ? "var(--color-success)" : clamped >= 60 ? "var(--color-warning)" : "var(--color-danger)";
  const offset = circ - (strokeTarget / 100) * circ;

  return (
    <div
      className="rs-score-pop relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`ATS score ${clamped} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-[var(--color-surface-2)] dark:text-[var(--color-dark-surface-2)]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 800ms cubic-bezier(.16,1,.3,1), stroke 300ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <strong
          className="text-2xl font-bold font-[family-name:var(--font-display)] tabular-nums"
          style={{ color }}
        >
          {displayNum}
        </strong>
        <span className="text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          {label}
        </span>
      </div>
    </div>
  );
}
