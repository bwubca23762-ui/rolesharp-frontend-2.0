import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/ui/primitives";
import { WorkflowPipelineBar } from "@/components/workspace/WorkflowPipelineBar";
import ConnectionPanel from "./connection-panel";

export const metadata: Metadata = { title: "Email Connection — Auto Apply", robots: { index: false, follow: false } };

export default function EmailConnectionPage() {
  return (
    <WorkspaceShell
      eyebrow="Separate permission"
      title="Connect an application mailbox"
      description="Your RoleSharp login and sending mailbox remain separate permissions. Connect only when you want to send posting-backed application emails."
    >
      <WorkflowPipelineBar currentHref="/email-connection" />
      <ConnectionPanel />
    </WorkspaceShell>
  );
}
