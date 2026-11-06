import { q } from "@/lib/db";
import { fallbackCountries, flagEmoji } from "@/lib/country-codes";
import { resumeMarketRules } from "@/lib/resume-market-rules";

type CountryRow = {
  code: string;
  name: string;
  count: string;
  rules?: Record<string, unknown>;
};

const cache = new Map<string, { expiresAt: number; data: unknown[] }>();
const TTL_MS = 5 * 60 * 1000;

export async function countryList(includeRules = false) {
  const cacheKey = includeRules ? "detailed" : "summary";
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const rows = await q<CountryRow>(
    `select trim(c.code) as code, c.name, count(co.id)::text as count${includeRules ? ", c.rules" : ""}
     from countries c
     left join companies co on co.country_code = c.code
     where c.code ~ '^[A-Z]{2}$'
     group by c.code, c.name, c.priority${includeRules ? ", c.rules" : ""}
     order by c.priority, c.name`,
  ).catch(() => []);

  // The database can contain a curated subset during a new deployment. Resume
  // tools must still remain selectable for every ISO market, so retain the
  // database ordering/counts and append any missing ISO 3166-1 country or
  // territory from the deterministic fallback catalogue.
  const databaseCodes = new Set(rows.map((row) => row.code.toUpperCase()));
  const source = [
    ...rows,
    ...fallbackCountries()
      .filter((country) => !databaseCodes.has(country.code))
      .map((country) => ({
        code: country.code,
        name: country.name,
        count: "0",
        ...(includeRules ? { rules: resumeMarketRules(country.code) } : {}),
      })),
  ];

  const data = source.map((row) => ({
    code: row.code,
    name: row.name,
    flag: flagEmoji(row.code),
    count: Number(row.count),
    ...(includeRules ? { rules: row.rules ?? resumeMarketRules(row.code) } : {}),
  }));

  cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, data });
  return data;
}
