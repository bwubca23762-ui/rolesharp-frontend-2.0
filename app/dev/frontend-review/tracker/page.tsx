import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/ui/primitives";
import { env } from "@/lib/env";
import ApplicationList from "@/app/tracker/application-list";

export const metadata = { title: "Tracker sample", robots: { index: false, follow: false } };

const applications = [
  { id: "harbor", company: "Harbor Labs", role: "Product Manager", status: "applied", updated_at: "2026-11-02", follow_up_at: "2026-11-06" },
  { id: "northwind", company: "Northwind", role: "Growth Product Manager", status: "interview", updated_at: "2026-11-03", follow_up_at: "2026-11-09" },
  { id: "atlas", company: "Atlas", role: "Product Lead", status: "saved", updated_at: "2026-11-04" },
];

export default function TrackerSamplePage() {
  if (process.env.NODE_ENV !== "development" || (!env.localDevMode && process.env.FRONTEND_REVIEW_MODE !== "true")) notFound();

  return (
    <WorkspaceShell title="Application tracker" description="Fictional applications for reviewing the list layout.">
      <ApplicationList rows={applications} />
      <Link href="/dev/frontend-review" className="desk-link mt-4">Back to frontend review</Link>
    </WorkspaceShell>
  );
}
