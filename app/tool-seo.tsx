import JsonLd from "./json-ld";
import { env } from "@/lib/env";
import { headers } from "next/headers";

/**
 * Schema-only tool SEO: emits the tool's WebApplication + BreadcrumbList
 * JSON-LD and nothing visible. The old "More free career tools" 10-card grid
 * lived here and pushed every tool's real workspace below a wall of
 * self-promotion (owner decision 2026-10-18: pure workspaces, zero bloat —
 * internal linking already happens through the nav, footer, and /tools).
 */
export default async function ToolSeo({ path, name, description }: { path: string; name: string; description: string }) {
  // A parent layout also wraps its /help child. Only render tool-specific
  // content and schema on the tool's own URL so guide pages keep one accurate
  // breadcrumb trail and do not inherit a second page identity.
  const routePath = (await headers()).get("x-route-path")?.replace(/\/+$/, "") || "/";
  if (routePath !== path) return null;

  const base = env.siteUrl;
  // @id + isPartOf link this tool to the sitewide #app entity (app/layout.tsx)
  // so Google doesn't see two competing WebApplication entities per page.
  const appLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${base}${path}#tool`,
    name,
    description,
    url: `${base}${path}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    isPartOf: { "@id": `${base}/#app` },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", url: `${base}/pricing` },
    publisher: { "@id": `${base}/#org` },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name, item: `${base}${path}` },
    ],
  };
  return (
    <>
      <JsonLd data={appLd} />
      <JsonLd data={breadcrumbLd} />
    </>
  );
}
