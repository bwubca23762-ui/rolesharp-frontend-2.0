import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RoleSharp — Full Landing Page",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
