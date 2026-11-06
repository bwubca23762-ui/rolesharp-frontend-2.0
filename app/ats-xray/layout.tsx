import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ATS Parser X-Ray & Keyword Frequency Matrix — Free",
  description:
    "Inspect how a simulated ATS parser reads your resume and compare keyword frequency with a job description. Free to use without an account.",
  openGraph: { type: "website" as const, url: "/ats-xray", images: ["/opengraph-image"] },
  alternates: {
    canonical: "/ats-xray",
    types: { "text/markdown": "/tools/ats-xray.md" },
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
