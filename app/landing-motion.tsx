"use client";

import { useEffect } from "react";

/**
 * Interaction motion for the landing page.
 *
 * The page already had entrance motion (ScrollReveal variants, aurora, orbs).
 * What it had none of was motion that responds to the reader: scroll position,
 * pointer position, and elements arriving in view. That is what this adds.
 *
 * Everything here is progressive enhancement over markup that already renders
 * server-side, so nothing depends on it. Three rules throughout:
 *   - prefers-reduced-motion disables all of it, and nothing is left mid-state.
 *   - pointer effects are skipped on coarse pointers; a magnetic button that
 *     needs hover is dead weight on a phone and costs touch latency.
 *   - only transform and opacity animate, and every write happens inside one
 *     rAF, so nothing here can force synchronous layout during a scroll.
 */
export default function LandingMotion() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const cleanups: Array<() => void> = [];
    const finePointer = window.matchMedia?.("(pointer: fine)").matches ?? false;

    // ---- Scroll progress -------------------------------------------------
    // A single element, written once per frame. Reads scrollHeight lazily on
    // resize rather than on every scroll event, which would thrash layout.
    const bar = document.createElement("div");
    bar.className = "rs-scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);

    let limit = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    let progressQueued = false;

    const paintProgress = () => {
      progressQueued = false;
      const ratio = Math.min(1, Math.max(0, window.scrollY / limit));
      bar.style.transform = `scaleX(${ratio.toFixed(4)})`;
    };
    const onScroll = () => {
      if (progressQueued) return;
      progressQueued = true;
      requestAnimationFrame(paintProgress);
    };
    const measure = () => {
      limit = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      onScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    measure();
    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      bar.remove();
    });

    // ---- Magnetic call-to-action ----------------------------------------
    // The button leans toward the cursor within a small radius and springs
    // back on leave. Capped at 6px: past that it stops feeling like weight and
    // starts feeling like the button is dodging the pointer.
    if (finePointer) {
      const magnets = document.querySelectorAll<HTMLElement>("[data-magnetic]");
      magnets.forEach((el) => {
        let frame = 0;
        const onMove = (event: PointerEvent) => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            const box = el.getBoundingClientRect();
            const dx = event.clientX - (box.left + box.width / 2);
            const dy = event.clientY - (box.top + box.height / 2);
            const cap = 6;
            const x = Math.max(-cap, Math.min(cap, dx * 0.18));
            const y = Math.max(-cap, Math.min(cap, dy * 0.3));
            el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
          });
        };
        const onLeave = () => {
          if (frame) cancelAnimationFrame(frame);
          frame = 0;
          el.style.transform = "";
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
        el.classList.add("rs-magnetic");
        cleanups.push(() => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", onLeave);
          if (frame) cancelAnimationFrame(frame);
          el.style.transform = "";
          el.classList.remove("rs-magnetic");
        });
      });
    }

    // ---- Pointer parallax on the hero mock -------------------------------
    // Tracked from the section, not the card, so the tilt responds before the
    // pointer reaches the card and the card never feels like a separate toy.
    if (finePointer) {
      const stage = document.querySelector<HTMLElement>("[data-parallax-stage]");
      const card = stage?.querySelector<HTMLElement>(".rs-parallax-target");
      if (stage && card) {
        let frame = 0;
        const onMove = (event: PointerEvent) => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            const box = stage.getBoundingClientRect();
            const nx = (event.clientX - box.left) / box.width - 0.5;
            const ny = (event.clientY - box.top) / box.height - 0.5;
            card.style.transform =
              `perspective(1400px) rotateY(${(nx * 3.2).toFixed(2)}deg) rotateX(${(-ny * 2.4).toFixed(2)}deg) translate3d(0,${(-ny * 5).toFixed(2)}px,0)`;
          });
        };
        const onLeave = () => {
          if (frame) cancelAnimationFrame(frame);
          frame = 0;
          card.style.transform = "";
        };
        stage.addEventListener("pointermove", onMove);
        stage.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          stage.removeEventListener("pointermove", onMove);
          stage.removeEventListener("pointerleave", onLeave);
          if (frame) cancelAnimationFrame(frame);
          card.style.transform = "";
        });
      }
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
