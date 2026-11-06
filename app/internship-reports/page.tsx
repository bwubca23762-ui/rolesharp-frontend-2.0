import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { env } from "@/lib/env";
import InternshipReportsBoard from "./reports-board";
import { MarketingShell } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Internship Scam Reports — Community Safety Board",
  description: "Browse moderated community reports about suspicious internship offers, upfront fees, fake letters, data theft, and unpaid work. Report a concern safely.",
  alternates: { canonical: "/internship-reports" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp Internship Safety Board",
    description: "Moderated community reports that help students spot risky internship offers before sharing money or personal data.",
    url: "/internship-reports",
  },
};

export default function InternshipReportsPage() {
  return (
    <MarketingShell className="bg-[var(--color-bg)] dark:bg-[var(--color-dark-bg)]">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "RoleSharp Internship Safety Board",
        url: `${env.siteUrl}/internship-reports`,
        description: "A moderated community board for reports about potentially unsafe internship offers.",
        isPartOf: { "@type": "WebSite", name: "RoleSharp", url: env.siteUrl },
      }} />
      <InternshipReportsBoard />
    </MarketingShell>
  );
}
