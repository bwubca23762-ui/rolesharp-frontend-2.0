import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { indexableSites } from "@/lib/db/personal-sites";
import { env } from "@/lib/env";
import { listDevIndexableSites } from "@/lib/local-dev-store";
import { Breadcrumb, Button, Card, Container, MarketingShell, PageHeader, Section } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Personal pages published with RoleSharp by people who chose to be listed. Each one is a résumé and portfolio on its own address.";

export const metadata: Metadata = {
  title: "Personal Pages Published with RoleSharp",
  description: DESCRIPTION,
  alternates: { canonical: "/u" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Personal Pages Published with RoleSharp | RoleSharp",
    description: DESCRIPTION,
    url: "/u",
  },
};

export default async function DirectoryPage() {
  // indexableSites() puts `indexable` in the WHERE. A page that is published
  // but not indexable is reachable by link and must never appear in a list a
  // crawler walks — that is the whole difference between the two switches.
  const sites = env.localDevMode
    ? await listDevIndexableSites().catch(() => [])
    : await indexableSites().catch(() => []);

  return (
    <MarketingShell>
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: "Personal pages", item: "/u" }])} />

      <section className="relative border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Personal pages" }]} />
          <PageHeader
            eyebrow="Published with RoleSharp"
            title="Personal pages"
            description="A résumé and portfolio on its own address, published by the person it belongs to. Only pages whose owner asked to be listed appear here."
            actions={<Button as="a" href="/settings?tab=website" size="lg">Publish yours</Button>}
            className="mb-0"
          />
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          {sites.length === 0 ? (
            <Card padding="lg">
              <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                No pages are listed yet. Publishing one takes a saved resume and a handle —{" "}
                <Link href="/settings?tab=website" className="text-[var(--color-primary)] underline">start here</Link>.
              </p>
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sites.map((site) => (
                <li key={site.handle}>
                  <Link
                    href={`/u/${site.handle}`}
                    className="block h-full rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] p-5 transition-colors hover:border-[var(--color-primary)]"
                  >
                    <p className="font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{site.display_name}</p>
                    {site.headline ? (
                      <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{site.headline}</p>
                    ) : null}
                    <p className="mt-3 text-xs text-[var(--color-primary)]">rolesharp.com/u/{site.handle}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </Section>
    </MarketingShell>
  );
}
