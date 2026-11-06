import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LinkedIn Headline Generator — Free, No Sign-Up",
  description: "Generate LinkedIn headline candidates built on the formula recruiters search: Role | Skills | Proof. Free, no account.",
  openGraph: { type: "website" as const, url: "/linkedin-headline-generator", images: ["/opengraph-image"] },
  alternates: {
    canonical: "/linkedin-headline-generator",
    // Markdown twin for AI crawlers (see app/tools-md/[tool]/route.ts)
    types: { "text/markdown": "/tools/linkedin-headline-generator.md" },
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
