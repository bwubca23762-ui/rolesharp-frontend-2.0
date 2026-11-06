import type { CSSProperties } from "react";

/**
 * BlurOrbs — decorative floating gradient blobs for hero sections.
 * Pure CSS animation via the .rs-orb classes in animations.css.
 * Set aria-hidden since these are purely decorative.
 *
 * Usage:
 * <div className="relative">
 *   <BlurOrbs />
 *   <YourContent />
 * </div>
 */
export function BlurOrbs({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "dark";
}) {
  const orb1Style: CSSProperties = {
    width: "380px",
    height: "380px",
    top: "-60px",
    left: "-80px",
    background: variant === "dark"
      ? "radial-gradient(circle, color-mix(in oklab, var(--color-primary-hover) 60%, transparent), transparent)"
      : "radial-gradient(circle, color-mix(in oklab, var(--color-primary) 50%, transparent), transparent)",
  };

  const orb2Style: CSSProperties = {
    width: "320px",
    height: "320px",
    bottom: "-40px",
    right: "-60px",
    background: variant === "dark"
      ? "radial-gradient(circle, color-mix(in oklab, var(--color-brand-amber) 50%, transparent), transparent)"
      : "radial-gradient(circle, color-mix(in oklab, var(--color-brand-amber) 40%, transparent), transparent)",
  };

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      <div className="rs-orb rs-orb-1" style={orb1Style} />
      <div className="rs-orb rs-orb-2" style={orb2Style} />
    </div>
  );
}
