import type { Metadata } from "next";
import { bankEligibleRoles } from "@/lib/interview-bank";
import { Card, ToolShell, Button } from "@/components/ui/primitives";
import RoleBankExplorer from "./role-bank-explorer";

export const metadata: Metadata = {
  title: "Interview Question Bank — Practice Questions by Role",
  description:
    "Browse role-specific interview questions and prepare answers grounded in your experience. Explore practical prompts for your next interview.",
  openGraph: { type: "website" as const, url: "/interview-questions", images: ["/opengraph-image"] },
  alternates: { canonical: "/interview-questions" },
};

export const dynamic = "force-dynamic";

export default async function InterviewBankIndex() {
  let roles: Array<{ slug: string; title: string }> = [];
  try {
    roles = await bankEligibleRoles(60);
  } catch {}

  return (
    <ToolShell
      eyebrow="Interview question bank"
      title="Interview questions for your role."
      subtitle="Browse behavioral, technical, and situational questions by job title. Each prompt explains what to demonstrate in your answer."
      workspaceSize="large"
    >
      {roles.length > 0 ? (
        <RoleBankExplorer roles={roles} />
      ) : (
        <Card className="mx-auto max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight">Role question banks are unavailable</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-fg)]">
            You can still practise questions based on a saved resume.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button as="a" href="/interview-prep" size="sm">
              Practise with a resume
            </Button>
            <Button as="a" href="/build" variant="outline" size="sm">
              Tailor a resume
            </Button>
          </div>
        </Card>
      )}
    </ToolShell>
  );
}
