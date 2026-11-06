import type { Metadata } from "next";
import { Button, Card, WorkspaceShell } from "@/components/ui/primitives";
import { pauseDailyMatchesByToken } from "@/lib/jobs-workflow/digests";

export const metadata: Metadata = {
  title: "Pause Daily Matches",
  robots: { index: false, follow: false },
};

// The digest email links here with a signed ?token=. This is a one-click
// unsubscribe: the HMAC-signed, expiring token IS the authorization, so a GET
// is appropriate (email links can't POST). The pause is idempotent — pausing an
// already-paused campaign simply reports no change.
export const dynamic = "force-dynamic";

export default async function DailyMatchesUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const paused = typeof token === "string" && token.length > 0
    ? await pauseDailyMatchesByToken(token)
    : false;

  return (
    <WorkspaceShell showHeader={false}>
      <Card padding="lg" className="mx-auto mt-16 max-w-md text-center">
        {paused ? (
          <>
            <h1 className="text-2xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              Daily Matches paused
            </h1>
            <p className="mt-3 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              You will not receive any more daily match emails. You can turn them
              back on at any time from your Daily Matches settings.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              This link is invalid or has expired
            </h1>
            <p className="mt-3 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Unsubscribe links are valid for 90 days and work once. If Daily
              Matches are still active, you can pause them from your account.
            </p>
          </>
        )}
        <div className="mt-6">
          <Button as="a" href="/daily-matches">Manage Daily Matches</Button>
        </div>
      </Card>
    </WorkspaceShell>
  );
}
