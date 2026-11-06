// Minimal sitemap XML builders.
//
// Grounded in Google's current documentation (developers.google.com/search/
// docs/crawling-indexing/sitemaps/build-sitemap):
//   - <priority> and <changefreq> are IGNORED by Google — we omit them.
//   - <lastmod> is used only when consistently, verifiably accurate. We emit
//     it ONLY where we have a real modification signal (blog dateModified,
//     jobs max(last_seen_at)); everywhere else it's omitted, never faked.
//     Stamping "today" on unchanged pages trains Google to distrust the site.

export type SitemapUrl = { loc: string; lastmod?: string };

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function urlsetXml(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => `<url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

export function sitemapIndexXml(sitemaps: SitemapUrl[]): string {
  const body = sitemaps
    .map((s) => `<sitemap><loc>${escapeXml(s.loc)}</loc>${s.lastmod ? `<lastmod>${s.lastmod}</lastmod>` : ""}</sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // 1h CDN cache + a day of stale-while-revalidate: crawlers get instant
      // responses, origin renders each segment at most hourly.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
