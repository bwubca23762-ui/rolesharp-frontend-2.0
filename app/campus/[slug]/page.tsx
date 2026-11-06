import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Button } from "@/components/ui/primitives";
import { campusPortalBySlug, campusCohortAggregate, CAMPUS_K_ANONYMITY } from "@/lib/campus";
import { currentUser } from "@/lib/auth";
import JsonLd from "../../json-ld";
import { breadcrumbLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const portal = await campusPortalBySlug(slug).catch(() => null);
  if (!portal) return { title: "Campus portal not found", robots: { index: false, follow: false } };
  return {
    title: `${portal.universityName} — Placement Cohort | RoleSharp`,
    description: `A private placement cohort for ${portal.universityName} students: anonymized, k-anonymized tracker aggregates from classmates who opted in by using their university email. Free.`,
    alternates: { canonical: `/campus/${slug}` },
  };
}

const STATUS_LABEL: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview stage",
  offer: "Offers",
  rejected: "Closed",
};

export default async function CampusPortalPage({ params }: Params) {
  const { slug } = await params;
  const portal = await campusPortalBySlug(slug).catch(() => null);
  if (!portal) {
    return (
      <main className="min-h-screen py-16">
        <div className="mx-auto max-w-xl px-4 text-center">
          <h1 className="text-2xl font-extrabold!">Campus portal not found</h1>
          <p className="mt-3 text-[var(--color-text-muted)]">This cohort link may have been retired. Ask your placement cell for the current one.</p>
        </div>
      </main>
    );
  }

  const user = await currentUser().catch(() => null);
  const isMember = Boolean(user?.email && user.email.toLowerCase().endsWith(`@${portal.emailDomain.toLowerCase().replace(/^@/, "")}`));
  const aggregate = await campusCohortAggregate(portal).catch(() => null);

  return (
    <main className="min-h-screen py-10 md:py-16">
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: portal.universityName, item: `/campus/${slug}` }])} />
      <div className="mx-auto max-w-3xl px-4">
        <p className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
          Campus placement cohort
        </p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)] font-extrabold! leading-[1.05]! tracking-[-0.02em]!">
          {portal.universityName}
        </h1>
        <p className="mt-4 text-lg leading-8 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          Classmates who use their @{portal.emailDomain.replace(/^@/, "")} email share an anonymized view of where the
          cohort stands in the application season — stages, not scores, and never individual records.
        </p>

        {!user ? (
          <Card className="mt-8 p-6">
            <h2 className="text-lg font-bold!">See your cohort&rsquo;s aggregate</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Log in with your university email and the cohort view unlocks automatically. Membership is derived from the
              email domain — there is no roster, and nothing is shared on your behalf.
            </p>
            <Button as="a" href={`/login?next=/campus/${slug}`} className="mt-4">
              Log in with your university email
            </Button>
          </Card>
        ) : !isMember ? (
          <Card className="mt-8 p-6">
            <h2 className="text-lg font-bold!">Different email domain</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              You are logged in, but your account email is not a @{portal.emailDomain.replace(/^@/, "")} address, so the
              cohort view stays closed. The aggregate only opens to verified university domains.
            </p>
          </Card>
        ) : aggregate ? (
          <Card className="mt-8 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold!">This season, in aggregate</h2>
              <Badge variant="outline">{aggregate.members} members</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Self-reported tracker stages from {aggregate.activeMembers} member{aggregate.activeMembers === 1 ? "" : "s"} — workflow records, not employer outcomes. No
              individual row is ever shown.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {aggregate.byStatus.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No applications recorded yet this season.</p>
              ) : (
                aggregate.byStatus.map((row) => (
                  <div key={row.status} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3 dark:border-[var(--color-dark-border)]">
                    <span className="text-sm font-semibold">{STATUS_LABEL[row.status] ?? row.status}</span>
                    <span className="text-lg font-extrabold! tabular-nums">{row.count}</span>
                  </div>
                ))
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Aggregates hide below {CAMPUS_K_ANONYMITY} members by design. Your own applications are visible only to you on{" "}
              <Link href="/tracker" className="underline">your tracker</Link>.
            </p>
          </Card>
        ) : (
          <Card className="mt-8 p-6">
            <h2 className="text-lg font-bold!">Cohort not open yet</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Aggregates appear once at least {CAMPUS_K_ANONYMITY} members join — below that, any breakdown could point
              back to individuals, so the page reports nothing instead.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}
