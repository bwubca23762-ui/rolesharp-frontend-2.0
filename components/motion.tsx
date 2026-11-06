"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The Ink & Signal motion system (REDESIGN-SPEC.md §2). One IntersectionObserver
// per element, fires once, then unobserves. Above-fold callers render children
// visible server-side by passing `eager` — the hero must never hide behind JS
// (LCP law). Everything respects prefers-reduced-motion via the .rvl-* CSS.

type RevealVariant = "rise" | "fade" | "clip";

export function Reveal({
  children,
  delay = 0,
  variant = "rise",
  eager = false,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  /** Stagger offset in ms. Siblings typically step 60–90ms. */
  delay?: number;
  variant?: RevealVariant;
  /** Render visible immediately without observation (above-fold / LCP content). */
  eager?: boolean;
  as?: "div" | "section" | "li" | "article" | "header" | "figure";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(eager);

  useEffect(() => {
    if (inView) return;
    const node = ref.current;
    if (!node) return;
    // No IO in old browsers / reduced motion handled purely in CSS.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  const variantClass = variant === "fade" ? "rvl-fade" : variant === "clip" ? "rvl-clip" : "rvl-rise";
  const Component = Tag as "div";
  return (
    <Component
      ref={ref as React.Ref<HTMLDivElement>}
      data-reveal={variantClass}
      data-inview={inView ? "true" : "false"}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`rvl ${variantClass} ${inView ? "rvl-in" : "rvl-wait"} ${className}`}
    >
      {children}
    </Component>
  );
}

/** A hairline rule that draws itself (scaleX 0→1) when scrolled into view. */
export function RuleReveal({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`rvl-rule ${inView ? "rvl-rule-in" : ""} ${className}`}
    />
  );
}
