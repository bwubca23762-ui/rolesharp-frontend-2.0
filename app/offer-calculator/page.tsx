import type { Metadata } from "next";
import { ToolShell } from "@/components/ui/primitives";
import OfferCalculatorClient from "./offer-calculator-client";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Job Offer Comparison Calculator",
  description:
    "Compare 2+ job offers side by side: base, bonus, signing, 4-year equity vesting, cost-of-living parity, and PTO. Free for two offers.",
  alternates: { canonical: "/offer-calculator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "Offer Comparison Calculator | RoleSharp",
    description: "Compare job offers on real numbers — base, bonus, equity vesting, COL parity, PTO.",
    url: "/offer-calculator",
  },
};

export default function OfferCalculatorPage() {
  return (
    <ToolShell
      eyebrow="Free — 2 offers, no account"
      title="Offer-to-offer comparison"
      subtitle="Put both offers in and see year-1 and 4-year totals, cost-of-living parity, and what the equity is actually worth per year. The numbers are yours — this tool only does honest arithmetic."
      workspaceSize="default"
    >
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: "Offer Calculator", item: "/offer-calculator" }])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "RoleSharp Offer Comparison Calculator",
          url: "https://rolesharp.com/offer-calculator",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          browserRequirements: "Requires JavaScript",
          description: "Compare job offers across base, bonus, equity vesting, cost-of-living parity, and PTO. Free for two offers.",
          offers: { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        }}
      />
      <OfferCalculatorClient />
    </ToolShell>
  );
}
