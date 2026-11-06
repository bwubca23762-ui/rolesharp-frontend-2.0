import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Alerts — Get New Postings in Your Inbox",
  description: "Set up job alerts for your target role and country. Premium gets daily alerts, Free gets weekly. Unsubscribe anytime.",
  openGraph: { type: "website" as const, url: "/job-alerts", images: ["/opengraph-image"] },
  alternates: { canonical: "/job-alerts" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
