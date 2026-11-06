import type { ReactNode, ElementType } from "react";

/**
 * GradientText — renders text with an animated brand gradient.
 * Uses the .rs-text-gradient class from animations.css.
 * Falls back to primary color if CSS is not loaded.
 */
export function GradientText({
  children,
  className = "",
  as: Tag = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag className={`rs-text-gradient ${className}`}>
      {children}
    </Tag>
  );
}
