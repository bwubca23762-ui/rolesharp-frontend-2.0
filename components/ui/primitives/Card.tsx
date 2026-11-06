import type { CSSProperties, ReactNode } from "react";

// `DESIGN.md §5` requires the queue row and the attempt timeline entry to be a
// semantic `article`. Extending the card is what that section asks for —
// "extend them before introducing a parallel button, card, badge..." — rather
// than hand-rolling a second card that happens to be an <article>.
//
// `aria-label`/`aria-labelledby` are declared explicitly because TypeScript
// does NOT check hyphenated JSX attributes on a component. `<Card aria-label="...">`
// type-checks clean whether or not the prop exists, and without forwarding it
// the label is dropped on the floor — a labelled region silently becomes an
// unlabelled one.

export function Card({
  children,
  className = "",
  variant = "default",
  padding = "md",
  style,
  as: Tag = "div",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "interactive" | "glass" | "gradient" | "outline" | "dark";
  padding?: "none" | "sm" | "md" | "lg";
  style?: CSSProperties;
  as?: "div" | "article" | "section" | "li";
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const base =
    "rounded-[var(--radius-lg)] border transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 ease-out";

  const variants = {
    default:
      "bg-[var(--surface)] border-black/[0.07] dark:border-white/[0.1] shadow-[0_4px_24px_-4px_rgba(15,23,42,0.05),0_1px_2px_rgba(15,23,42,0.03),inset_0_1px_0_rgba(255,255,255,0.65)] dark:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]",
    elevated:
      "bg-[var(--surface)] border-black/[0.08] dark:border-white/[0.12] shadow-[0_12px_34px_-8px_rgba(15,23,42,0.09),0_2px_6px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]",
    interactive:
      "rs-interactive-lift bg-[var(--surface)] border-black/[0.08] dark:border-white/[0.12] shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] hover:border-[#0071E3]/45 hover:shadow-[0_14px_34px_-8px_rgba(0,113,227,0.14)]",
    glass:
      "backdrop-blur-xl bg-white/75 dark:bg-zinc-900/75 border-white/50 dark:border-white/15 shadow-[0_8px_30px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]",
    gradient:
      "bg-[linear-gradient(135deg,#0A84FF_0%,#0066CC_65%,#4F46E5_100%)] border-white/20 text-white shadow-[0_12px_32px_-8px_rgba(0,102,204,0.45),inset_0_1px_0_rgba(255,255,255,0.3)]",
    outline:
      "bg-[var(--surface-2)]/60 border-black/[0.08] dark:border-white/[0.12] hover:border-[#0071E3]/50 hover:bg-[var(--surface)]",
    dark:
      "bg-[#1D1D1F] border-white/10 text-white shadow-[0_14px_36px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]",
  };

  const paddings = {
    none: "",
    sm: "p-4",
    md: "p-5 md:p-6",
    lg: "p-6 md:p-8",
  };

  return (
    <Tag
      className={`${base} ${variants[variant]} ${paddings[padding]} ${className}`}
      style={style}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </Tag>
  );
}
