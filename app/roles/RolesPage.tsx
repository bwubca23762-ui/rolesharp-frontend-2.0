import DirectorySearch from "@/components/reading/DirectorySearch";

type Role = { slug: string; title: string };

export default function RolesPage({ roles }: { roles: Role[] }) {
  const entries = roles.map(({ slug, title }) => ({ title, href: `/roles/${slug}` }));
  return <DirectorySearch entries={entries} kind="roles" placeholder="Enter a job title" />;
}
