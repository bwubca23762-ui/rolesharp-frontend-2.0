import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/ui/primitives";
import { WorkflowPipelineBar } from "@/components/workspace/WorkflowPipelineBar";
import QueuePanel from "./queue-panel";

export const metadata: Metadata = { title: "Application Queue — Auto Apply", robots: { index: false, follow: false } };

export default function ApplicationQueuePage() {
  return (
    <WorkspaceShell showHeader={false}>
      <WorkflowPipelineBar currentHref="/application-queue" />
      <QueuePanel />
    </WorkspaceShell>
  );
}
