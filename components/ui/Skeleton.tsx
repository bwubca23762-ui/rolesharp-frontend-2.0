// Shimmer skeleton. variant matches the shape of real content, not generic boxes.
export default function Skeleton({
  variant = "text",
  width,
  height,
  count = 1,
  className = "",
  style,
}: {
  variant?: "text" | "heading" | "card" | "avatar" | "table-row";
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const items = Array.from({ length: count });

  const variantClasses: Record<typeof variant, string> = {
    text: "h-4 w-32 rounded-md",
    heading: "h-6 w-48 rounded-md",
    card: "h-40 w-full rounded-[var(--radius-lg)]",
    avatar: "h-12 w-12 rounded-full",
    "table-row": "h-12 w-full rounded-md",
  };

  return (
    <>
      {items.map((_, i) => (
        <span
          key={i}
          className={`block animate-pulse bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] ${variantClasses[variant]} ${className}`}
          style={{ width, height, ...style }}
          aria-hidden
        />
      ))}
    </>
  );
}
