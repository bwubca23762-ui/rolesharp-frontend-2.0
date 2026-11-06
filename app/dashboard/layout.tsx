import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Resumes",
  description: "Your saved resumes, ATS scores, and exports.",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: true },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
