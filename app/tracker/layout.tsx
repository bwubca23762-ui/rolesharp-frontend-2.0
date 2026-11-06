import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Application Tracker",
  description: "Track your job applications, interviews, and offers alongside the resumes you built for them.",
  alternates: { canonical: "/tracker" },
  robots: { index: false, follow: true },
};

export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
