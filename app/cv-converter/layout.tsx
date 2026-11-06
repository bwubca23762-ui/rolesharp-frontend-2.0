import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CV to Resume Converter — Free Conversion Planner",
  description: "Paste your academic CV or resume and get a structured conversion plan: which sections to remove, add, and compress.",
  openGraph: { type: "website" as const, url: "/cv-converter", images: ["/opengraph-image"] },
  alternates: {
    canonical: "/cv-converter",
    // Markdown twin for AI crawlers (see app/tools-md/[tool]/route.ts)
    types: { "text/markdown": "/tools/cv-converter.md" },
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
