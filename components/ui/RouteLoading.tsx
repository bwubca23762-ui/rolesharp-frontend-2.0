import { FileText, Sparkles } from "@/app/icons";
import { Container } from "@/components/ui/primitives";

// A div, not a <main>. This is the Suspense fallback for seven routes whose
// pages each render their own <main> (via WorkspaceShell, ToolShell, or their own tag),
// and Next streams the fallback and the resolved page into ONE document — so a
// <main> here put two main landmarks in the served HTML of every one of them.
// The live region and busy state belong on the fallback and stay here.
export default function RouteLoading() {
  return (
    <div
      className="min-h-[62vh] border-b border-[var(--color-border)] bg-[var(--color-bg)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-bg)]"
      aria-busy="true"
      aria-live="polite"
    >
      <Container className="flex min-h-[62vh] items-center justify-center py-16">
        <div className="w-full max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-md)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] md:p-9">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]">
              <FileText size={21} />
            </span>
            <div>
              <p className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                Preparing your workspace
              </p>
              <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Loading the latest RoleSharp tools and saved work.
              </p>
            </div>
            <Sparkles className="ml-auto text-[var(--color-primary)] motion-safe:animate-pulse" size={20} />
          </div>

          <div className="space-y-3" aria-hidden="true">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--color-surface-3)] motion-reduce:animate-none dark:bg-[var(--color-dark-surface-2)]" />
            <div className="h-20 animate-pulse rounded-xl bg-[var(--color-surface-2)] motion-reduce:animate-none dark:bg-[var(--color-dark-surface-2)]" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-10 animate-pulse rounded-lg bg-[var(--color-surface-2)] motion-reduce:animate-none dark:bg-[var(--color-dark-surface-2)]" />
              <div className="h-10 animate-pulse rounded-lg bg-[var(--color-surface-2)] motion-reduce:animate-none dark:bg-[var(--color-dark-surface-2)]" />
              <div className="h-10 animate-pulse rounded-lg bg-[var(--color-surface-2)] motion-reduce:animate-none dark:bg-[var(--color-dark-surface-2)]" />
            </div>
          </div>

          <span className="sr-only">Loading RoleSharp</span>
        </div>
      </Container>
    </div>
  );
}
