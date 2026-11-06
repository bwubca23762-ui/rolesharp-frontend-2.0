"use client";

import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-admin-primary text-admin-primary-fg shadow-sm hover:bg-admin-primary/90",
        // Primary Signal: indigo→violet gradient with a top specular highlight
        // and ambient indigo shadow — the "command" action style.
        signal:
          "bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_18px_-6px_rgba(79,70,229,0.55)] hover:brightness-110",
        // Cyber Glass: cyan-indigo translucent fill with a glowing cyan border
        // — AI, sync, cache purge, automation triggers.
        cyber:
          "bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(99,102,241,0.18))] text-[#67e8f9] border border-[rgba(34,211,238,0.4)] shadow-[0_0_14px_-4px_rgba(34,211,238,0.5)] hover:bg-[linear-gradient(135deg,rgba(34,211,238,0.24),rgba(99,102,241,0.26))] hover:shadow-[0_0_20px_-4px_rgba(34,211,238,0.65)]",
        // Frosted Glass: translucent dark slate with backdrop blur for
        // secondary toolbar actions.
        frosted:
          "bg-white/[0.06] text-admin-fg backdrop-blur-md border border-white/10 hover:bg-white/[0.1] hover:border-white/20",
        // Emerald / Approve: grants, approvals, activations.
        success:
          "bg-[rgba(52,211,153,0.12)] text-[#6ee7b7] border border-[rgba(52,211,153,0.45)] shadow-[0_0_12px_-4px_rgba(52,211,153,0.5)] hover:bg-[rgba(52,211,153,0.2)]",
        // Amber / Caution: retries, rate-limit resets, pauses.
        warning:
          "bg-[rgba(251,191,36,0.1)] text-[#fcd34d] border border-[rgba(251,191,36,0.4)] hover:bg-[rgba(251,191,36,0.18)]",
        destructive: "bg-admin-destructive text-admin-destructive-fg shadow-sm hover:bg-admin-destructive/90",
        // Alias for the destructive red — several call sites say variant="danger"
        // (the primitives Button vocabulary); cva would silently drop the
        // unknown variant and render default blue for a destructive action.
        danger:
          "bg-[rgba(251,113,133,0.12)] text-[#fda4af] border border-[rgba(251,113,133,0.45)] shadow-[0_0_12px_-4px_rgba(251,113,133,0.5)] hover:bg-[rgba(251,113,133,0.2)]",
        outline: "border border-admin-border bg-admin-surface shadow-sm hover:bg-admin-muted hover:text-admin-fg",
        secondary: "bg-admin-secondary text-admin-secondary-fg shadow-sm hover:bg-admin-secondary/70",
        ghost: "hover:bg-admin-muted hover:text-admin-fg",
        link: "text-admin-primary underline-offset-4 hover:underline",
      },
      size: {
        // 28px precision size for icon-only micro-actions in dense toolbars.
        xs: "h-7 rounded-md px-2 text-[11px]",
        compact: "h-8 rounded-md px-2.5 text-xs",
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
        "icon-xs": "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Replaces the leading slot with a spinner and disables the button. */
  isLoading?: boolean;
  /** Label swapped in while isLoading — e.g. "Running…" instead of "Run". */
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Styled monospace keyboard-shortcut badge rendered inside the button. */
  shortcut?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      shortcut,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <span
            aria-hidden
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          leftIcon
        )}
        <Slottable child={children}>
          {(content) => isLoading && loadingText ? loadingText : content}
        </Slottable>
        {!isLoading && rightIcon}
        {!isLoading && shortcut ? (
          <kbd className="ml-1 rounded border border-current/30 bg-black/20 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold leading-none">
            {shortcut}
          </kbd>
        ) : null}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
