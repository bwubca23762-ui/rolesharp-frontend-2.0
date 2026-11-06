"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "@/app/icons";
import { Button, Container } from "@/components/ui/primitives";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("RoleSharp settings route error", error);
  }, [error]);

  return (
    <main className="min-h-[62vh] border-b border-[var(--color-border)] bg-[var(--color-bg)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-bg)]">
      <Container className="flex min-h-[62vh] items-center justify-center py-16">
        <section
          className="w-full max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 text-center shadow-[var(--shadow-md)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] md:p-10"
          role="alert"
          aria-labelledby="settings-error-title"
        >
          <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-[var(--color-danger)] dark:bg-red-950/30">
            <AlertTriangle size={26} />
          </span>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
            Temporary interruption
          </p>
          <h1
            id="settings-error-title"
            className="text-2xl font-bold! tracking-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)] md:text-3xl"
          >
            Account settings could not finish loading.
          </h1>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Your account and plan are unchanged. Retry to reopen settings, or return to the dashboard.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={reset} leftIcon={<RefreshCw size={17} />}>
              Try again
            </Button>
            <Button as="a" href="/dashboard" variant="outline">
              Back to dashboard
            </Button>
          </div>
        </section>
      </Container>
    </main>
  );
}
