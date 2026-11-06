import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { Container, GeneratedOutput, Section } from "@/components/ui/primitives";
import { Button } from "@/components/ui/primitives/Button";
import ToolSeo from "@/app/tool-seo";
import { FaqSection } from "@/app/seo-blocks";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Free Embeddable ATS Checker Widget",
  description: "Add a free ATS resume score widget to your site with an iframe or script. No signup required; visitors get instant resume feedback.",
  keywords: ["embed ats checker", "free resume widget", "embeddable resume score", "ats widget", "resume checker iframe"],
  robots: { index: true, follow: true },
  alternates: { canonical: "/tools/embed-ats-checker" },
  openGraph: {
    title: "Free Embeddable ATS Resume Checker Widget",
    description: "Add a free ATS resume checker to your site. Iframe or script embed. Instant resume scores for your visitors.",
    type: "website",
    url: "/tools/embed-ats-checker",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Embeddable ATS Resume Checker Widget",
    description: "Add a lightweight, browser-based resume score widget to a career site or resource page.",
    images: ["/opengraph-image"],
  },
};

const FAQ_ITEMS: [string, string][] = [
  ["Is the widget free?", "Yes. The current widget is free to embed and does not require signup or an API key. Copy the embed code and paste it into your site."],
  ["How do I embed it on my site?", "Copy either the iframe snippet or the script tag below and paste it into your HTML. The iframe method works everywhere; the script tag offers more styling flexibility."],
  ["Can the widget affect page performance?", "Any embed adds a network request. This widget is isolated in an iframe and does not send resume text to RoleSharp, but publishers should lazy-load it below the fold and test their own Core Web Vitals after adding it."],
  ["Can I customize the widget's appearance?", "The iframe version ships with clean, responsive styling. For deeper customization, you can wrap the iframe in your own container and apply CSS there. We don't offer API-level customization to keep the widget free and maintenance-free."],
];

export default function EmbedAtsCheckerPage() {
  const base = env.siteUrl;
  const embedUrl = `${base}/embed/ats-score`;

  // No FAQPage is built here on purpose: <FaqSection> below already emits one
  // from this same FAQ_ITEMS array. Declaring a second makes the page ship two
  // FAQPage entities, which Google treats as ambiguous and may drop entirely.
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Embed ATS Checker", item: `${base}/tools/embed-ats-checker` },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbLd} />

      <main>
        <Section asContainer={false} className="!pt-28 !pb-16">
        <Container className="max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            Free Embeddable ATS Resume Checker Widget
          </h1>
          <p className="text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-8 leading-relaxed">
            Add a free ATS resume score widget to your career blog, university website, or HR resource center. Give your visitors instant resume feedback — no signup required.
          </p>

          <div className="bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] p-8 mb-10">
            <h2 className="text-2xl font-bold mb-4 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Live Preview</h2>
            <iframe
              src={embedUrl}
              width="100%"
              height="520"
              loading="lazy"
              style={{ border: "none", borderRadius: 12 }}
              title="Free ATS Resume Checker"
            />
          </div>

          <div className="prose prose-lg max-w-none mb-12">
            <h2>Why embed a resume checker on your site?</h2>
            <p>
              If you run a career blog, university career center, HR resource hub, or coaching site, your visitors are asking <em>"Is my resume good enough to pass the ATS?"</em> Give them an answer instantly — right on your page.
            </p>
            <ul>
              <li><strong>Keep visitors on your site</strong> — they don't need to leave to check their resume score.</li>
              <li><strong>Add value without maintenance</strong> — we keep the scoring algorithm updated; you just embed once.</li>
              <li><strong>Free to embed today</strong> — no API key or signup is required.</li>
              <li><strong>Clear attribution</strong> — the widget identifies RoleSharp and links visitors to the full checker.</li>
            </ul>

            <h2>Who's using embeddable resume checkers?</h2>
            <ul>
              <li><strong>Career coaches and consultants</strong> — offer a free diagnostic before your paid services.</li>
              <li><strong>University career centers</strong> — let students check their resumes 24/7 without scheduling appointments.</li>
              <li><strong>HR and recruiting blogs</strong> — add an interactive tool that keeps readers engaged longer.</li>
              <li><strong>Job boards and career sites</strong> — differentiate from competitors with a value-add tool.</li>
            </ul>

            <h2>How to embed</h2>
            <p>Copy one of the snippets below and paste it into your HTML where you want the widget to appear.</p>

            <h3>Option 1: Iframe embed (recommended)</h3>
            <p>Works everywhere. Drop it into WordPress, Wix, Squarespace, or raw HTML.</p>
            <GeneratedOutput label="Option 1 — Iframe embed (recommended)" text={`<iframe src="${embedUrl}"\n  width="100%"\n  height="520"\n  loading="lazy"\n  frameborder="0"\n  title="Free ATS Resume Checker">\n</iframe>`} />

            <h3>Option 2: Script tag (advanced)</h3>
            <p>For developers who want more control over placement. The script injects the widget at the current script tag location.</p>
            <GeneratedOutput label="Option 2 — Script tag (advanced)" text={`<div id="rolesharp-ats-widget"></div>\n<script>\n(function(){\n  var iframe = document.createElement('iframe');\n  iframe.src = '${embedUrl}';\n  iframe.width = '100%';\n  iframe.height = '520';\n  iframe.loading = 'lazy';\n  iframe.frameBorder = '0';\n  iframe.title = 'Free ATS Resume Checker';\n  document.getElementById('rolesharp-ats-widget').appendChild(iframe);\n})();\n</script>`} />

            <h2>What the widget scores</h2>
            <p>The widget runs a lightweight client-side heuristic that scores resumes on five ATS-critical dimensions:</p>
            <ol>
              <li><strong>Length</strong> — ideal 400–800 words (too short = thin, too long = wall of text).</li>
              <li><strong>Action verbs</strong> — "led," "built," "improved" vs. passive phrasing.</li>
              <li><strong>Quantified results</strong> — numbers, percentages, dollar amounts prove impact.</li>
              <li><strong>Section structure</strong> — Experience, Education, Skills sections present and labeled.</li>
              <li><strong>Skills keywords</strong> — dedicated skills section with comma-separated terms.</li>
            </ol>
            <p>
              This is a <em>quick score</em>, not a full ATS simulation. For deeper analysis (missing keywords for a specific company, formatting issues, ATS parsing preview), visitors click through to the full checker at <a href={`${base}/checker`}>rolesharp.com/checker</a>.
            </p>

            <h2>Technical details</h2>
            <ul>
              <li><strong>Delivery:</strong> isolated iframe content; lazy-load it when placed below the fold and test performance on your own page.</li>
              <li><strong>Privacy:</strong> no cookies, no tracking, no data sent to our servers. Scoring runs entirely in the visitor's browser.</li>
              <li><strong>Accessibility:</strong> ARIA labels on the score ring, semantic HTML, keyboard navigable.</li>
              <li><strong>Mobile:</strong> fully responsive; works on phones, tablets, and desktops.</li>
            </ul>
          </div>

          <FaqSection heading="Common Questions" faqs={FAQ_ITEMS} />

          <div className="mt-12 text-center">
            <Button as="a" href="/checker" variant="primary" size="lg">
              Try the full ATS checker
            </Button>
          </div>
        </Container>
        </Section>

        <ToolSeo path="/tools/embed-ats-checker" name="Embed ATS Checker" description="Free embeddable ATS resume checker widget for your site" />
      </main>
    </>
  );
}
