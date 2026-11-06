import type { Metadata } from "next";
import Link from "next/link";
import { seoRoleList } from "@/lib/db";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { Breadcrumb, Button, Card, Container, MarketingShell, Section } from "@/components/ui/primitives";

// /careers — programmatic SEO hub: career guides by job title.
// Reuses the roles dataset. Each role links to /roles/[slug] (the existing
// role-tailored resume guide) so this hub funnels into real pages.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Career and Resume Guides by Role",
  description:
    "Explore career paths, in-demand skills, and ATS resume advice for software engineers, product managers, analysts, designers, and more.",
  // /careers and /roles are the same hub: both read seoRoleList() and both link
  // to the same /roles/[slug] children, with near-identical titles. Self-
  // canonicalising made this an orphan duplicate — indexable, in no sitemap,
  // and linked from nowhere — which splits ranking signals between two URLs and
  // spends crawl budget the volume discipline in lib/db.ts exists to protect.
  // /roles is the one already in the sitemap and already linked from the
  // footer, so it is the canonical of the pair. This page keeps working for
  // anyone who reaches it directly; it just stops competing with itself.
  alternates: { canonical: "/roles" },
  openGraph: {
    title: "Career Guides by Job Title — Free ATS Resume Advice",
    description: "Free career and resume guides by role. Find your target job and build a resume that matches.",
    url: "/careers",
  },
};

export default async function CareersPage() {
  const roles = await seoRoleList(80).catch(() => []);
  const featuredRoles = roles.slice(0, 12);

  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: `${env.siteUrl}/` },
          { name: "Careers", item: `${env.siteUrl}/careers` },
        ])}
      />

      <section className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)]">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Careers" }]} />
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-6 max-w-3xl">
            Career guides by job title
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-8">
            Find the role you&rsquo;re going for and get a resume built around the keywords, skills, and bullet points
            hiring managers in that role look for first. Each guide tailors to the specific job and country.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button as="a" href="/build" size="lg">
              Build a tailored resume
            </Button>
            <Button as="a" href="/resume-examples" variant="outline" size="lg">
              See resume examples
            </Button>
          </div>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          {featuredRoles.length > 0 && (
            <Card className="mb-6" padding="md">
              <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
                Start with popular career guides
              </h2>
              <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mb-5">
                These are the role pages most likely to match broad search intent before a visitor narrows into a specific employer or market.
              </p>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0">
                {featuredRoles.map((role) => (
                  <li key={role.slug}>
                    <Link
                      href={`/roles/${role.slug}`}
                      className="block p-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] text-sm font-medium text-[var(--color-text)] dark:text-[var(--color-dark-text)] hover:border-[var(--color-primary)] transition-colors"
                    >
                      {role.title} career guide
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="mb-6" padding="md">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Browse roles
            </h2>
            {roles.length === 0 ? (
              <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Role guides are loading. Check back shortly, or{" "}
                <Link href="/build" className="font-semibold">build a resume now</Link>.
              </p>
            ) : (
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0">
                {roles.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/roles/${r.slug}`}
                      className="block p-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] text-sm font-medium text-[var(--color-text)] dark:text-[var(--color-dark-text)] hover:border-[var(--color-primary)] transition-colors"
                    >
                      {r.title} resume guide
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mb-6" padding="md">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
              How to use these guides
            </h2>
            <ul className="space-y-3">
              {[
                "Pick the role closest to the job you’re applying for.",
                "The guide shows the keywords and skills hiring managers in that role prioritize.",
                "Build a resume tailored to that role and a specific company with the AI resume builder.",
                "Score it against the job description with the ATS resume checker before you send it.",
              ].map((text) => (
                <li key={text} className="flex items-start gap-3 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mt-2 shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card padding="md">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Start with the right tool
            </h2>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
              Once you know the role, use the <Link href="/resume-builder" className="font-semibold">AI resume builder</Link>, the{" "}
              <Link href="/checker" className="font-semibold">ATS checker</Link>, the{" "}
              <Link href="/resume-examples" className="font-semibold">resume examples hub</Link>, the{" "}
              <Link href="/cover-letter-examples" className="font-semibold">cover letter examples hub</Link>, and the{" "}
              <Link href="/compare" className="font-semibold">comparison pages</Link>.
            </p>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
