import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { FaqSection } from "@/app/seo-blocks";
import { Copy, Mail, Shield } from "@/app/icons";
import { Badge, Button, Card, Container, MarketingShell, PageHeader, Section, SectionHeader } from "@/components/ui/primitives";
import { PARTNERSHIPS_EMAIL } from "@/lib/contact";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Integrations \u2014 Embed the Free ATS Checker",
  description: "Embed the free RoleSharp ATS checker on your career blog or university website. Use an iframe or script without an API key or account.",
  alternates: { canonical: "/integrations" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "RoleSharp Integrations",
    description: "Embed the free ATS resume checker on your site — iframe or script, no API key.",
    url: "/integrations",
  },
};

const AUDIENCES = [
  {
    title: "Career blogs & publishers",
    body: "Give readers an interactive resume check inside your article. The widget stays in an iframe, so it never touches your page's own scripts or styles.",
  },
  {
    title: "Universities & career centers",
    body: "Add a self-serve resume check to your student resources page. Students get instant feedback before booking an advisor appointment.",
  },
  {
    title: "HR & recruiting teams",
    body: "Offer candidates a pre-application resume check on your careers page. Better-formed applications, fewer unparseable submissions.",
  },
] as const;

const FAQ_ITEMS: [string, string][] = [
  ["Does the embed cost anything?", "No. The ATS checker widget is free to embed, with no API key, account, or attribution requirement."],
  ["Does resume text get sent to RoleSharp servers?", "The widget is isolated in an iframe and processes the resume in the visitor's browser. Publishers should still review their own privacy obligations before embedding any third-party tool."],
  ["Will it slow my site down?", "Any embed adds a network request. Lazy-load the iframe below the fold and test your Core Web Vitals after adding it — the embed page covers this in detail."],
  ["Is there an API?", "Not currently. The embeddable widget is the supported integration today. For deeper integrations — data partnerships, co-branded tools, or bulk access — contact partnerships."],
];

export default function IntegrationsPage() {
  const base = env.siteUrl;
  const embedUrl = "/embed/ats-score";
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${base}/integrations#page`,
    url: `${base}/integrations`,
    name: "RoleSharp Integrations",
    description: "Embed the free RoleSharp ATS resume checker on your site, or inquire about deeper partnerships.",
    isPartOf: { "@id": `${base}/#website` },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Integrations", item: `${base}/integrations` },
    ],
  };

  return (
    <MarketingShell className="growth-page growth-integrations">
      <JsonLd data={[pageLd, breadcrumbLd]} />

      <header className="relative border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
        <Container className="py-14 md:py-20">
          <PageHeader
            eyebrow="Integrations"
            title="Embed a resume checker on your site"
            description="Add the free ATS checker to a career blog, university resource page, or hiring site. Visitors can check their resumes without leaving your page."
            actions={<><Button as="a" href="/tools/embed-ats-checker">Get the embed code</Button><Button as="a" href={`mailto:${PARTNERSHIPS_EMAIL}?subject=RoleSharp%20integration`} variant="outline">Discuss a partnership</Button></>}
            meta={<div className="flex flex-wrap gap-2"><Badge variant="primary">Free to embed</Badge><Badge variant="neutral">No API key</Badge><Badge variant="premium">Iframe or script</Badge></div>}
          />
        </Container>
      </header>

      <Section asContainer={false}>
        <Container>
          <SectionHeader eyebrow="Live preview" title="Try the embedded ATS checker" />
          <div className="growth-demo">
            <iframe
              src={embedUrl}
              width="100%"
              height="520"
              loading="lazy"
              title="Free ATS Resume Checker widget preview"
            />
          </div>
        </Container>
      </Section>

      <Section asContainer={false} alt>
        <Container>
          <SectionHeader title="Where to use the widget" />
          <ul className="growth-list">
            {AUDIENCES.map(({ title, body }) => (
              <li key={title}><h3>{title}</h3><p>{body}</p></li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section asContainer={false}>
        <Container>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card variant="elevated" padding="lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]"><Copy size={21} /></span>
              <h2 className="mt-5 text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Two ways to embed</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Paste the iframe directly into your HTML or use the script to insert it into a container. Both load the same widget. The embed page has code for each option.</p>
              <Button as="a" href="/tools/embed-ats-checker" variant="outline" size="sm" className="mt-5">Open the embed page</Button>
            </Card>
            <Card variant="elevated" padding="lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]"><Shield size={21} /></span>
              <h2 className="mt-5 text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Deeper integrations</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Data partnerships, co-branded tools, university bulk access, or embedding something beyond the ATS checker? Tell us what you&apos;re building and we&apos;ll answer honestly about what&apos;s possible today.</p>
              <Button as="a" href={`mailto:${PARTNERSHIPS_EMAIL}?subject=RoleSharp%20integration`} variant="outline" size="sm" className="mt-5">Email partnerships</Button>
            </Card>
          </div>
        </Container>
      </Section>

      <FaqSection className="growth-faq" visible heading="Integration questions" faqs={FAQ_ITEMS} />

      <Section asContainer={false}>
        <Container>
          <div className="flex flex-col items-center gap-4 text-center">
            <Mail className="text-[var(--color-primary)]" size={28} aria-hidden />
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Ready to embed, or want to talk first?</h2>
            <p className="max-w-xl text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Grab the code and ship it, or write to partnerships if your integration needs more than the widget.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button as="a" href="/tools/embed-ats-checker" size="lg" variant="primary">Get the embed code →</Button>
              <Button as="a" href={`mailto:${PARTNERSHIPS_EMAIL}?subject=RoleSharp%20integration`} size="lg" variant="outline">Contact partnerships</Button>
            </div>
          </div>
        </Container>
      </Section>
    </MarketingShell>
  );
}
