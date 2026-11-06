export type JobCountry = {
  code: string;
  name: string;
  tier: 1 | 2 | 3;
  slug: string;
};

export const JOB_COUNTRIES: readonly JobCountry[] = [
  { code: "US", name: "United States", tier: 1, slug: "united-states" },
  { code: "GB", name: "United Kingdom", tier: 1, slug: "united-kingdom" },
  { code: "CA", name: "Canada", tier: 1, slug: "canada" },
  { code: "IN", name: "India", tier: 1, slug: "india" },
  { code: "DE", name: "Germany", tier: 1, slug: "germany" },
  { code: "FR", name: "France", tier: 1, slug: "france" },
  { code: "ES", name: "Spain", tier: 1, slug: "spain" },
  { code: "JP", name: "Japan", tier: 1, slug: "japan" },
  { code: "AE", name: "United Arab Emirates", tier: 1, slug: "united-arab-emirates" },
  { code: "AU", name: "Australia", tier: 2, slug: "australia" },
  { code: "BR", name: "Brazil", tier: 2, slug: "brazil" },
  { code: "MX", name: "Mexico", tier: 2, slug: "mexico" },
  { code: "IT", name: "Italy", tier: 2, slug: "italy" },
  { code: "NL", name: "Netherlands", tier: 2, slug: "netherlands" },
  { code: "SG", name: "Singapore", tier: 2, slug: "singapore" },
  { code: "IE", name: "Ireland", tier: 2, slug: "ireland" },
  { code: "PL", name: "Poland", tier: 2, slug: "poland" },
  { code: "PT", name: "Portugal", tier: 2, slug: "portugal" },
  { code: "SE", name: "Sweden", tier: 2, slug: "sweden" },
  { code: "CH", name: "Switzerland", tier: 2, slug: "switzerland" },
  { code: "TR", name: "Turkey", tier: 2, slug: "turkey" },
  { code: "SA", name: "Saudi Arabia", tier: 2, slug: "saudi-arabia" },
  { code: "KR", name: "South Korea", tier: 2, slug: "south-korea" },
  { code: "ZA", name: "South Africa", tier: 2, slug: "south-africa" },
  { code: "NG", name: "Nigeria", tier: 2, slug: "nigeria" },
  { code: "PH", name: "Philippines", tier: 2, slug: "philippines" },
  { code: "ID", name: "Indonesia", tier: 2, slug: "indonesia" },
  { code: "PK", name: "Pakistan", tier: 2, slug: "pakistan" },
  { code: "NZ", name: "New Zealand", tier: 2, slug: "new-zealand" },
  { code: "AR", name: "Argentina", tier: 3, slug: "argentina" },
  { code: "AT", name: "Austria", tier: 3, slug: "austria" },
  { code: "BH", name: "Bahrain", tier: 3, slug: "bahrain" },
  { code: "BD", name: "Bangladesh", tier: 3, slug: "bangladesh" },
  { code: "BE", name: "Belgium", tier: 3, slug: "belgium" },
  { code: "BG", name: "Bulgaria", tier: 3, slug: "bulgaria" },
  { code: "CL", name: "Chile", tier: 3, slug: "chile" },
  { code: "CN", name: "China", tier: 3, slug: "china" },
  { code: "CO", name: "Colombia", tier: 3, slug: "colombia" },
  { code: "CR", name: "Costa Rica", tier: 3, slug: "costa-rica" },
  { code: "HR", name: "Croatia", tier: 3, slug: "croatia" },
  { code: "CY", name: "Cyprus", tier: 3, slug: "cyprus" },
  { code: "CZ", name: "Czech Republic", tier: 3, slug: "czech-republic" },
  { code: "DK", name: "Denmark", tier: 3, slug: "denmark" },
  { code: "EC", name: "Ecuador", tier: 3, slug: "ecuador" },
  { code: "EG", name: "Egypt", tier: 3, slug: "egypt" },
  { code: "EE", name: "Estonia", tier: 3, slug: "estonia" },
  { code: "FI", name: "Finland", tier: 3, slug: "finland" },
  { code: "GR", name: "Greece", tier: 3, slug: "greece" },
  { code: "HK", name: "Hong Kong", tier: 3, slug: "hong-kong" },
  { code: "HU", name: "Hungary", tier: 3, slug: "hungary" },
  { code: "IL", name: "Israel", tier: 3, slug: "israel" },
  { code: "KW", name: "Kuwait", tier: 3, slug: "kuwait" },
  { code: "LV", name: "Latvia", tier: 3, slug: "latvia" },
  { code: "LT", name: "Lithuania", tier: 3, slug: "lithuania" },
  { code: "LU", name: "Luxembourg", tier: 3, slug: "luxembourg" },
  { code: "MY", name: "Malaysia", tier: 3, slug: "malaysia" },
  { code: "MT", name: "Malta", tier: 3, slug: "malta" },
  { code: "MA", name: "Morocco", tier: 3, slug: "morocco" },
  { code: "NO", name: "Norway", tier: 3, slug: "norway" },
  { code: "OM", name: "Oman", tier: 3, slug: "oman" },
  { code: "PA", name: "Panama", tier: 3, slug: "panama" },
  { code: "PE", name: "Peru", tier: 3, slug: "peru" },
  { code: "QA", name: "Qatar", tier: 3, slug: "qatar" },
  { code: "RO", name: "Romania", tier: 3, slug: "romania" },
  { code: "SK", name: "Slovakia", tier: 3, slug: "slovakia" },
  { code: "SI", name: "Slovenia", tier: 3, slug: "slovenia" },
  { code: "TH", name: "Thailand", tier: 3, slug: "thailand" },
  { code: "TW", name: "Taiwan", tier: 3, slug: "taiwan" },
  { code: "UA", name: "Ukraine", tier: 3, slug: "ukraine" },
  { code: "UY", name: "Uruguay", tier: 3, slug: "uruguay" },
  { code: "VE", name: "Venezuela", tier: 3, slug: "venezuela" },
  { code: "VN", name: "Vietnam", tier: 3, slug: "vietnam" },
] as const;

export const TIER3_CODES = JOB_COUNTRIES.filter((country) => country.tier === 3).map((country) => country.code);
export const POPULAR_CHIP_CODES = ["US", "GB", "CA", "IN", "DE", "AU", "SG", "AE", "FR", "JP"] as const;

const JOB_COUNTRIES_BY_CODE = new Map(JOB_COUNTRIES.map((country) => [country.code, country]));
const JOB_COUNTRIES_BY_SLUG = new Map(JOB_COUNTRIES.map((country) => [country.slug, country]));

export function getCountryByCode(code?: string | null) {
  return code ? JOB_COUNTRIES_BY_CODE.get(code.toUpperCase()) ?? null : null;
}

export function getCountryBySlug(slug?: string | null) {
  return slug ? JOB_COUNTRIES_BY_SLUG.get(slug) ?? null : null;
}

export function refreshLabelForTier(tier: JobCountry["tier"]) {
  return tier === 1 ? "Refreshed through the day" : tier === 2 ? "Refreshed twice a day" : "Refreshed daily";
}

export function refreshLabelForCountry(code?: string | null) {
  return refreshLabelForTier(getCountryByCode(code)?.tier ?? 1);
}

export function metadataRefreshLabel(tier: JobCountry["tier"]) {
  return tier === 1 ? "Through the Day" : tier === 2 ? "Twice Daily" : "Daily";
}

export function countryShortName(country: JobCountry) {
  if (country.code === "US") return "US";
  if (country.code === "GB") return "UK";
  if (country.code === "AE") return "UAE";
  return country.name;
}
