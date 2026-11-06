import type { ReactNode } from "react";
import { Card } from "./Card";

export function MetricCard({
  label,
  value,
  detail,
  icon,
  trend,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  trend?: ReactNode;
  className?: string;
}) {
  return (
    <Card padding="sm" className={`min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted-fg)]">{label}</p>
          <div className="text-2xl font-extrabold! tracking-[-0.035em]! tabular-nums text-[var(--fg)] md:text-3xl">{value}</div>
        </div>
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0071E3]/10 text-[#0066CC] dark:bg-[#0A84FF]/15 dark:text-[#5AC8FA] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            {icon}
          </span>
        )}
      </div>
      {(detail || trend) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-fg)]">
          <span>{detail}</span>
          {trend && <span className="font-semibold text-[#0066CC] dark:text-[#5AC8FA]">{trend}</span>}
        </div>
      )}
    </Card>
  );
}
