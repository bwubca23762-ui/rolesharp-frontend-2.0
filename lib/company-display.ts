// SEO display names for companies whose imported DB name carries a branch,
// store, or location suffix that searchers never type. GSC showed searchers
// querying "d mart resume format" while the page title said "D Mart Ganguru"
// (a single store branch) — a snippet mismatch that kills CTR. Map the slug
// (country-prefixed) to the name people actually search for; anything not
// listed passes through unchanged. Extend as GSC surfaces more cases.
const DISPLAY_OVERRIDES: Record<string, string> = {
  "in-d-mart-ganguru": "D-Mart",
};

export function companyDisplayName(slug: string, dbName: string): string {
  return DISPLAY_OVERRIDES[slug] ?? dbName;
}
