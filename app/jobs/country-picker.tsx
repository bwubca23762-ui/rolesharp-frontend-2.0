"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/primitives/Button";
import { Select } from "@/components/ui/primitives/Form";
import { Container } from "@/components/ui/primitives/Container";
import {
  countryShortName,
  getCountryByCode,
  JOB_COUNTRIES,
  type JobCountry,
} from "@/lib/job-config";

const POPULAR_SLUGS = [
  "united-states",
  "united-kingdom",
  "canada",
  "india",
  "germany",
  "australia",
  "singapore",
  "france",
] as const;

const ALL_COUNTRIES_ALPHA = [...JOB_COUNTRIES].sort((a, b) =>
  a.name.localeCompare(b.name),
);

function flag(code: string) {
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

const DEFAULT_COUNTRY = JOB_COUNTRIES.find((c) => c.slug === "united-states") ?? JOB_COUNTRIES[0];

type CountryPickerProps = {
  basePath: "jobs" | "internships";
  resultLabel?: string;
  heroKicker?: string;
  heroTitle?: string;
  heroSubtitle?: string;
};

export default function CountryPicker({
  basePath,
  resultLabel = basePath,
  heroKicker,
  heroTitle = "Find fresh jobs in your country",
  heroSubtitle,
}: CountryPickerProps) {
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY.code);
  const [initialized, setInitialized] = useState(false);
  // Role/company keyword — carried to the country results page as ?q=. Without
  // this, the most basic job-search input ("data analyst") only appears AFTER
  // picking a country, which reads as "there is no search".
  const [query, setQuery] = useState("");

  const selectedCountry = useMemo(
    () => getCountryByCode(countryCode) ?? DEFAULT_COUNTRY,
    [countryCode],
  );

  const popularCountries = useMemo(
    () =>
      POPULAR_SLUGS.map((slug) => JOB_COUNTRIES.find((c) => c.slug === slug))
        .filter((c): c is JobCountry => Boolean(c)),
    [],
  );
  const otherCountries = useMemo(() => {
    const popularCodes = new Set(popularCountries.map((country) => country.code));
    return ALL_COUNTRIES_ALPHA.filter((country) => !popularCodes.has(country.code));
  }, [popularCountries]);

  useEffect(() => {
    let cancelled = false;

    const resolveCountry = async () => {
      try {
        const stored = JSON.parse(localStorage.getItem("rolesharp-country") || "null");
        if (stored?.code && getCountryByCode(stored.code)) {
          if (!cancelled) setCountryCode(stored.code.toUpperCase());
          if (!cancelled) setInitialized(true);
          return;
        }
      } catch {
        /* ignore localStorage errors */
      }

      try {
        const response = await fetch("/api/geo", { cache: "no-store" });
        const data = await response.json();
        if (data?.detected && data?.code && getCountryByCode(data.code)) {
          if (!cancelled) setCountryCode(data.code.toUpperCase());
        }
      } catch {
        /* keep default US */
      } finally {
        if (!cancelled) setInitialized(true);
      }
    };

    resolveCountry();
    return () => {
      cancelled = true;
    };
  }, []);

  const labelText = `Searching ${resultLabel} in ${selectedCountry.name}`;
  const goHref = `/${basePath}/${selectedCountry.slug}${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`;

  return (
    <section className="jobs-picker-hero border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)]">
      <Container size="small" className="py-8 md:py-12">
        {heroKicker && (
          <p className="text-sm font-semibold text-[var(--color-primary)] dark:text-[var(--color-primary)] mb-2">
            {heroKicker}
          </p>
        )}
        <h2 className="text-[1.75rem] md:text-3xl font-extrabold leading-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2 tracking-tight">
          {heroTitle}
        </h2>
        {heroSubtitle && (
          <p className="text-[15px] md:text-base text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-6 max-w-2xl leading-relaxed">
            {heroSubtitle}
          </p>
        )}

        <div className="bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] rounded-[var(--radius-xl)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] shadow-[var(--shadow-md)] p-4 md:p-5">
          {initialized ? (
            <p className="text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-3">
              {labelText}
            </p>
          ) : (
            <p className="text-sm font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-3">
              Detecting your location…
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <label htmlFor="jobs-keyword" className="sr-only">
                Role or company keyword
              </label>
              <input
                id="jobs-keyword"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") window.location.assign(goHref);
                }}
                placeholder={basePath === "jobs" ? "Role or company, e.g. data analyst" : "Role keyword, e.g. marketing intern"}
                className="w-full min-h-[44px] px-4 rounded-[var(--radius)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] text-[var(--color-text)] dark:text-[var(--color-dark-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="flex-1">
              <Select
                aria-label="Choose a country"
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
              >
                <optgroup label="Popular">
                  {popularCountries.map((country) => (
                    <option value={country.code} key={`popular-${country.code}`}>
                      {flag(country.code)} {country.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="All countries (A-Z)">
                  {otherCountries.map((country) => (
                    <option value={country.code} key={`all-${country.code}`}>
                      {flag(country.code)} {country.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
            <Button
              as="a"
              href={goHref}
              size="md"
              className="w-full sm:w-auto whitespace-nowrap"
            >
              Find {resultLabel}
            </Button>
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] uppercase tracking-wide mb-2">
              Browse popular countries
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Popular countries">
              {popularCountries.map((country) => {
                const active = countryCode === country.code;
                return (
                  <Link
                    key={country.code}
                    href={`/${basePath}/${country.slug}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full border transition-colors ${
                      active
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                        : "bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] border-[var(--color-border)] dark:border-[var(--color-dark-border)] text-[var(--color-text)] dark:text-[var(--color-dark-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span aria-hidden="true">{flag(country.code)}</span>
                    <span>{countryShortName(country)}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <details className="mt-4 border-t border-[var(--color-border)] pt-4 dark:border-[var(--color-dark-border)]">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] dark:text-[var(--color-dark-text)]">
              Browse all {JOB_COUNTRIES.length} countries
            </summary>
            <nav
              aria-label={`All countries for ${resultLabel}`}
              className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4"
            >
              {ALL_COUNTRIES_ALPHA.map((country) => (
                <Link
                  key={`directory-${country.code}`}
                  href={`/${basePath}/${country.slug}`}
                  className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] dark:text-[var(--color-dark-text-muted)]"
                >
                  {country.name}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </Container>
    </section>
  );
}
