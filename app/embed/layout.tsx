import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ATS Resume Score Widget",
  alternates: { canonical: "/embed/ats-score" },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
