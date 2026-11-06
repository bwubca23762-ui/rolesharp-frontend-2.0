import type { ReactNode } from "react";

/**
 * Miniature resume-layout illustrations for the homepage template gallery.
 * Ported from the "RoleSharp Redefined" concept; rendered as light "paper"
 * documents in both themes.
 */
export type ThumbLayout = "classic" | "sidebar" | "twocol" | "editorial";

function TinyBar({ w = "w-full", tone = "muted" }: { w?: string; tone?: "muted" | "invert" }) {
  const bg = tone === "invert" ? "bg-white/60" : "bg-slate-300";
  return <div className={`h-1 rounded-full ${w} ${bg}`} />;
}

function Block({ label, tone = "primary", lines = 2 }: { label: string; tone?: "primary" | "accent" | "ink"; lines?: number }) {
  const ring =
    tone === "accent"
      ? "ring-[var(--color-accent)]/30 bg-[var(--color-accent)]/10"
      : tone === "ink"
        ? "ring-slate-300 bg-slate-100"
        : "ring-[var(--color-primary)]/25 bg-[var(--color-primary-50)]";
  const dot =
    tone === "accent" ? "bg-[var(--color-accent)]" : tone === "ink" ? "bg-slate-800" : "bg-[var(--color-primary)]";
  return (
    <div className={`overflow-hidden rounded-md p-2 ring-1 ${ring}`}>
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-700">
          {label}
        </span>
      </div>
      <div className="mt-1.5 grid gap-1">
        {Array.from({ length: lines }).map((_, i) => (
          <TinyBar key={i} w={i === lines - 1 ? "w-3/4" : "w-full"} />
        ))}
      </div>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="rs-paper-preview h-full w-full overflow-hidden rounded-md border border-slate-200 bg-white text-slate-900 shadow-sm">
      {children}
    </div>
  );
}

export default function TemplateThumb({ layout }: { layout: ThumbLayout }) {
  if (layout === "classic") {
    return (
      <Frame>
        <div className="grid h-full grid-rows-[auto_1fr_1fr_auto] gap-2 p-2.5">
          <div className="rounded-md bg-[var(--color-primary-50)] px-2 py-2 text-center ring-1 ring-[var(--color-primary)]/20">
            <div className="font-display text-[13px] font-bold leading-tight tracking-tight text-slate-900">
              Alex Morgan
            </div>
            <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[var(--color-primary)]">
              Product Manager
            </div>
          </div>
          <Block label="Experience" tone="primary" lines={3} />
          <Block label="Education" tone="ink" lines={2} />
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Skills
            </span>
            <div className="flex flex-1 flex-wrap gap-1">
              <span className="rounded-full bg-[var(--color-primary-100)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--color-primary-700)]">SQL</span>
              <span className="rounded-full bg-[var(--color-accent)]/20 px-1.5 py-0.5 text-[8px] font-medium text-slate-800">Figma</span>
              <span className="rounded-full bg-[var(--color-primary-100)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--color-primary-700)]">A/B</span>
            </div>
          </div>
        </div>
      </Frame>
    );
  }

  if (layout === "sidebar") {
    return (
      <Frame>
        <div className="flex h-full">
          <div className="grid w-[44%] gap-2 bg-slate-900 p-2 text-white">
            <div className="h-7 w-7 rounded-full bg-[var(--color-accent)]" />
            <div>
              <div className="font-display text-[11px] font-bold leading-tight">Priya Shah</div>
              <div className="mt-0.5 text-[7px] uppercase tracking-[0.16em] text-teal-200">Software Eng</div>
            </div>
            <div>
              <div className="text-[7px] font-semibold uppercase tracking-[0.16em] text-white/70">Contact</div>
              <div className="mt-1 grid gap-1">
                <TinyBar tone="invert" />
                <TinyBar w="w-4/5" tone="invert" />
              </div>
            </div>
            <div>
              <div className="text-[7px] font-semibold uppercase tracking-[0.16em] text-teal-200">Stack</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {["TS", "Go", "AWS"].map((t) => (
                  <span key={t} className="rounded bg-white/15 px-1 py-0.5 text-[7px] font-semibold text-white">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="grid flex-1 grid-rows-[auto_1fr_1fr] gap-1.5 p-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">Summary</div>
            <Block label="Experience" tone="primary" lines={3} />
            <Block label="Projects" tone="accent" lines={2} />
          </div>
        </div>
      </Frame>
    );
  }

  if (layout === "twocol") {
    return (
      <Frame>
        <div className="flex h-full flex-col p-2.5">
          <div className="flex items-baseline justify-between border-b-2 border-slate-900 pb-1.5">
            <div>
              <div className="font-display text-[12px] font-bold leading-none tracking-tight text-slate-900">Jordan Reed</div>
              <div className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-slate-500">Senior Analyst</div>
            </div>
            <div className="text-right text-[7px] uppercase tracking-[0.14em] text-slate-500">
              <div>New York</div>
              <div>MBA — CFA</div>
            </div>
          </div>
          <div className="mt-2 grid flex-1 grid-cols-[0.9fr_1.2fr] gap-2">
            <div className="grid gap-1.5">
              <Block label="Skills" tone="primary" lines={2} />
              <Block label="Awards" tone="accent" lines={2} />
            </div>
            <div className="grid gap-1.5">
              <Block label="Experience" tone="ink" lines={3} />
              <Block label="Education" tone="primary" lines={2} />
            </div>
          </div>
        </div>
      </Frame>
    );
  }

  // editorial / design
  return (
    <Frame>
      <div className="flex h-full">
        <div className="w-1.5 bg-[var(--color-accent)]" />
        <div className="grid flex-1 grid-rows-[auto_1fr_1fr_auto] gap-1.5 p-2.5">
          <div className="rounded-md bg-[var(--color-primary-solid)] p-2 text-white">
            <div className="font-display text-[13px] font-bold leading-tight tracking-tight">Mia Rossi</div>
            <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-teal-100">Art Director</div>
          </div>
          <Block label="Selected Work" tone="accent" lines={3} />
          <Block label="Clients" tone="primary" lines={2} />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {["Nike", "Vogue", "Kinfolk"].map((t) => (
                <span key={t} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[7px] font-medium text-slate-700">
                  {t}
                </span>
              ))}
            </div>
            <span className="text-[7px] uppercase tracking-[0.16em] text-slate-500">Milan</span>
          </div>
        </div>
      </div>
    </Frame>
  );
}
