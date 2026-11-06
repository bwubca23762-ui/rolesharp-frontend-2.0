import { cn } from "@/lib/utils";

/**
 * Shimmer placeholder. Pass explicit width/height (or an `h-4 w-32` className)
 * so the skeleton matches the shape of the real content rather than a generic box.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-admin-muted", className)} {...props} />;
}

/** A set of `count` shimmering table rows (used while a table is loading). */
export function SkeletonRows({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn("flex items-center gap-4 px-3 py-3.5", className)}>
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-8 w-28" />
        </div>
      ))}
    </>
  );
}

export { Skeleton };
