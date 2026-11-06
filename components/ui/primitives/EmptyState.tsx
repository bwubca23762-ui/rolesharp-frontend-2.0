import type { ReactNode } from "react";
import { Card } from "./Card";

export function EmptyState({
  icon,
  title,
  description,
  actions,
  compact = false,
  className = "",
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Card className={`text-center ${compact ? "py-8" : "py-12 md:py-16"} ${className}`}>
      {icon && <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]" aria-hidden>{icon}</div>}
      {/* Same unlayered-base-rule override the other headings carry: without the
          trailing ! this rendered 700 at -0.02em, not the 700 at -0.025em asked
          for here. See PageHeader for the full explanation. */}
      <h2 className="text-xl font-bold! tracking-[-0.025em]! text-[var(--color-text)] dark:text-[var(--color-dark-text)] md:text-2xl">{title}</h2>
      {description && <div className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] md:text-base">{description}</div>}
      {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </Card>
  );
}
