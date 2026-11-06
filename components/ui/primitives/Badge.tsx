import type { ReactNode } from "react";

// Exported so the status-mapping helpers in admin can be typed against it. They
// used to return compat class-name strings, and four of the names they returned
// were defined in no stylesheet — a `Record<string, string>` will hold any typo
// you give it. A `Record<string, BadgeVariant>` will not.
export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "premium"
  | "info"
  | "neutral"
  | "outline";

export function Badge({
  children,
  variant = "default",
  className = "",
  title,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  title?: string;
}) {
  const variants: Record<BadgeVariant, string> = {
    default:
      "bg-black/[0.045] dark:bg-white/[0.08] text-[var(--muted-fg)] border-black/[0.08] dark:border-white/[0.12]",
    primary:
      "bg-[#0071E3]/[0.1] dark:bg-[#0A84FF]/[0.18] text-[#0066CC] dark:text-[#5AC8FA] border-[#0071E3]/25",
    success:
      "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25",
    warning:
      "bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25",
    danger:
      "bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/25",
    premium:
      "bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(217,119,6,0.12))] text-amber-800 dark:text-amber-300 border-amber-500/30",
    info:
      "bg-sky-500/12 text-sky-800 dark:text-sky-300 border-sky-500/25",
    neutral:
      "bg-black/[0.04] dark:bg-white/[0.07] text-[var(--fg)] border-black/[0.08] dark:border-white/[0.12]",
    outline:
      "bg-transparent text-[var(--fg)] border-black/[0.14] dark:border-white/[0.18]",
  };

  // Two admin badges carry the failing detail as a tooltip — the ingestion
  // failure count and the send error. Without this the conversion would have
  // dropped that text on the floor.
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
