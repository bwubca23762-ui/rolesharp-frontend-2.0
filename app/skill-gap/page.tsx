import SkillGapTool from "./skill-gap-tool";
import { ToolShell, Breadcrumb, Card } from "@/components/ui/primitives";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { listRolesWithSkills } from "@/lib/db";
import { listDevRolesWithSkills } from "@/lib/local-dev-store";
import { env } from "@/lib/env";
import Link from "next/link";

export const metadata = {
  title: "Skill Gap Check — Free, No Account",
  description:
    "Compare your resume with a target role to identify supported skills, missing evidence and learning needs. Free to use without an account.",
  openGraph: { type: "website" as const, url: "/skill-gap", images: ["/opengraph-image"] },
  alternates: { canonical: "/skill-gap" },
};

export default async function SkillGapPage(): Promise<React.ReactElement> {
  const rows = env.localDevMode
    ? await listDevRolesWithSkills(60).catch(() => [])
    : await listRolesWithSkills(60).catch(() => []);
  const roles = rows.map(({ slug, title }) => ({ slug, title }));

  return (
    <ToolShell
      eyebrow="Free tool, no account"
      title="Skill gap check"
      subtitle="Most of what reads as being unqualified is being undocumented. This splits the two: what the target role wants and your resume shows, what your current role already does and your resume never mentions, and what genuinely is not there yet."
      workspaceSize="large"
    >
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: "Skill Gap Check", item: "/skill-gap" }])} />
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Skill Gap Check" }]} />

      {roles.length === 0 ? (
        <Card padding="lg">
          <p className="text-[var(--muted-fg)]">
            The role catalogue is unavailable right now. The{" "}
            <Link href="/checker" className="text-[var(--primary)] underline">resume checker</Link>{" "}
            scores against a target role you type in.
          </p>
        </Card>
      ) : (
        <SkillGapTool roles={roles} />
      )}
    </ToolShell>
  );
}
