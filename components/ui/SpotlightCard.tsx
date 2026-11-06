"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";

/**
 * SpotlightCard — a card that tracks the mouse position and shows a
 * radial gradient highlight that follows the cursor. Pure CSS via
 * CSS custom properties — no JS animation frames.
 *
 * If JS is disabled, the ::before pseudo-element just stays at default
 * position and the card looks normal.
 */
export function SpotlightCard({
  children,
  className = "",
  spotlightColor,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--rs-spot-x", `${x}%`);
    el.style.setProperty("--rs-spot-y", `${y}%`);
  }

  return (
    <div
      ref={ref}
      className={`rs-spotlight ${className}`}
      onMouseMove={handleMouseMove}
      style={spotlightColor ? ({ "--rs-spotlight-color": spotlightColor } as React.CSSProperties) : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}
