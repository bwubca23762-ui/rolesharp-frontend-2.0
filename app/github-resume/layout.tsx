import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GitHub & JSON Resume Compiler — Free Developer Tool",
  description:
    "Turn public GitHub repository facts into resume project bullets. Import and export resume.json and RenderCV YAML with this free developer tool.",
  openGraph: { type: "website" as const, url: "/github-resume", images: ["/opengraph-image"] },
  alternates: {
    canonical: "/github-resume",
    types: { "text/markdown": "/tools/github-resume.md" },
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
