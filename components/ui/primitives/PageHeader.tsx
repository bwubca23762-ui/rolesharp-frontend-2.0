import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  compact = true,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <header className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${compact ? "mb-5" : "mb-7 md:mb-9"} ${className}`}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1
          className={`${compact ? "text-[clamp(1.75rem,2.6vw,2.1rem)]" : "text-h1"} font-extrabold! leading-[1.06]! tracking-[-0.03em]! text-[var(--fg)] text-balance`}
        >
          {title}
        </h1>
        {description && (
          <div className="mt-2.5 max-w-2xl text-sm leading-6 text-[var(--muted-fg)] md:text-[15px] md:leading-6">
            {description}
          </div>
        )}
        {meta && <div className="mt-3.5 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  align = "left",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <div className={`${centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"} ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="text-h2 font-extrabold! leading-[1.1]! tracking-[-0.025em]! text-[var(--fg)] text-balance">
        {title}
      </h2>
      {description && (
        <div className="mt-2.5 text-sm leading-6 text-[var(--muted-fg)] md:text-[15px] md:leading-6">
          {description}
        </div>
      )}
      {actions && <div className={`mt-4 flex flex-wrap gap-2.5 ${centered ? "justify-center" : ""}`}>{actions}</div>}
    </div>
  );
}
