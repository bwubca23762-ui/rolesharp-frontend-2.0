import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./admin-workflows.css";
import "./analytics.css";
import "./admin-modern.css";
import "./admin-shadcn.css";
import "./admin-surfaces.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {children}
    </div>
  );
}
