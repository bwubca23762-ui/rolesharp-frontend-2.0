import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "small" | "large";
}) {
  const sizes = {
    small: "max-w-[760px]",
    default: "max-w-[var(--maxw)]",
    large: "max-w-[1280px]",
  };

  return (
    <div
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${sizes[size]} ${className}`}
    >
      {children}
    </div>
  );
}
