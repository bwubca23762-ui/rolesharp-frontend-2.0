"use client";

import { useEffect, useRef, useState } from "react";
import type { PreviewData } from "./live-preview";
import LivePreview from "./live-preview";

// Page-1 boundary + zoom toolbar (the gap report's top builder asks).
// The .lp-page mirror renders at ~0.7× A4 scale (560px wide vs 794px true),
// so one PDF page is PAGE_ONE_HEIGHT pixels of preview height. The dashed
// line sits there; anything spilling past it lands on page 2 of the export.
// The line is an estimate at this scale, not a print-perfect measurement —
// the label says so.
const PAGE_ONE_HEIGHT = 790;
const PAGE_WIDTH = 560;
const OVERFLOW_TOLERANCE = 40;

const ZOOM_STEPS = [0.5, 0.75, 1] as const;

export default function PreviewFrame({ data, onSectionClick, highlightedSection }: {
  data: PreviewData;
  onSectionClick?: (section: string) => void;
  highlightedSection?: string | null;
}) {
  const [zoom, setZoom] = useState<number>(1);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameWidth, setFrameWidth] = useState(PAGE_WIDTH);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setContentHeight(node.scrollHeight));
    observer.observe(node);
    setContentHeight(node.scrollHeight);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setFrameWidth(frame.clientWidth || PAGE_WIDTH);
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    measure();
    return () => observer.disconnect();
  }, []);

  const overflows = contentHeight > PAGE_ONE_HEIGHT + OVERFLOW_TOLERANCE;
  const index = ZOOM_STEPS.indexOf(zoom as 0.5);
  // Keep the paper's line wrapping stable. Zoom scales the whole page rather
  // than widening its layout; narrow laptop rails fit the same paper geometry.
  const scale = Math.min(1, frameWidth / PAGE_WIDTH) * zoom;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="row" style={{ gap: 4 }} role="group" aria-label="Preview zoom">
          <button type="button" className="lp-zoom-btn" onClick={() => setZoom(ZOOM_STEPS[Math.max(0, index - 1)])} disabled={index <= 0} aria-label="Zoom out">−</button>
          {ZOOM_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              className={`lp-zoom-btn ${zoom === step ? "active" : ""}`}
              onClick={() => setZoom(step)}
              aria-pressed={zoom === step}
            >
              {Math.round(step * 100)}%
            </button>
          ))}
          <button type="button" className="lp-zoom-btn" onClick={() => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, index + 1)])} disabled={index >= ZOOM_STEPS.length - 1} aria-label="Zoom in">+</button>
        </div>
        <p className="m-0 text-xs" role="status" aria-live="polite">
          {contentHeight === 0 ? "" : overflows
            ? <span className="font-semibold text-[var(--color-danger)]">Spills to page 2 — trim above the line</span>
            : <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Fits on 1 page</span>}
        </p>
      </div>
      <div ref={frameRef} className="overflow-hidden rounded-[var(--radius-md)]" style={{ height: Math.max(PAGE_ONE_HEIGHT, contentHeight) * scale }}>
        <div ref={contentRef} style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: PAGE_WIDTH }}>
          <div style={{ position: "relative" }}>
            <div
              aria-hidden="true"
              style={{
                position: "absolute", left: 0, right: 0, top: PAGE_ONE_HEIGHT,
                borderTop: "2px dashed var(--color-primary)",
                opacity: contentHeight > PAGE_ONE_HEIGHT ? 0.9 : 0.35,
              }}
            >
              <span style={{
                position: "absolute", right: 4, top: 2,
                fontSize: 10, padding: "1px 6px", borderRadius: 999,
                background: "var(--color-surface-2)", color: "var(--color-text-muted)",
              }}>Page 1 ends here (A4, approximate)</span>
            </div>
            <LivePreview data={data} onSectionClick={onSectionClick} highlightedSection={highlightedSection} minHeight={PAGE_ONE_HEIGHT} />
          </div>
        </div>
      </div>
    </div>
  );
}
