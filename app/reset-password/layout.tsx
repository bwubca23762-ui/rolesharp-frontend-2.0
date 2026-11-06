import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Choose a New Password",
  description: "Choose a new password for your RoleSharp account.",
  alternates: { canonical: "/reset-password" },
  robots: { index: false, follow: true },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
