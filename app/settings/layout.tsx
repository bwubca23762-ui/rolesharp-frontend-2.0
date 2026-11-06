import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Settings",
  description: "Manage your RoleSharp account, plan, and preferences.",
  alternates: { canonical: "/settings" },
  robots: { index: false, follow: true },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
