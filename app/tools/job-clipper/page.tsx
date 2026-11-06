import type { Metadata } from "next";
import { ToolShell, Card } from "@/components/ui/primitives";
import JobClipperClient from "./job-clipper-client";
import JsonLd from "../../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Job Clipper \u2014 Save Jobs to Your Workspace",
  description:
    "Save a job posting title, link and text to your RoleSharp workspace with a bookmarklet. Continue with resume matching or tailoring. Free to use.",
  alternates: { canonical: "/tools/job-clipper" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Job Clipper | RoleSharp",
    description: "One click on any job posting sends it to your RoleSharp workspace. Free.",
    url: "/tools/job-clipper",
  },
};

export default function JobClipperPage() {
  return (
    <ToolShell
      eyebrow="Free — no account"
      title="Clip any job posting into your workspace"
      subtitle="Install a bookmarklet once. On any careers page, one click grabs the posting — title, link, and text — and lands it in your workspace as the job description, ready for the match checker and the builder. The clip runs in your browser; no posting is stored server-side."
      workspaceSize="default"
    >
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: "Job Clipper", item: "/tools/job-clipper" }])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "RoleSharp Job Clipper",
          url: `${env.siteUrl}/tools/job-clipper`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          browserRequirements: "Requires JavaScript",
          description: "A bookmarklet that sends any job posting into your RoleSharp workspace as the job description. Free.",
          offers: { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        }}
      />
      <JobClipperClient siteUrl={env.siteUrl} />
      <Card className="mt-6 p-5">
        <h2 className="m-0 text-base font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">How the clip lands</h2>
        <ol className="mt-2 mb-0 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          <li>The bookmarklet grabs the page title, the posting URL, and the visible text (or just your selection, if you have one) — capped at 8,000 characters.</li>
          <li>It opens /build with the posting encoded in the link, and the workspace puts it in the job-description slot.</li>
          <li>From there: run the match checker against your resume, then tailor with the builder — same draft, no copy-pasting between tabs.</li>
        </ol>
      </Card>
    </ToolShell>
  );
}
