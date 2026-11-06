import "./globals.css";
import "./animations.css";
import "./application-desk.css";
import { jsonLd } from "@/lib/jsonld";
import type { Metadata, Viewport } from "next";
import AppShell from "./app-shell";
import { env } from "@/lib/env";
import { LOCALE_LANGUAGE_ALTERNATES } from "@/lib/locales";
import { headers } from "next/headers";
import { authorPersonLd, getAuthor } from "@/lib/authors";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { tailoredResumes } from "@/lib/limits";

// The three brand faces are declared in globals.css against woff2 in
// public/fonts, not fetched from Google at build time — see the @font-face
// block there. Display face is Plus Jakarta Sans (RoleSharp Redefined), body
// is DM Sans (DESIGN.md body-font contract), mono is Geist Mono. The heading
// face keeps font-display: optional so a constrained mobile connection gets
// the metrically matched system fallback instead of a late swap that pushes
// LCP past the good threshold; the preload below is what makes it land in
// time on a normal connection.
const PRELOADED_FONTS = [
  "/fonts/plus-jakarta-sans-latin.woff2",
  "/fonts/dm-sans-latin.woff2",
  "/fonts/geist-mono-latin.woff2",
];

const SITE = env.siteUrl;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#061426",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "RoleSharp — AI Resume Builder Tailored to Any Company & Role",
    template: "%s | RoleSharp",
  },
  description:
    "Free global AI resume checker and builder. Score your resume worldwide, then make an ATS-optimized resume tailored to any company, country, and job.",
  applicationName: "RoleSharp",
  authors: [{ name: "RoleSharp" }],
  alternates: {
    // Explicit absolute URL with trailing slash — matches the live URL exactly
    // so Google doesn't treat rolesharp.com and rolesharp.com/ as candidates.
    canonical: `${SITE}/`,
    languages: {
      ...LOCALE_LANGUAGE_ALTERNATES,
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    siteName: "RoleSharp",
    locale: "en_US",
    title: "RoleSharp — AI Resume Builder Tailored to Any Company & Role",
    description:
      "Check your resume score worldwide, then build an ATS-optimized resume tailored to the exact company, country, and job you're applying to.",
    url: SITE,
  },
  twitter: {
    card: "summary_large_image",
    site: "@rolesharpai",
    creator: "@rolesharpai",
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } },
};

// Rich @graph so search + AI answer engines (Google AI Overviews, Perplexity,
// ChatGPT, etc.) can understand exactly what RoleSharp is, what it costs, and
// recommend it for "ai resume builder / tailored resume" style queries.
const ORG_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#org`,
      name: "RoleSharp",
      url: SITE,
      logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png`, width: 512, height: 512 },
      description: "Global AI resume builder and ATS resume checker that tailors resumes to a specific company, country, and role.",
      sameAs: ["https://x.com/rolesharpai", "https://instagram.com/rolesharp", "https://linkedin.com/company/rolesharpai"],
      foundingDate: "2026-06-19",
      founder: { "@id": `${SITE}/#person-mustak` },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SUPPORT_EMAIL,
        url: `${SITE}/contact`,
        availableLanguage: ["English"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      name: "RoleSharp",
      url: SITE,
      publisher: { "@id": `${SITE}/#org` },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE}/#app`,
      name: "RoleSharp",
      url: SITE,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Build an ATS-optimized resume tailored to any company, country, and role. Paste a job description, get a keyword-matched resume and an ATS score in seconds.",
      featureList: [
        "Company-, country-, and role-tailored resumes",
        "Worldwide employer guide library",
        "ATS keyword match score",
        "Resume checker",
        "Cover letter generator",
        "Interview prep",
        "LinkedIn About generator",
        "Private Daily Matches digests for signed-in users",
        "Controlled application email when a posting publishes explicit email instructions",
        "PDF and DOCX export",
      ],
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: env.premiumCurrency, url: `${SITE}/pricing`, description: `${tailoredResumes(env.freeMonthlyLimit)} per rolling month, ATS score, PDF export.` },
        { "@type": "Offer", name: `Premium ${env.daysMonthly}-day pass`, price: String(env.priceMonthlyCents / 100), priceCurrency: env.premiumCurrency, url: `${SITE}/pricing`, description: `One-time payment for ${env.daysMonthly} days of Premium access with ${tailoredResumes(env.premiumMonthlyLimit)} per rolling month; no automatic renewal.` },
        { "@type": "Offer", name: `Premium ${env.daysYearly}-day pass`, price: String(env.priceYearlyCents / 100), priceCurrency: env.premiumCurrency, url: `${SITE}/pricing`, description: `One-time payment for ${env.daysYearly} days of Premium access; no automatic renewal.` },
      ],
      publisher: { "@id": `${SITE}/#org` },
    },
    authorPersonLd(getAuthor("mustak")),
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const language = requestHeaders.get("x-route-locale") || "en";
  const direction = requestHeaders.get("x-route-dir") || "ltr";
  return (
    <html lang={language} dir={direction} data-theme="dark" suppressHydrationWarning>
      <head>
        {PRELOADED_FONTS.map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('rolesharp-theme')||localStorage.getItem('resumeai-theme');if(t==='light')document.documentElement.dataset.theme='light';}catch(e){}`,
          }}
        />
        {/* Banner dismissal must be known BEFORE first paint: the rails render
            in the server paint, so resolving a stored dismissal only at
            hydration yanked them away right after the page appeared — the
            "banner flashes then disappears" report. Same pre-paint pattern as
            the theme script above; windows match the components' own checks
            (promo 7d, student 14d, smart topbar 7d). The smart topbar is a
            client component that only reads localStorage in an effect, so
            without this line a dismissed visitor sees it flash on every
            landing load for seven days. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var n=Date.now(),p=+localStorage.getItem('rs-promo-banner-dismissed')||0,s=+localStorage.getItem('rs-student-banner-dismissed')||0,t=+localStorage.getItem('rs-smart-topbar-dismissed')||0;if(p&&n-p<=7*864e5)document.documentElement.dataset.promoOff='off';if(s&&n-s<=14*864e5)document.documentElement.dataset.studentOff='off';if(t&&n-t<=7*864e5)document.documentElement.dataset.smartTopbarOff='off';}catch(e){}`,
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ORG_LD) }} />
      </head>
      <body className="rs-product-root">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
