import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.JOBS_QA_TSCONFIG
    ? { typescript: { tsconfigPath: process.env.JOBS_QA_TSCONFIG } }
    : {}),
  // Playwright development runs use a separate disposable cache so switching
  // between `next build`/`next start` and `next dev` cannot mix incompatible
  // manifests or chunks in `.next`.
  distDir: (new Set([".next", ".next-playwright", ".next-qa-build"]).has(process.env.JOBS_QA_DIST_DIR ?? "") || process.env.JOBS_QA_DIST_DIR === ".next-frontend-review")
    ? process.env.JOBS_QA_DIST_DIR
    : ".next",
  reactStrictMode: true,
  // Keep page metadata in <head> for browsers, audits, and answer engines.
  // Streaming metadata is smaller for human clients, but it caused title and
  // description tags to arrive outside <head> on interactive product routes.
  htmlLimitedBots: /.*/,
  // Keep file tracing anchored to this application even when the checkout is
  // nested inside a directory that happens to contain another lockfile.
  outputFileTracingRoot: process.cwd(),
  // Don't advertise the framework/version in responses (minor info-disclosure).
  poweredByHeader: false,
  // Keep server bundles lean for the 8GB VPS. Do not enable `inlineCss` here:
  // the application stylesheet is large and inlining duplicates it in the
  // HTML/RSC response instead of allowing browsers to cache one CSS asset.
  experimental: { serverMinification: true },
  // @react-pdf/renderer is server-only; don't bundle for client
  serverExternalPackages: ["@react-pdf/renderer", "bullmq", "ioredis"],
  async headers() {
    // Static CSP — script-src needs 'unsafe-inline' for the theme bootstrap and
    // JSON-LD blocks (the JSON-LD payload is already <>&-escaped via lib/jsonld.ts).
    // Nonce was removed (2026-06-23) to enable CF caching; per-metric data show
    // cached pages are 5× faster, and XSS risk is negligible for non-user-input content.
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      process.env.NODE_ENV === "development" ? "'unsafe-eval'" : null,
      "https://static.cloudflareinsights.com",
      "https://checkout.razorpay.com",
    ].filter(Boolean).join(" ");
    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      // `https:` allowed any host on the internet to be an image source, which
      // turns any HTML-injection foothold into an exfiltration channel (an <img>
      // pointing at attacker.example carries whatever is in the URL). The app
      // renders exactly one off-origin image — the SaaSBrowser badge in the
      // footer — and has no markdown image syntax or user-supplied image URLs,
      // so the allowlist is that one host.
      "img-src 'self' data: https://static-files.saasbrowser.com",
      "font-src 'self' data:",
      "connect-src 'self' https://cloudflareinsights.com https://checkout.razorpay.com https://api.razorpay.com",
      "frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");
    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    ];
    // X-Frame-Options: DENY is NOT in securityHeaders — /embed needs frame-ancestors *,
    // so we add X-Frame-Options: DENY only to non-embed routes below.
    return [
      {
        // Embeddable widget — MUST be iframe-able. Remove X-Frame-Options and
        // set frame-ancestors to * so any site can embed /embed/* paths. Do NOT
        // weaken security on other routes (sitewide frame-ancestors 'none' stays).
        // This rule MUST come before the global /:path* rule so Next.js applies
        // the more-specific match first and doesn't merge X-Frame-Options: DENY.
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors *; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests;" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cache-Control", value: "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, nosnippet" },
        ],
      },
      {
        // Global security headers for all routes EXCEPT /embed (which needs
        // frame-ancestors * and no X-Frame-Options to be iframe-embeddable).
        source: "/((?!embed).*)",
        headers: [...securityHeaders, { key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // Bank authentication uses a cross-origin popup. Its initial blank
        // document inherits this page's CSP before posting to Razorpay.
        source: "/settings",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Content-Security-Policy", value: csp.replace("form-action 'self'", "form-action 'self' https://api.razorpay.com") },
        ],
      },
      {
        // Self-hosted faces. next/font served these out of /_next/static/media
        // with a year of immutable caching; anything under public/ defaults to
        // max-age=0, so without this every page load revalidates three fonts.
        // The filenames carry no content hash — rename the file when a face
        // is regenerated, or clients keep the old one for a year.
        source: "/fonts/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Public informational pages are SEO-sensitive. Keep caches short so
        // brand/meta fixes reach crawlers quickly after deploys.
        // Link header (RFC 8288): points AI agents at the API catalog and the
        // llms.txt service description for discovery.
        source: "/",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=300, stale-while-revalidate=600" },
          { key: "Link", value: '</.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="service-doc"; type="text/plain"' },
        ],
      },
      {
        // Public product pages should never keep old HTML for too long. When
        // a cached page points at JS chunks from a previous deploy, users hit
        // ChunkLoadError and the app fails before hydration can recover.
        source: "/:page(build|pricing|students|learn|prompts|checker|resume-maker|resume-fixer|linkedin-checker|resume-builder|resume-tailoring|ats-resume-checker|cover-letter-generator|cover-letter-examples|resume-templates|resume-examples|interview-prep|resume-translator|auto-apply|compare|about|contact|careers|help|jobs|internships|login)",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=300, stale-while-revalidate=600" }],
      },
      {
        // Nested public pages (country job hubs, competitor comparisons) need
        // the same short cache — the single-segment matcher above misses them.
        source: "/:page(jobs|internships|compare)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=300, stale-while-revalidate=600" }],
      },
      {
        // Public guides that live below a product route are separate,
        // indexable documents and need the same bounded browser/CDN cache.
        source: "/:page(build|checker|resume-maker|resume-fixer|linkedin-checker)/help",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=300, stale-while-revalidate=600" }],
      },
      {
        // Regional landings, public policies, the safety board, and linkable
        // research/tool assets are outside the core one-segment matcher above.
        source: "/:page(en-us|en-gb|en-ca|en-in|de-de|fr-fr|es-es|ja-jp|ar-ae|privacy|terms|refund|internship-reports|resume-keyword-report-2026)",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=300, stale-while-revalidate=600" }],
      },
      {
        source: "/tools/embed-ats-checker",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=300, stale-while-revalidate=600" }],
      },
      {
        // Programmatic SEO pages are deterministic per (company, role).
        source: "/resume/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" }],
      },
      {
        // SEO directory + blog index/posts are public, but snippets need to update
        // fast when we correct market/brand positioning.
        source: "/:seo(companies|roles|blog)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=300, stale-while-revalidate=600" }],
      },
      {
        source: "/:seo(companies|roles|blog)",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=300, stale-while-revalidate=600" }],
      },
      {
        source: "/sitemaps/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:page(dashboard|settings|tracker)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
      {
        // LAST rule, so it wins over any earlier match: API responses are
        // per-request by default. A missing cache directive let the CDN's
        // zone default stamp max-age=14400 onto an authenticated /api/resumes
        // response, edge-caching one user's data at a shared URL — the
        // mechanism behind the external audits' "unauthenticated leak" PoCs
        // (they were served a cached copy of their own logged-in session).
        // Routes that ARE safe to cache set their own public header explicitly
        // (llms.txt, sitemaps); this default is no-store everywhere else.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
  async rewrites() {
    return [
      // Markdown twins for AI crawlers. A rewrite (not redirect) keeps the
      // .md URL canonical-looking.
      { source: "/blog/:slug.md", destination: "/blog-md/:slug" },
      { source: "/compare/:slug.md", destination: "/compare-md/:slug" },
      { source: "/tools/:tool.md", destination: "/tools-md/:tool" },
    ];
  },
  async redirects() {
    // Aliases so typed/external/legacy URLs resolve instead of 404ing.
    // /pricing is now a real page (app/pricing) — no redirect.
    return [
      // Consolidate the legacy SEO landing into the real interactive checker.
      // Keeping one indexable owner prevents ATS-checker keyword cannibalization.
      { source: "/ats-resume-checker", destination: "/checker", permanent: true },
      { source: "/register", destination: "/login", permanent: true },
      { source: "/signup", destination: "/login", permanent: true },
      // /docs is the conventional docs-hub URL. The Academy (/learn) is that
      // hub — 24 guides across 6 journey-structured modules — so the alias
      // resolves there instead of 404ing. One indexable owner of the intent.
      { source: "/docs", destination: "/learn", permanent: true },
      { source: "/docs/:path*", destination: "/learn", permanent: true },
      // /roles owns the role-guide directory. /careers repeated the same role
      // list and search intent without unique career data.
      { source: "/careers", destination: "/roles", permanent: true },
      // Cannibalization merges (2026-07-15): thin duplicate posts 301 to the
      // long-form twin targeting the same query.
      { source: "/blog/one-page-vs-two-page-resume", destination: "/blog/one-page-vs-two-page-resume-what-ats-and-recruiters-prefer", permanent: true },
      { source: "/blog/resume-keywords-examples", destination: "/blog/resume-keywords-how-to-find-and-use-them", permanent: true },
      { source: "/blog/student-resume-no-experience", destination: "/blog/resume-with-no-work-experience-fresher-guide", permanent: true },
      { source: "/blog/resume-mistakes-getting-rejected", destination: "/blog/why-your-resume-gets-rejected-in-6-seconds", permanent: true },
    ];
  },
};

export default nextConfig;
