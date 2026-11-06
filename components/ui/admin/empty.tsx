import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Designed empty state for a table or card: a muted icon in a rounded well, a
 * bold title, and a muted subtitle. Centered so it reads as "nothing here yet"
 * rather than a broken layout.
 */
export function EmptyState({
  icon,
  title = "No records found",
  description = "Adjust your filters or check back later.",
  action,
  className,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-admin-muted text-admin-muted-fg" aria-hidden>
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-admin-fg">{title}</h3>
        {description && <p className="mx-auto max-w-sm text-sm text-admin-muted-fg">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
