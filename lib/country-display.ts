const SEO_COUNTRY_NAMES: Record<string, string> = {
  US: "the United States",
  GB: "the United Kingdom",
  IN: "India",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  NL: "the Netherlands",
  IE: "Ireland",
  SG: "Singapore",
  JP: "Japan",
  CN: "China",
  BR: "Brazil",
  ES: "Spain",
  IT: "Italy",
  SE: "Sweden",
  CH: "Switzerland",
  IL: "Israel",
  AE: "the UAE",
  ZA: "South Africa",
  MX: "Mexico",
  PL: "Poland",
};

export function seoCountryName(code?: string | null): string | null {
  if (!code) return null;
  return SEO_COUNTRY_NAMES[code.toUpperCase()] ?? null;
}

export function countryDisplayName(code: string): string {
  const normalized = code.trim().toUpperCase();
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(normalized) || normalized;
  } catch {
    return normalized;
  }
}
