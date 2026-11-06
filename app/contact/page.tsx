import "@/app/reading-surfaces.css";
import ContactForm from "./contact-form";
import type { Metadata } from "next";
import { Container, Card, Button, Eyebrow, MarketingShell } from "@/components/ui/primitives";
import { MessageSquare, Briefcase } from "../icons";
import JsonLd from "@/app/json-ld";
import { env } from "@/lib/env";
import { PARTNERSHIPS_EMAIL, SUPPORT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contact RoleSharp",
  description:
    "Stuck on billing, your account, or a resume? Reach the RoleSharp team here.",
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Contact RoleSharp — Billing, Resume and Account Help",
    description:
      "Get help with billing, account access, resume generation, exports, and product questions.",
    url: "/contact",
  },
};

export default function ContactPage() {
  const contactPageLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${env.siteUrl}/contact#page`,
    url: `${env.siteUrl}/contact`,
    name: "Contact RoleSharp",
    description: "Contact RoleSharp for account, billing, resume, partnership, and product support.",
    isPartOf: { "@id": `${env.siteUrl}/#website` },
    mainEntity: { "@id": `${env.siteUrl}/#org` },
  };
  return (
    <MarketingShell className="reading-shell">
      <JsonLd data={contactPageLd} />

      <header className="reading-masthead">
        <Container>
          <div className="max-w-3xl">
            <h1 className="font-display text-3xl md:text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              Contact RoleSharp
            </h1>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Use the form below or email us. Include your account email and a brief description if you need help with billing or access.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button as="a" href={`mailto:${SUPPORT_EMAIL}`} size="lg">
                Email support
              </Button>
              <Button as="a" href="/help" variant="outline" size="lg">
                Browse help center
              </Button>
            </div>
          </div>
        </Container>
      </header>

      <Container className="py-10 md:py-14">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
          <Card padding="lg">
            <h2 className="font-display text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-6">
              Send a message
            </h2>
            <ContactForm />
          </Card>

          <div className="space-y-4">
            <Card padding="md">
              <div className="flex items-start gap-3">
                <MessageSquare size={16} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <div>
                  <div className="font-medium text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                    Support
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                    The fastest route for payment questions, login trouble,
                    exports, or a resume that won&apos;t generate.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)]">
                    <span className="font-bold text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                      {SUPPORT_EMAIL}
                    </span>
                    <Button as="a" href={`mailto:${SUPPORT_EMAIL}`} size="sm">
                      Open mail app
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <div className="flex items-start gap-3">
                <Briefcase size={16} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <div>
                  <div className="font-medium text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                    Partnerships &amp; press
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                    Partnerships, press, or affiliate inquiries.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)]">
                    <span className="font-bold text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                      {PARTNERSHIPS_EMAIL}
                    </span>
                    <Button as="a" href={`mailto:${PARTNERSHIPS_EMAIL}`} size="sm" variant="outline">
                      Open mail app
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <Eyebrow>Useful links</Eyebrow>
              <div className="mt-1 flex flex-wrap gap-2">
                <Button as="a" href="/checker" variant="outline" size="sm">
                  Check resume
                </Button>
                <Button as="a" href="/build" variant="outline" size="sm">
                  Build a resume
                </Button>
                <Button as="a" href="/help" variant="outline" size="sm">
                  Help center
                </Button>
                <Button as="a" href="/settings" variant="outline" size="sm">
                  Settings
                </Button>
              </div>
            </Card>

            <Card padding="md">
              <Eyebrow>Best pages to try first</Eyebrow>
              <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Many issues resolve faster if you start on the{" "}
                <a href="/resume-fixer" className="font-semibold text-[var(--color-primary)]">resume fixer</a>,
                the{" "}
                <a href="/checker" className="font-semibold text-[var(--color-primary)]">ATS resume checker</a>,
                or the{" "}
                <a href="/build" className="font-semibold text-[var(--color-primary)]">AI resume builder</a>.
              </p>
            </Card>
          </div>
        </div>
      </Container>
    </MarketingShell>
  );
}
