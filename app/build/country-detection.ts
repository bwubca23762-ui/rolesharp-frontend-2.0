import { countryDisplayName } from "@/lib/country-display";

export type CountryIdentity = { code: string; name: string };

export function detectCountry(): CountryIdentity | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = new Intl.Locale(locale).region;
    if (region && /^[A-Z]{2}$/.test(region)) {
      return { code: region, name: countryDisplayName(region) };
    }
  } catch {}

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  if (timezone.includes("Kolkata")) return { code: "IN", name: "India" };
  if (timezone.includes("Dubai")) return { code: "AE", name: "United Arab Emirates" };
  if (timezone.includes("London")) return { code: "GB", name: "United Kingdom" };
  if (timezone.includes("New_York") || timezone.includes("Los_Angeles") || timezone.includes("Chicago")) {
    return { code: "US", name: "United States" };
  }
  return null;
}

export async function detectCountryByIp(): Promise<CountryIdentity | null> {
  try {
    const response = await fetch("/api/geo");
    const data = await response.json();
    if (data?.detected && data.code) {
      const code = String(data.code).toUpperCase();
      return { code, name: data.name || countryDisplayName(code) };
    }
  } catch {}
  return null;
}

export async function countryByCode(code: string): Promise<CountryIdentity | null> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  try {
    const response = await fetch("/api/countries");
    const countries = await response.json();
    const match = Array.isArray(countries)
      ? countries.find((item) => item?.code === normalized)
      : null;
    if (match) return { code: match.code, name: match.name };
  } catch {}
  return { code: normalized, name: countryDisplayName(normalized) };
}
