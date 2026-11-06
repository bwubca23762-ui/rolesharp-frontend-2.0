import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import SocialRewardModal from "@/components/SocialRewardModal";
import { Badge, Card, Container, MarketingShell, PageHeader } from "@/components/ui/primitives";
import { Check, Coins, Shield } from "@/app/icons";

export const metadata: Metadata = {
  title: "Free Rewards — Interview Credits and Daily Matches",
  description: "Follow RoleSharp on LinkedIn, X, and Instagram for interview credits. Attest to all three follows to activate a free Daily Matches trial when matching is enabled.",
  alternates: { canonical: "/social-rewards" },
  openGraph: { type: "website", url: "/social-rewards", images: ["/opengraph-image"] },
};

export default function SocialRewardsPage() {
  const base = new URL("https://rolesharp.com");
  const breadcrumb = breadcrumbLd([
    { name: "Home", item: base.toString() },
    { name: "Free credits event", item: `${base}social-rewards` },
  ]);

  return (
    <MarketingShell className="growth-page growth-program">
      <JsonLd data={breadcrumb} />
      <header className="relative border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
        <Container className="py-12 md:py-16">
          <PageHeader
            eyebrow="Free credits event"
            title="Earn interview practice credits"
            description="Follow RoleSharp on LinkedIn, X, and Instagram, then submit your channel rewards. When staff review is enabled, credits arrive after approval. The Daily Matches trial begins only when you choose to activate it."
            meta={<Link href="/pricing" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">Compare free and paid plans</Link>}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Card variant="outline" padding="sm" as="article"><Coins size={18} className="text-[var(--primary)]" /><strong className="mt-2 block">Channel credits</strong><span className="mt-1 block text-sm text-[var(--muted-fg)]">One reward per channel, credited when your claim is approved.</span></Card>
            <Card variant="outline" padding="sm" as="article"><Check size={18} className="text-[var(--primary)]" /><strong className="mt-2 block">You choose the start</strong><span className="mt-1 block text-sm text-[var(--muted-fg)]">The free Daily Matches trial starts only when you choose to activate it.</span></Card>
            <Card variant="outline" padding="sm" as="article"><Shield size={18} className="text-[var(--primary)]" /><strong className="mt-2 block">What we ask for</strong><span className="mt-1 block text-sm text-[var(--muted-fg)]">You confirm each follow yourself (self-attested, not independently verified). We never ask for a card or inbox access.</span></Card>
          </div>
        </Container>
      </header>

      <section className="py-12">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SocialRewardModal />
            <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Use a credit for interview practice</h2><Badge variant="neutral">No subscription</Badge></div>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                <li>Submit a channel claim. When approved, its reward lands in your account.</li>
                <li>Open any saved resume&apos;s interview practice panel.</li>
                <li>Choose <strong>Start full premium session (use 1 credit)</strong> — every question, custom STAR coaching, and AI voice evaluation unlocks for that whole session.</li>
              </ol>
            </div>
          </div>
        </Container>
      </section>
    </MarketingShell>
  );
}
