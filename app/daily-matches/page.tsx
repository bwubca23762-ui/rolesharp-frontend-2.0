import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/ui/primitives";
import { WorkflowPipelineBar } from "@/components/workspace/WorkflowPipelineBar";
import DailyMatchesClient from "./daily-matches-client";

export const metadata: Metadata = {
  title: "Daily Job Matches",
  description: "Review your private daily job-match snapshots, evidence-based fit explanations, digest history, and delivery settings.",
  alternates: { canonical: "/daily-matches" },
  robots: { index: false, follow: false },
};

export default function DailyMatchesPage() {
  return (
    <WorkspaceShell showHeader={false}>
      <WorkflowPipelineBar currentHref="/daily-matches" />
      <DailyMatchesClient />
    </WorkspaceShell>
  );
}
