import type { ReactNode, HTMLAttributes } from "react";
import React from "react";
import { Container } from "./Container";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  containerClassName?: string;
  alt?: boolean;
  asContainer?: boolean;
  containerSize?: "small" | "default" | "large";
  size?: "sm" | "default" | "lg";
}

export function Section({
  children,
  className = "",
  containerClassName = "",
  alt = false,
  asContainer = true,
  containerSize = "default",
  size = "default",
  ...props
}: SectionProps) {
  // Ghost-band guard: a Section whose only children are null/false/undefined
  // (a retired SEO block, a conditionally-unavailable panel) used to render a
  // fully-styled empty stripe — padding, borders, background, zero content.
  // toArray drops null/undefined/booleans, so "real" children remain.
  if (React.Children.toArray(children).length === 0) {
    return null;
  }
  const sizes = {
    sm: "py-5 md:py-6",
    default: "py-6 md:py-10",
    lg: "py-10 md:py-14",
  };

  const bg = alt
    ? "bg-[var(--surface-2)] border-y border-[var(--hairline)]"
    : "";

  const content = asContainer ? (
    <Container size={containerSize} className={containerClassName}>{children}</Container>
  ) : (
    children
  );

  return (
    <section className={`${sizes[size]} ${bg} ${className}`} {...props}>
      {content}
    </section>
  );
}
