import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In or Sign Up",
  description:
    "Log in to RoleSharp or create a free account to check, tailor, save, export, and organize evidence-based resume versions.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
