import type { Metadata } from "next";
import BuildSeo from "../build-seo";
import GuideBreadcrumb from "@/app/guide-breadcrumb";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "How the AI resume builder works",
  description:
    "Learn how RoleSharp's AI resume builder uses your target company, role, job description, and real experience to create an ATS-ready PDF or DOCX.",
  alternates: { canonical: "/build/help" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "How the AI resume builder works | RoleSharp",
    description:
      "Learn how RoleSharp builds an ATS-optimized resume tailored to one specific job in four steps.",
    url: "/build/help",
  },
};

export default function BuildHelpPage() {
  return (
    <>
      <GuideBreadcrumb
        toolName="AI Resume Builder"
        toolPath="/build"
        guideName="How the AI resume builder works"
        guidePath="/build/help"
      />
      <div className="border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)]">
        <Container className="py-3">
          <a
            href="/build"
            className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            ← Back to builder
          </a>
        </Container>
      </div>
      <BuildSeo />
    </>
  );
}
