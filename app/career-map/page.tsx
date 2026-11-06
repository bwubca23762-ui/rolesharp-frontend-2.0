import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { listRolesWithSkills } from "@/lib/db";
import { env } from "@/lib/env";
import { listDevRolesWithSkills } from "@/lib/local-dev-store";
import { neighbours, skillsOf, skillsThatDoNotTravel, type MapRole } from "@/lib/career-map";
import RoleFilter from "./role-filter";
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  SectionHeader,
  ToolShell,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Explore roles that share your existing skills and identify gaps using occupational skill data. Compare career paths without invented timelines.";

export const metadata: Metadata = {
  title: "Career Map — Roles That Share Your Skills",
  description: DESCRIPTION,
  alternates: { canonical: "/career-map" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Career Map — Roles That Share Your Skills | RoleSharp",
    description: DESCRIPTION,
    url: "/career-map",
  },
};

function Chip({ children, tone = "muted" }: { children: string; tone?: "shared" | "muted" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${
        tone === "shared"
          ? "border-[var(--color-primary-100)] bg-[var(--color-primary-50)] text-[var(--primary)] font-semibold"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-fg)]"
      }`}
    >
      {children}
    </span>
  );
}

async function loadRoles(): Promise<MapRole[]> {
  const rows = env.localDevMode
    ? await listDevRolesWithSkills(60).catch(() => [])
    : await listRolesWithSkills(60).catch(() => []);
  return rows as MapRole[];
}

export default async function CareerMapPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role: requested } = await searchParams;
  const roles = await loadRoles();
  const selected = roles.find((r) => r.slug === requested) ?? roles[0] ?? null;
  const found = selected ? neighbours(selected, roles) : [];
  const stranded = selected ? skillsThatDoNotTravel(selected, found) : [];

  return (
    <ToolShell
      eyebrow="Career Mobility Map · Free"
      title="Roles that share your skills"
      subtitle="Pick the role you do now. See adjacent roles that ask for the same skills, what carries over, and what you would be missing."
      workspaceSize="large"
    >
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: "Career Map", item: "/career-map" }])} />
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Career Map" }]} />

      {roles.length === 0 ? (
        <Card padding="lg" className="mt-4">
          <p className="text-[var(--muted-fg)]">
            The role catalogue is unavailable right now. The{" "}
            <Link href="/roles" className="text-[var(--primary)] underline">role guides</Link>{" "}
            cover the same ground.
          </p>
        </Card>
      ) : (
        <div className="mt-4 space-y-6">
          <Card padding="md">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--muted-fg)]">
              {selected ? `Showing adjacent roles for ${selected.title} — switch role below` : "Start with the role you do now"}
            </h2>
            <RoleFilter roles={roles} selectedSlug={selected?.slug} />
          </Card>

          {selected && (
            <>
              <div>
                <SectionHeader
                  eyebrow={selected.sector ?? "Role"}
                  title={`What ${selected.title} shares with adjacent roles`}
                  description={`${selected.title} lists ${skillsOf(selected).length} core skills. Each role below shares overlapping skills you can highlight when pivoting.`}
                  className="mb-4"
                />

                {found.length === 0 ? (
                  <Card padding="lg">
                    <p className="text-[var(--muted-fg)]">
                      No other role in the catalogue lists any of this role&apos;s skills.
                    </p>
                  </Card>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {found.map((n) => (
                      <Card key={n.role.slug} padding="lg" className="border-l-4 border-[var(--primary)]">
                        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                          <h3 className="text-lg font-bold! text-[var(--fg)]">{n.role.title}</h3>
                          <Badge variant="primary">
                            {n.shared.length} shared {n.shared.length === 1 ? "skill" : "skills"}
                          </Badge>
                        </div>

                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-fg)]">
                          Carries over
                        </p>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {n.shared.map((skill) => (
                            <Chip key={skill} tone="shared">{skill}</Chip>
                          ))}
                        </div>

                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-fg)]">
                          {n.missing.length === 0 ? "Nothing listed that you would be missing" : "You would be missing"}
                        </p>
                        {n.missing.length > 0 ? (
                          <div className="mb-4 flex flex-wrap gap-1.5">
                            {n.missing.map((skill) => (
                              <Chip key={skill}>{skill}</Chip>
                            ))}
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-3">
                          <Button as="a" href={`/build#role=${encodeURIComponent(n.role.title)}`} size="sm">
                            🎯 Tailor Resume
                          </Button>
                          <Button as="a" href={`/skill-gap`} size="sm" variant="outline">
                            📊 Check Skill Gap
                          </Button>
                          <Button as="a" href={`/roles/${n.role.slug}`} size="sm" variant="outline">
                            📖 Role Guide
                          </Button>
                          <Button as="a" href={`/career-map?role=${n.role.slug}`} size="sm" variant="ghost">
                            🗺 Map From Here
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {stranded.length > 0 && (
                <Card padding="md">
                  <h2 className="mb-1 text-base font-bold! text-[var(--fg)]">What does not travel</h2>
                  <p className="mb-3 text-xs leading-5 text-[var(--muted-fg)]">
                    No adjacent role above lists these specialist skills — keep them compact when pivoting.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {stranded.map((skill) => (
                      <Chip key={skill}>{skill}</Chip>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </ToolShell>
  );
}
