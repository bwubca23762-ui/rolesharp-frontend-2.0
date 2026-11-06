"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AnimatedCounter — smoothly animates from 0 to a target number
 * using requestAnimationFrame. Respects prefers-reduced-motion
 * (shows final value immediately). The duration adapts to the target
 * so small numbers don't feel slow and large numbers don't feel rushed.
 */
export function AnimatedCounter({
  to,
  from = 0,
  duration,
  className = "",
  format,
  suffix = "",
  prefix = "",
}: {
  to: number;
  from?: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(from);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion — show final value
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    // Use IntersectionObserver to trigger on scroll into view
    if (!("IntersectionObserver" in window)) {
      setValue(to);
      return;
    }

    let rafId: number;

    const animate = () => {
      // Adapt duration: faster for small numbers, slower for big ones
      const animDuration = duration ?? Math.min(1600, Math.max(600, to * 8));
      const start = performance.now();

      const step = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / animDuration, 1);
        // Ease-out-expo for a natural deceleration
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = Math.round(from + (to - from) * eased);
        setValue(current);
        if (progress < 1) {
          rafId = requestAnimationFrame(step);
        }
      };

      rafId = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            animate();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [to, from, duration]);

  const displayValue = format ? format(value) : value.toString();

  return (
    <span ref={ref} className={`rs-count-in ${className}`}>
      {prefix}{displayValue}{suffix}
    </span>
  );
}
