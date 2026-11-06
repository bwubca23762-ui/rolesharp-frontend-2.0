"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import RoleSharpMark from "@/components/RoleSharpMark";

const QUESTION =
  "Do you know what it takes to secure a job rather than Degree and Skills?";
const ANSWER = "A perfect resume that explains you more than yourself!!";
const FINAL_LINE = "So, choose RoleSharp to tailor your resume.";

function BrandWord() {
  return (
    <span className="desk-quote-wordmark">
      <RoleSharpMark />
      <span>
        ole<span>Sharp</span>
      </span>
    </span>
  );
}

function Words({ text, accent = [] }: { text: string; accent?: string[] }) {
  return text.split(" ").map((word, index) => {
    const content: ReactNode =
      word === "RoleSharp" ? (
        <BrandWord />
      ) : (
        <span
          className={accent.includes(word) ? "desk-quote-accent" : undefined}
        >
          {word}
        </span>
      );
    return (
      <span key={`${word}-${index}`}>
        {index > 0 ? " " : ""}
        <span
          className="desk-quote-mask"
          style={{ "--quote-word": index } as CSSProperties}
        >
          {content}
        </span>
      </span>
    );
  });
}

export function LandingQuote({ compact = false }: { compact?: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "playing">("static");
  useEffect(() => {
    const element = stage.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || motion.matches || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio < 0.08) return;
        observer.disconnect();
        setState("playing");
      },
      { threshold: 0.08 },
    );
    const stopForReducedMotion = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      observer.disconnect();
      setState("static");
    };
    observer.observe(element);
    motion.addEventListener("change", stopForReducedMotion);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", stopForReducedMotion);
    };
  }, []);

  return (
    <section
      id="landing-quote"
      className={`desk-quote${compact ? " desk-quote-compact" : ""}`}
      aria-label="What makes a resume stand out"
    >
      <p className="sr-only">
        {QUESTION} well! {ANSWER} {FINAL_LINE}
      </p>
      <div
        ref={stage}
        className="desk-quote-stage"
        data-state={state}
        aria-hidden="true"
      >
        <div className="desk-quote-main">
          <p className="desk-quote-question">
            <Words text={QUESTION} />
          </p>
          <p className="desk-quote-beat">
            well<span>!</span>
          </p>
          <p className="desk-quote-answer">
            <Words text={ANSWER} accent={["perfect", "resume"]} />
          </p>
          <p className="desk-quote-invitation">
            <Words text={FINAL_LINE} />
          </p>
        </div>
      </div>
    </section>
  );
}
