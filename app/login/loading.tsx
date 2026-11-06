import { Container } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";

// Auth shell: a single centered card with a heading and form rows.
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
      <Container className="flex min-h-[62vh] items-center justify-center py-16">
        <div
          className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-md)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] md:p-9"
          aria-hidden="true"
        >
          <Skeleton variant="heading" width="10rem" />
          <div className="mt-6 space-y-4">
            <Skeleton variant="text" width="6rem" />
            <Skeleton variant="text" />
            <Skeleton variant="text" width="7rem" />
            <Skeleton variant="text" />
            <Skeleton variant="card" height="2.75rem" />
          </div>
        </div>
        <span className="sr-only">Loading sign-in</span>
      </Container>
    </div>
  );
}
