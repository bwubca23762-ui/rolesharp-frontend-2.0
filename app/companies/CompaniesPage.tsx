import DirectorySearch from "@/components/reading/DirectorySearch";

type Company = {
  slug: string;
  name: string;
  country_code?: string | null;
  hiring_listings: number;
};

export default function CompaniesPage({ companies }: { companies: Company[] }) {
  const entries = companies.map(({ slug, name, country_code, hiring_listings }) => ({
    title: name,
    href: `/companies/${slug}`,
    description: [
      country_code,
      hiring_listings > 0
        ? `${hiring_listings} live posting${hiring_listings === 1 ? "" : "s"} seen in 30 days`
        : null,
    ].filter(Boolean).join(" · "),
  }));
  return <DirectorySearch entries={entries} kind="companies" placeholder="Enter a company name" />;
}
