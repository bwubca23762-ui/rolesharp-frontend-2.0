import type { Metadata } from "next";

// Signed-in surface. Without this the route inherits the root layout's
// index: true, so crawlers index a logged-out shell with no content.
export const metadata: Metadata = {
  title: "Notifications",
  description: "Service, account, legal, and product notices for your RoleSharp account.",
  alternates: { canonical: "/notifications" },
  robots: { index: false, follow: true },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
