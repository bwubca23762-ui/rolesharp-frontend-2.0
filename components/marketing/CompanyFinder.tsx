"use client";

import { useId, useState } from "react";
import { useAutocomplete } from "@/app/build/use-autocomplete";

type Company = { slug: string; name: string; sector?: string | null };

/**
 * The landing proof strip's company search.
 *
 * It is a real query against /api/companies/search, not a picture of a search
 * box: the point of the strip is that the catalogue is verifiable, and a
 * decorative input under a claim about 113,113 guides would undercut the one
 * thing this page is selling.
 *
 * Results are links rather than buttons. They navigate, so a link is the honest
 * element â€” and it keeps middle-click, open-in-new-tab and the status bar
 * preview working, which matter more here than matching the button-based
 * pattern in BuildLauncher (that one sets form state instead of navigating).
 */
export function CompanyFinder() {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const statusId = useId();

  const { results } = useAutocomplete<Company>({
    query,
    url: `/api/companies/search?q=${encodeURIComponent(query.trim())}`,
    minimumLength: 2,
  });

  const shown = results.slice(0, 6);
  const typedEnough = query.trim().length >= 2;

  return (
    <div className="relative">
      {/* A visible label, not a placeholder standing in for one (DESIGN.md Â§5). */}
      <label
        htmlFor={inputId}
        className="block font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--muted-fg)]"
      >
        Find yours
      </label>
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type your companyâ€¦"
        aria-describedby={statusId}
        className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[0.9375rem] text-[var(--fg)] placeholder:text-[var(--muted-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      />

      {/* Without this the list simply appears, which a screen reader never hears. */}
      <p id={statusId} aria-live="polite" className="sr-only">
        {!typedEnough
          ? "Type at least two characters to search company guides."
          : shown.length === 0
            ? "No company guides match yet."
            : `${shown.length} company guide${shown.length === 1 ? "" : "s"} available.`}
      </p>

      {shown.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
          {shown.map((company) => (
            <li key={company.slug}>
              <a
                href={`/companies/${company.slug}`}
                className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]"
              >
                <span>{company.name}</span>
                {company.sector && (
                  <span className="shrink-0 text-xs text-[var(--muted-fg)]">{company.sector}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
