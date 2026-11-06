import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import { seoRoleList } from "@/lib/db";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { Container, Section, MarketingShell, Breadcrumb } from "@/components/ui/primitives";
import { DirectoryMethodCard, RelatedWorkflow } from "@/components/marketing";
import RolesPage from "./RolesPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resume Guides by Role & ATS Templates (2026)",
  description: "Browse free, ATS-optimized resume guides by role. Pick your target job and build a resume that matches the exact job description.",
  alternates: { canonical: "/roles" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Resume Guides by Role — Free ATS Templates & Examples",
    description: "Find role-specific resume guides, keywords, and examples for the job you want next.",
    url: "/roles",
  },
};

export default async function RolesIndex() {
  const roles = await seoRoleList(200).catch(() => []);
  return (
    <MarketingShell className="reading-shell">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: "/" },
          { name: "Roles", item: "/roles" },
        ])}
      />
      <section className="reading-masthead">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Roles" }]} />
          <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.03em] text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-6 max-w-3xl">
            Resume guides for your role
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-8">
            Find a target role, review curated skill and structure guidance, then verify every keyword against the real job description before tailoring your resume.
          </p>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          <h2 className="mb-4 text-2xl font-bold text-[var(--fg)]">Roles</h2>
          <RolesPage roles={roles} />
          <nav aria-label="Resume tools" className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
            <a href="/resume-builder" className="reading-text-link">Build a role-tailored resume</a>
            <a href="/resume-examples" className="reading-text-link">Browse resume examples</a>
          </nav>
        </Container>
      </Section>

      <Section asContainer={false} size="sm" alt>
        <Container>
          <DirectoryMethodCard
            title="Role guidance is a maintained taxonomy, not a universal hiring checklist."
            description="Titles, skills, and resume structures vary across employers and markets. RoleSharp uses role pages to organize starting points while the live job posting remains the source of truth."
            items={[
              { kind: "curated", detail: "Role names and related pages come from RoleSharp's maintained taxonomy." },
              { kind: "database", detail: "Directory availability reflects the current catalog, not labor-market demand." },
              { kind: "guidance", detail: "Suggested skills are general prompts to verify against a real opening." },
              { kind: "illustrative", detail: "Example bullets demonstrate structure and must not be copied as personal facts." },
            ]}
          />
        </Container>
      </Section>

      <RelatedWorkflow
        eyebrow="Verify the role context"
        title="Use the role guide to orient yourself, then tailor against one real job."
        description="Paste the actual description so the builder can keep relevant terms connected to evidence you supplied."
        href="/build"
        cta="Tailor to a job description"
        secondary={{ href: "/jobs", label: "Find current jobs" }}
      />
    </MarketingShell>
  );
}
