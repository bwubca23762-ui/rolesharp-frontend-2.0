import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The single status badge for the admin console. One component, one color map:
//   Green  (success)  -> Published / Active / OK / Verified / Completed
//   Red    (danger)   -> Failed / Revoked / Error / Rejected / Expired
//   Yellow (warning)  -> Pending / Requested / Queued / In progress
//   Gray   (neutral)  -> Draft / Disabled / Paused / Inactive
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-admin-primary text-admin-primary-fg",
        success: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        danger: "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        warning: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
        neutral: "border-transparent bg-admin-muted text-admin-muted-fg",
        outline: "text-admin-fg border-admin-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const SUCCESS = new Set(["published", "active", "ok", "verified", "success", "succeeded", "completed", "delivered", "approved", "healthy", "online", "enabled", "paid", "passed"]);
const DANGER = new Set(["failed", "failure", "revoked", "error", "rejected", "expired", "banned", "down", "offline", "bounced", "blocked"]);
const WARNING = new Set(["pending", "requested", "queued", "in_progress", "in-progress", "processing", "waiting", "scheduled", "retrying", "unavailable", "in_review"]);

/** Best-effort map from a raw status string to a badge variant. Pages may pass an explicit variant to override. */
export function statusToVariant(status: string | null | undefined): BadgeVariant {
  const s = (status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (SUCCESS.has(s)) return "success";
  if (DANGER.has(s)) return "danger";
  if (WARNING.has(s)) return "warning";
  return "neutral";
}

export { Badge, badgeVariants };
