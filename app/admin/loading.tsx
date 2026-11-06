import { Container } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";

// Admin console shell: analytics header + metric cards + a data table.
// The route page owns the <main> landmark. This fallback renders into the same
// slot, and Next streams the fallback and the resolved page into ONE document,
// so a <main> here puts two main landmarks in the served HTML.
export default function Loading() {
  return (
    <div
      className="min-h-[62vh] border-b border-[var(--color-border)] bg-[var(--color-bg)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-bg)]"
      aria-busy="true"
      aria-live="polite"
    >
      <Container className="py-10 md:py-14">
        <div className="mb-8 space-y-3" aria-hidden="true">
          <Skeleton variant="heading" width="14rem" />
          <Skeleton variant="text" width="22rem" />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-hidden="true">
          <Skeleton variant="card" height="7rem" />
          <Skeleton variant="card" height="7rem" />
          <Skeleton variant="card" height="7rem" />
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]">
          <Skeleton variant="table-row" count={6} />
        </div>

        <span className="sr-only">Loading admin console</span>
      </Container>
    </div>
  );
}
