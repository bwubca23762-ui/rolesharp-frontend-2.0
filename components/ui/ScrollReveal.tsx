"use client";

import type { ReactNode, ElementType } from "react";

/**
 * ScrollReveal — renders children immediately at full opacity so no section
 * starts invisible or shifts layout during scroll.
 */
export function ScrollReveal({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  variant?: "up" | "left" | "right" | "scale" | "stagger";
  delay?: number;
  threshold?: number;
  once?: boolean;
  as?: ElementType;
}) {
  return <Tag className={className}>{children}</Tag>;
}
