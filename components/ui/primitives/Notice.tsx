import type { ReactNode } from "react";

const noticeStyles = {
  info: "border-cyan-700/25 bg-cyan-50 text-cyan-950 dark:border-cyan-300/25 dark:bg-cyan-950/35 dark:text-cyan-50",
  success: "border-emerald-700/25 bg-emerald-50 text-emerald-950 dark:border-emerald-300/25 dark:bg-emerald-950/35 dark:text-emerald-50",
  warning: "border-amber-700/25 bg-amber-50 text-amber-950 dark:border-amber-300/25 dark:bg-amber-950/35 dark:text-amber-50",
  danger: "border-red-700/25 bg-red-50 text-red-950 dark:border-red-300/25 dark:bg-red-950/35 dark:text-red-50",
  neutral: "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)] dark:text-[var(--color-dark-text)]",
};

export function Notice({
  title,
  children,
  icon,
  actions,
  variant = "info",
  className = "",
  role,
}: {
  title?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  variant?: keyof typeof noticeStyles;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div role={role} className={`rounded-[var(--radius-lg)] border p-4 ${noticeStyles[variant]} ${className}`}>
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5 shrink-0" aria-hidden>{icon}</span>}
        <div className="min-w-0 flex-1">
          {title && <strong className="block font-bold">{title}</strong>}
          <div className={`${title ? "mt-1" : ""} text-sm leading-6 opacity-90`}>{children}</div>
          {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
