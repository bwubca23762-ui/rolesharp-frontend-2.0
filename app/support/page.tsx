import type { Metadata } from "next";
import { Card, Button, Eyebrow, WorkspaceShell, Badge } from "@/components/ui/primitives";
import { MessageSquare, FileText, Info, Settings } from "../icons";
import SupportForm from "./support-form";
import MyTickets from "./my-tickets";

export const metadata: Metadata = {
  title: "Support — RoleSharp Billing, Login and Resume Help",
  description: "Stuck on billing, login, or a resume? Reach the RoleSharp team and we'll get back to you.",
  alternates: { canonical: "/support" },
  openGraph: {
    title: "Support — RoleSharp Billing, Login and Resume Help",
    description: "Support for billing, login issues, exports, bugs, and resume-generation problems.",
    url: "/support",
  },
};

const QUICK_DIAGNOSTICS = [
  {
    icon: "💳",
    title: "Billing & Pass Activation",
    desc: "Fixed-term pass status, crypto invoice confirmation, or refund requests.",
    href: "/settings?tab=billing",
    cta: "Check Billing Status →",
  },
  {
    icon: "📄",
    title: "PDF & DOCX Export Help",
    desc: "Re-download saved resumes, check ATS text-layer seals, or switch templates.",
    href: "/dashboard",
    cta: "Open Saved Resumes →",
  },
  {
    icon: "📬",
    title: "Mailbox & Auto-Apply Setup",
    desc: "Connect send-only Gmail/Outlook or review daily match thresholds.",
    href: "/email-connection",
    cta: "Manage Mailbox →",
  },
  {
    icon: "🔐",
    title: "Account, Email & Security",
    desc: "Verify your email, set or update your password, or export account data.",
    href: "/settings?tab=security",
    cta: "Security Settings →",
  },
] as const;

export default function SupportPage() {
  return (
    <WorkspaceShell
      eyebrow="Member Concierge & Help Desk"
      title="Support for account and workflow issues"
      description="Send a support request for billing, login, exports, bugs, or workspace setup. If signed in, the conversation stays available in your private support history."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button as="a" href="/help" variant="outline" size="sm">
            📖 Help Center &amp; FAQs
          </Button>
          <Button as="a" href="/settings?tab=billing" variant="ghost" size="sm">
            💳 Billing History
          </Button>
        </div>
      }
    >
      {/* 4-Card Quick Self-Service Diagnostic Strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_DIAGNOSTICS.map((item) => (
          <Card key={item.title} variant="interactive" padding="sm" className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0071E3]/10 text-sm">
                  {item.icon}
                </span>
                <Badge variant="default">Self-Service</Badge>
              </div>
              <h2 className="mt-2.5 text-sm font-bold! text-[var(--fg)]">{item.title}</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">{item.desc}</p>
            </div>
            <a
              href={item.href}
              className="mt-3 inline-flex items-center text-xs font-semibold text-[#0066CC] dark:text-[#5AC8FA] hover:underline"
            >
              {item.cta}
            </a>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card padding="lg">
          <Eyebrow>Direct Ticket</Eyebrow>
          <h2 className="font-display text-xl font-bold! text-[var(--fg)] mb-4">
            Send a message to our team
          </h2>
          <SupportForm />
        </Card>

        <div className="flex flex-col gap-4">
          <MyTickets />

          <Card padding="md">
            <div className="flex items-start gap-3">
              <MessageSquare size={18} className="mt-0.5 shrink-0 text-[#0066CC] dark:text-[#5AC8FA]" />
              <div>
                <div className="font-bold text-sm text-[var(--fg)]">
                  How private support threads work
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">
                  Every message goes straight into our human support queue. When you submit while logged in, replies appear both in your private ticket history above and by email.
                </p>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-start gap-3">
              <Info size={18} className="mt-0.5 shrink-0 text-[#0066CC] dark:text-[#5AC8FA]" />
              <div className="flex-1">
                <div className="font-bold text-sm text-[var(--fg)]">
                  Faster resolution checklist
                </div>
                <ul className="mt-1.5 space-y-1 text-xs leading-5 text-[var(--muted-fg)]">
                  <li>• Include your account email and order/invoice ID for billing questions</li>
                  <li>• Mention the target company, role, or resume ID if reporting an export issue</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button as="a" href="/refund" variant="outline" size="compact">
                    Refund Policy
                  </Button>
                  <Button as="a" href="/settings" variant="ghost" size="compact" leftIcon={<Settings size={13} />}>
                    Account Settings
                  </Button>
                  <Button as="a" href="/checker" variant="ghost" size="compact" leftIcon={<FileText size={13} />}>
                    ATS Checker
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </WorkspaceShell>
  );
}
