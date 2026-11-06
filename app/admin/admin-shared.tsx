"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Info, RefreshCw, X } from "@/app/icons";
import { Button } from "@/components/ui/primitives";
import { csvCell } from "@/lib/csv";

// The top-bar "Refresh data" button dispatches this DOM event; views whose
// data comes from local useEffect+fetch (not useAdminQuery, which the query
// client invalidation already covers) listen through useAdminRefreshSignal.
// Without it, the global button silently did nothing for the majority of
// views.
export const ADMIN_REFRESH_EVENT = "rolesharp-admin-refresh";

export function useAdminRefreshSignal(reload: () => void | Promise<void>) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    const handler = () => void ref.current();
    window.addEventListener(ADMIN_REFRESH_EVENT, handler);
    return () => window.removeEventListener(ADMIN_REFRESH_EVENT, handler);
  }, []);
}

export function PageHeader({
  title,
  desc,
  onRefresh,
  children,
}: {
  title: string;
  desc: string;
  onRefresh?: () => void;
  children?: ReactNode;
}) {
  const [spinning, setSpinning] = useState(false);
  return (
    <div className="admin-page-head">
      <div>
        <h1>{title}</h1>
        <p className="mt-1! mb-0! text-[14px] text-[var(--muted-fg)]">{desc}</p>
      </div>
      <div className="admin-page-head-actions">
        {children}
        {onRefresh && (
          <button
            className="admin-refresh-btn"
            onClick={() => {
              setSpinning(true);
              onRefresh();
              setTimeout(() => setSpinning(false), 600);
            }}
          >
            <span className={spinning ? "spin" : ""}><RefreshCw size={15} /></span> Refresh
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A stat is interactive when it is given `href` or `onClick`; otherwise it stays
 * the plain div it has always been. Every existing call site keeps working.
 */
export function StatCard({
  label,
  value,
  accent,
  hint,
  delta,
  series,
  href,
  onClick,
  active,
}: {
  label: string;
  value: ReactNode;
  accent?: "green" | "red" | "amber";
  /** Definition of the metric. Shown on hover and to screen readers. */
  hint?: string;
  /** Percent change vs the preceding period. */
  delta?: number | null;
  /** Tiny inline history behind this number. */
  series?: number[];
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const interactive = Boolean(href || onClick);
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const hasFoot = hasDelta || Boolean(series?.length);
  const className = [
    "admin-stat-card",
    accent ? `accent-${accent}` : "",
    interactive ? "is-interactive" : "",
    active ? "is-active" : "",
  ].filter(Boolean).join(" ");

  const body = (
    <>
      <div className="admin-stat-label">
        <span>{label}</span>
        {hint && <span className="admin-stat-hint"><Info size={12} /></span>}
      </div>
      <div className="admin-stat-value">{value}</div>
      {hasFoot && (
        <div className="admin-stat-foot">
          {hasDelta && (
            <span className={`admin-stat-delta ${delta! > 0 ? "up" : delta! < 0 ? "down" : "flat"}`}>
              {delta! > 0 ? "▲" : delta! < 0 ? "▼" : "▬"} {Math.abs(delta!).toFixed(1)}%
            </span>
          )}
          {series && series.length > 1 && <Sparkline values={series} />}
        </div>
      )}
      {interactive && <span className="admin-stat-go" aria-hidden="true"><ChevronRight size={15} /></span>}
    </>
  );

  const title = hint || undefined;
  if (href) return <a className={className} href={href} title={title}>{body}</a>;
  if (onClick) {
    // aria-pressed is set only when this stat is genuinely a toggle. A drill-down
    // button that always reports "not pressed" misleads screen readers.
    return (
      <button type="button" className={className} onClick={onClick} title={title} aria-pressed={active}>
        {body}
      </button>
    );
  }
  return <div className={className} title={title}>{body}</div>;
}

export function Sparkline({ values, color = "currentColor" }: { values: number[]; color?: string }) {
  if (!values?.length) return null;
  const width = 64;
  const height = 18;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const step = width / Math.max(1, values.length - 1);
  const path = values
    .map((value, index) => `${index ? "L" : "M"}${(index * step).toFixed(1)},${(height - ((value - min) / span) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="admin-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function DataRow({
  left,
  right,
  onClick,
  href,
}: {
  left: ReactNode;
  right: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const body = <><span>{left}</span><span className="text-[13px] text-[var(--muted-fg)]">{right}</span></>;
  if (href) return <a className="admin-data-row is-interactive" href={href}>{body}</a>;
  if (onClick) return <button type="button" className="admin-data-row is-interactive" onClick={onClick}>{body}</button>;
  return <div className="admin-data-row">{body}</div>;
}

export function Toolbar({
  placeholder,
  onSearch,
  children,
}: {
  placeholder: string;
  /** Omit for read-only tables — the search input renders disabled rather than dead. */
  onSearch?: (value: string) => void;
  children?: React.ReactNode;
}) {
  const [value, setValue] = useState("");
  const searchRef = useRef(onSearch);
  searchRef.current = onSearch ?? (() => {});
  useEffect(() => {
    if (typeof onSearch !== "function") return;
    const timeout = setTimeout(() => onSearch(value.trim()), 350);
    return () => clearTimeout(timeout);
  }, [value, onSearch]);
  return (
    <div className="admin-table-toolbar">
      <input
        className="admin-table-search"
        placeholder={placeholder}
        value={value}
        disabled={typeof onSearch !== "function"}
        aria-disabled={typeof onSearch !== "function"}
        onChange={(event) => setValue(event.target.value)}
      />
      {children}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="admin-pagination">
      <span className="text-[13px] text-[var(--muted-fg)]">{total.toLocaleString()} rows · page {page}/{pages}</span>
      <div className="row" style={{ gap: 8 }}>
        <Button variant="outline" size="compact" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</Button>
        <Button variant="outline" size="compact" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</Button>
      </div>
    </div>
  );
}

/** Buttons that pick one option. Used for date-range presets. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="admin-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? "is-selected" : ""}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
});

/** Dates from the API are UTC day buckets, so they must be read back as UTC. */
function formatDay(day: string) {
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? day : DAY_LABEL.format(parsed);
}

/**
 * Trend chart you can actually read a value off: hover or focus and arrow-key
 * across it to get the exact figure for a day. Plain SVG plus an HTML overlay —
 * the overlay is positioned in percentages so it stays aligned with the
 * non-uniformly scaled viewBox without needing a charting dependency.
 */
export function TrendChart({
  series,
  label,
  color = "var(--primary)",
  onSelectDay,
}: {
  series: { d: string; n: number }[];
  label: string;
  color?: string;
  /** Called when a day is clicked, for drill-down. */
  onSelectDay?: (point: { d: string; n: number }) => void;
}) {
  const [cursor, setCursor] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const points = series?.length ?? 0;

  const pick = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame || points === 0) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (points - 1));
    setCursor(Math.min(points - 1, Math.max(0, index)));
  }, [points]);

  if (!series?.length) {
    return (
      <div className="admin-chart-card">
        <div className="admin-chart-head"><b>{label}</b></div>
        <p className="text-[var(--muted-fg)]" style={{ margin: 0 }}>No data yet.</p>
      </div>
    );
  }

  const width = 560;
  const height = 120;
  const padding = 4;
  const max = Math.max(1, ...series.map((point) => point.n));
  const step = (width - padding * 2) / Math.max(1, series.length - 1);
  const coords = series.map((point, index) => [
    padding + index * step,
    height - padding - (point.n / max) * (height - padding * 2),
  ] as const);
  const line = coords.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${(padding + (series.length - 1) * step).toFixed(1)},${height - padding} L${padding},${height - padding} Z`;

  const total = series.reduce((sum, point) => sum + point.n, 0);
  const average = total / series.length;
  const peakIndex = series.reduce((best, point, index) => (point.n > series[best].n ? index : best), 0);
  const active = cursor === null ? null : series[cursor];
  const activeX = cursor === null ? 0 : (coords[cursor][0] / width) * 100;
  const activeY = cursor === null ? 0 : (coords[cursor][1] / height) * 100;
  const edge = activeX < 18 ? " at-start" : activeX > 82 ? " at-end" : "";

  return (
    <div className="admin-chart-card">
      <div className="admin-chart-head">
        <b>{label}</b>
        <span className="text-[12px] text-[var(--muted-fg)]">
          {series.length}d total {total.toLocaleString()} · avg {Math.round(average).toLocaleString()} · peak {series[peakIndex].n.toLocaleString()}
        </span>
      </div>
      <div
        ref={frameRef}
        className={`admin-chart-frame${cursor === null ? "" : " is-tracking"}`}
        tabIndex={0}
        role="application"
        aria-label={`${label}. ${series.length} days, total ${total}, peak ${series[peakIndex].n} on ${series[peakIndex].d}. Use arrow keys to read each day.`}
        onPointerMove={(event) => pick(event.clientX)}
        onPointerDown={(event) => pick(event.clientX)}
        onPointerLeave={() => setCursor(null)}
        onFocus={() => setCursor((current) => current ?? series.length - 1)}
        onBlur={() => setCursor(null)}
        onClick={() => { if (cursor !== null && onSelectDay) onSelectDay(series[cursor]); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            setCursor((current) => {
              const next = (current ?? series.length - 1) + (event.key === "ArrowRight" ? 1 : -1);
              return Math.min(series.length - 1, Math.max(0, next));
            });
          } else if (event.key === "Home") {
            event.preventDefault(); setCursor(0);
          } else if (event.key === "End") {
            event.preventDefault(); setCursor(series.length - 1);
          } else if (event.key === "Escape") {
            setCursor(null);
          } else if ((event.key === "Enter" || event.key === " ") && cursor !== null && onSelectDay) {
            event.preventDefault(); onSelectDay(series[cursor]);
          }
        }}
      >
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} className="admin-chart-grid" />
          <line x1="0" y1={padding} x2={width} y2={padding} className="admin-chart-grid" />
          <path d={area} fill={color} opacity="0.10" />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {active && (
          <>
            <span className="admin-chart-crosshair" style={{ left: `${activeX}%` }} />
            <span className="admin-chart-dot" style={{ left: `${activeX}%`, top: `${activeY}%`, background: color }} />
            <span className={`admin-chart-tip${edge}`} style={{ left: `${activeX}%` }}>
              <b>{active.n.toLocaleString()}</b>
              <small>{formatDay(active.d)}</small>
            </span>
          </>
        )}
      </div>
      <div className="admin-chart-axis">
        <span>{formatDay(series[0].d)}</span>
        <span>{formatDay(series[series.length - 1].d)}</span>
      </div>
      <p className="admin-chart-readout" role="status">
        {active ? `${formatDay(active.d)}: ${active.n.toLocaleString()}` : "Hover or focus the chart to read a day."}
      </p>
    </div>
  );
}

/**
 * Slide-over used to show the rows behind a headline number. Closes on Escape
 * and on backdrop click, and returns focus to whatever opened it.
 */
export function MetricDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<Element | null>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    closeRef.current?.focus();
    // This drawer declares aria-modal, so Tab has to stay inside it. Without
    // the wrap below, focus walked out into the page behind while assistive
    // tech was told the rest of the document was inert.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      const drawer = drawerRef.current;
      if (event.key !== "Tab" || !drawer) return;
      const items = Array.from(drawer.querySelectorAll<HTMLElement>(
        "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])",
      )).filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      (restoreRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="admin-drawer-root">
      <div className="admin-drawer-backdrop" onClick={onClose} />
      <aside ref={drawerRef} className="admin-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="admin-drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="text-[var(--muted-fg)]">{subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" className="admin-drawer-close" onClick={onClose} aria-label="Close details">
            <X size={17} />
          </button>
        </header>
        <div className="admin-drawer-body">{children}</div>
        {footer && <footer className="admin-drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

export function exportCsv(
  filename: string,
  rows: any[],
  columns: [string, (row: any) => any][],
) {
  const csv = [
    columns.map(([heading]) => heading).join(","),
    ...rows.map((row) => columns.map(([, value]) => csvCell(value(row))).join(",")),
  ].join("\n");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}
