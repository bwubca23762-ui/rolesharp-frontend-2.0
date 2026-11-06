import type { Metadata } from "next";
import LegalDocumentPage from "@/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Current and historical RoleSharp Privacy Policy versions.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy",
    description: "Current and historical RoleSharp Privacy Policy versions.",
    url: "/privacy",
    type: "website",
    images: ["/opengraph-image"],
  },
};

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const requested = Number.parseInt((await searchParams).version ?? "", 10);
  return <LegalDocumentPage documentKey="privacy" versionNumber={Number.isSafeInteger(requested) && requested > 0 ? requested : null} />;
}
