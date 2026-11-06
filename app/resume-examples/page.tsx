import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import Link from "next/link";
import { seoRoleList } from "@/lib/db";
import JsonLd from "../json-ld";
import { ChevronRight } from "../icons";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { Badge, Breadcrumb, Button, Card, Container, Eyebrow, MarketingShell, Section } from "@/components/ui/primitives";
import { DirectoryEvidenceNote, DirectoryMethodCard, RelatedWorkflow } from "@/components/marketing";

// /resume-examples — programmatic SEO hub: resume examples by role.
// Reuses the roles dataset; each role links to /roles/[slug].
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Free Resume Examples by Role (2026)",
  description:
    "Browse illustrative resume structures and curated guidance for software engineers, product managers, data analysts, designers, and more.",
  alternates: { canonical: "/resume-examples" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Illustrative Resume Guidance by Role | RoleSharp",
    description: "Explore fictional structures, skill themes, and bullet patterns by role, then adapt them to your own evidence and target job.",
    url: "/resume-examples",
  },
};

const EXAMPLE_GUIDES = [
  {
    href: "/blog/resume-action-verbs-that-sound-strong",
    title: "Resume action verbs that sound stronger",
    body: "Useful when the example structure is fine but your bullets still feel passive.",
  },
  {
    href: "/blog/ats-friendly-resume-without-sounding-generic",
    title: "How to make an ATS-friendly resume without sounding generic",
    body: "A good follow-up when you want examples that still sound specific and human.",
  },
  {
    href: "/blog/fix-old-resume-or-build-new",
    title: "Fix an old resume or build a new one?",
    body: "Decide whether your existing draft is worth repairing before starting over.",
  },
] as const;

export default async function ResumeExamplesPage() {
  const roles = await seoRoleList(80).catch(() => []);
  const featuredRoles = roles.slice(0, 12);

  return (
    <MarketingShell className="growth-page growth-library">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: `${env.siteUrl}/` },
          { name: "Resume Examples", item: `${env.siteUrl}/resume-examples` },
        ])}
      />

      {/* PageHero-style header */}
      <header className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-[var(--color-primary)]/10 blur-3xl"
        />
        <Container className="relative z-10 py-12 md:py-16">
          <div className="max-w-3xl">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Resume Examples" }]} />
            <Eyebrow>Examples</Eyebrow>
            <h1 className="mt-3 text-3xl md:text-[2.6rem] font-bold leading-[1.08] tracking-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              Illustrative resume guidance, organized by role.
            </h1>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl">
              Explore curated role structures, common skill themes, and fictional bullet patterns you can adapt to your own evidence. These guides are starting points—not verified employer requirements or promised outcomes.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button as="a" href="/resume-builder" size="lg">
                Build a resume — free
              </Button>
              <Button as="a" href="/roles" variant="outline" size="lg">
                Browse all roles
              </Button>
            </div>
          </div>
        </Container>
      </header>

      {featuredRoles.length > 0 && (
        <Section asContainer={false} size="sm">
          <Container>
            <div className="mb-8 reveal-on-scroll">
              <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
                Popular role guidance
              </h2>
              <p className="max-w-2xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                Start with the featured role guides, then browse the full maintained taxonomy below if your job title is more specific. Featured placement is navigation, not evidence of labor-market demand.
              </p>
            </div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 list-none p-0 m-0">
              {featuredRoles.map((role, i) => (
                <li key={role.slug} className="reveal-on-scroll" style={{ transitionDelay: `${(i % 4) * 40}ms` }}>
                  <Link
                    href={`/roles/${role.slug}`}
                    className="growth-library-link group flex h-full items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] p-4 transition-colors hover:border-[var(--color-primary)]/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                        {role.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                        Illustrative role guide
                      </span>
                    </span>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      <Section asContainer={false} size="sm" alt>
        <Container>
          <div className="mb-6 reveal-on-scroll">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              Role guidance directory
            </h2>
          </div>
          {roles.length === 0 ? (
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Examples are loading. Check back shortly, or{" "}
              <Link href="/resume-templates" className="font-semibold">browse templates</Link>.
            </p>
          ) : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0">
              {roles.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/roles/${r.slug}`}
                    className="growth-library-link block p-3 rounded-[var(--radius-lg)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] text-sm font-medium text-[var(--color-text)] dark:text-[var(--color-dark-text)] hover:border-[var(--color-primary)] transition-colors"
                  >
                    {r.title} guidance
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container>
          <DirectoryMethodCard
            title="Role pages are guidance, not reviewed customer outcomes."
            description="The directory organizes reusable starting points. It does not claim that a fictional bullet, generic skill, or role label reflects a specific employer's hiring process."
            items={[
              { kind: "curated", detail: "Role names come from RoleSharp's maintained role taxonomy." },
              { kind: "guidance", detail: "Skill and keyword themes must be checked against the actual job posting." },
              { kind: "illustrative", detail: "Example bullets and metrics are fictional patterns, never facts to copy as your own." },
              { kind: "database", detail: "Directory availability reflects the current RoleSharp catalog, not job-market demand or success rates." },
            ]}
          />
          <DirectoryEvidenceNote
            kind="illustrative"
            detail="Use the structure as a prompt, then replace every claim with evidence you can support."
            className="mt-5"
          />
        </Container>
      </Section>

      <Section asContainer={false} size="sm" alt>
        <Container>
          <div className="reveal-on-scroll">
            <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
              Guides to use with the examples
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {EXAMPLE_GUIDES.map((guide) => (
                <Link key={guide.href} href={guide.href} className="group block h-full">
                  <Card variant="elevated" padding="md" className="h-full lift transition-colors hover:border-[var(--color-primary)]">
                    <Badge variant="outline" className="mb-3">Guide</Badge>
                    <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                      {guide.title}
                    </b>
                    <span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                      {guide.body}
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <RelatedWorkflow
        eyebrow="Apply the guidance"
        title="Move from a fictional pattern to a resume grounded in your own work."
        description="Use a real job description and supportable experience in the builder, or choose a document structure in the manual maker before writing."
        href="/build"
        cta="Tailor to a real job"
        secondary={{ href: "/resume-maker", label: "Choose a template" }}
      />
    </MarketingShell>
  );
}
