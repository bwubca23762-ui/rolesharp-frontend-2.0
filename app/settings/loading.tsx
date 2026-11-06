import { Container } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";

// Account settings shell: page header + a stacked form card.
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
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 space-y-3" aria-hidden="true">
            <Skeleton variant="heading" width="12rem" />
            <Skeleton variant="text" width="20rem" />
          </div>

          <div className="space-y-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] md:p-8" aria-hidden="true">
            <Skeleton variant="text" width="8rem" />
            <Skeleton variant="text" count={2} />
            <Skeleton variant="text" width="9rem" />
            <Skeleton variant="text" count={2} />
          </div>
        </div>

        <span className="sr-only">Loading account settings</span>
      </Container>
    </div>
  );
}
