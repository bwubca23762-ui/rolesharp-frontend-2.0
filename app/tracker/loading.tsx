import { Container } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";

// Application tracker shell: header + a list of application rows.
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
          <Skeleton variant="heading" width="13rem" />
          <Skeleton variant="text" width="24rem" />
        </div>

        <div className="space-y-3" aria-hidden="true">
          <Skeleton variant="table-row" count={5} />
        </div>

        <span className="sr-only">Loading application tracker</span>
      </Container>
    </div>
  );
}
