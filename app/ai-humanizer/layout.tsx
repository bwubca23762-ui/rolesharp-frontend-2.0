import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI-Touch Remover & Resume Humanizer — Free",
  description:
    "Remove invisible characters and repetitive AI-style phrases from your resume. Compare edits line by line with this free tool, without an account.",
  openGraph: { type: "website" as const, url: "/ai-humanizer", images: ["/opengraph-image"] },
  alternates: {
    canonical: "/ai-humanizer",
    types: { "text/markdown": "/tools/ai-humanizer.md" },
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
