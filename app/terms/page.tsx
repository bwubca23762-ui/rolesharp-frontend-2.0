import type { Metadata } from "next";
import LegalDocumentPage from "@/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Current and historical RoleSharp Terms of Service versions.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service",
    description: "Current and historical RoleSharp Terms of Service versions.",
    url: "/terms",
    type: "website",
    images: ["/opengraph-image"],
  },
};

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const requested = Number.parseInt((await searchParams).version ?? "", 10);
  return <LegalDocumentPage documentKey="terms" versionNumber={Number.isSafeInteger(requested) && requested > 0 ? requested : null} />;
}
