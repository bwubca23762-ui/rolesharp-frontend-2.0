import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/ui/primitives";
import { WorkflowPipelineBar } from "@/components/workspace/WorkflowPipelineBar";
import CampaignSettingsClient from "./campaign-settings-client";

export const metadata: Metadata = {
  title: "Job Campaign Settings",
  description: "Configure your private career profile, Daily Matches preferences, Auto Apply thresholds, sender, consent, and daily limits.",
  alternates: { canonical: "/campaign-settings" },
  robots: { index: false, follow: false },
};

export default function CampaignSettingsPage() {
  return (
    <WorkspaceShell showHeader={false}>
      <WorkflowPipelineBar currentHref="/campaign-settings" />
      <CampaignSettingsClient />
    </WorkspaceShell>
  );
}
