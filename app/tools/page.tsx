import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { FaqSection } from "@/app/seo-blocks";
import { TOOLS } from "@/lib/tools-registry";
import { Button, Container, MarketingShell, PageHeader, Section, SectionHeader } from "@/components/ui/primitives";
import { env } from "@/lib/env";
import ToolsCatalogue from "./tools-catalogue";

export const metadata: Metadata = {
  title: "Career Tools for Resumes, Jobs and Interviews",
  description: "Explore six workspaces for resume checks, job matching, writing, salary research and interview practice. Free and Premium tools are marked.",
  alternates: { canonical: "/tools" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp Free Career Tools",
    description: `${TOOLS.length} career tools to check, build, research, and prepare, with access requirements clearly marked.`,
    url: "/tools",
  },
};

const FAQ_ITEMS: [string, string][] = [
  ["Do I need an account to use these tools?", "Many tools work without an account. Tools marked Premium access require sign-in and the access described on the tool page."],
  ["Are the tools really free?", "The catalogue includes free tools and Premium features. Check the access badge on each tool before you start."],
  ["Can I embed a RoleSharp tool on my own site?", "Yes. Visit /tools/embed-ats-checker for the free ATS widget and embedding instructions."],
  ["Do these tools store my resume?", "Some tools keep a resume draft in this browser so you can continue across tools. Saved account resumes and uploaded files are handled as described in the privacy policy."],
];

export default function ToolsPage() {
  const base = env.siteUrl;
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${base}/tools#page`,
    url: `${base}/tools`,
    name: "RoleSharp Free Career Tools",
    description: "RoleSharp resume and job-search tools, with free and Premium access clearly marked in one catalogue.",
    isPartOf: { "@id": `${base}/#website` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: TOOLS.map((tool, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: tool.name,
        url: `${base}${tool.href}`,
      })),
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Free Tools", item: `${base}/tools` },
    ],
  };

  return (
    <MarketingShell>
      <JsonLd data={[collectionLd, breadcrumbLd]} />

      <header className="relative border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
        <Container className="py-6 md:py-8">
          <PageHeader
            eyebrow="Career tools"
            title="Find the right career tool"
            description="Build a resume, compare it with a job, prepare for an interview, or work through an offer."
            actions={<><Button as="a" href="/checker">Run the ATS checker</Button><Button as="a" href="#catalogue" variant="outline">Browse all tools</Button></>}
          />
        </Container>
      </header>

      <Section id="catalogue" asContainer={false} className="scroll-mt-24">
        <Container>
          <SectionHeader title="Tool directory" description="Search across six workspaces. Each tool is marked Free or Premium." />
          <ToolsCatalogue />
        </Container>
      </Section>

      <FaqSection heading="Free tools, quick answers" faqs={FAQ_ITEMS} />
    </MarketingShell>
  );
}
