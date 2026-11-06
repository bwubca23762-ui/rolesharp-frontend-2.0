import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Button, EditorialShell } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "RoleSharp refund policy for Premium purchases, duplicate charges, and access issues.",
  alternates: { canonical: "/refund" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp Refund Policy",
    description: "How refund requests are handled for Premium purchases, duplicate payments, and access issues.",
    url: "/refund",
  },
};

export default function RefundPage() {
  return (
    <EditorialShell className="reading-shell reading-document"
        aside={
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
            <p className="font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              Billing Support
            </p>
            <h2 className="mt-1.5 text-base font-bold text-[var(--fg)]">
              Need help with a charge?
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-[var(--muted-fg)]">
              Send your account email and order ID. Every refund request is reviewed by a human within 2 business days.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button as="a" href="/support" className="justify-center">Open Billing Ticket →</Button>
              <Button as="a" href="/contact" variant="ghost" size="sm" className="justify-center">Email Support</Button>
              <Button as="a" href="/settings?tab=billing" variant="ghost" size="sm" className="justify-center">View Billing History</Button>
            </div>
          </div>
        }
      eyebrow="Legal"
      title="Refund Policy"
      description="How Premium refund requests are reviewed when payment, access, or duplicate-charge problems happen."
    >
      <div className="reveal-on-scroll">
          <h2 className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Eligibility</h2>
          <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Refund requests can be reviewed when Premium was purchased by mistake, duplicate payment occurred, or the service failed to provide access after payment confirmation.
          </p>

          <h2 className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Non-refundable cases</h2>
          <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Completed resume generations, downloaded Premium exports, or heavy use of Premium tools may not qualify for a refund.
          </p>

          <h2 className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Manual support</h2>
          <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Admins can manually grant or revoke Premium when resolving payment and support issues.
          </p>

          <h2 className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Request help</h2>
          <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Contact support from the{" "}
            <Link href="/contact" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
              contact page
            </Link>{" "}
            with your account email and payment details.
          </p>
      </div>
    </EditorialShell>
  );
}
