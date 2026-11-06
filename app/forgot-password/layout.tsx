import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Your Password",
  description: "Request a secure RoleSharp password reset link.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: true },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
