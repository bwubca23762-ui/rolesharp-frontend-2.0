"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/primitives";

export type DirectoryEntry = {
  title: string;
  href: string;
  description?: string;
};

export default function DirectorySearch({
  entries,
  kind,
  placeholder,
}: {
  entries: DirectoryEntry[];
  kind: "companies" | "roles";
  placeholder: string;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const results = entries.filter((entry) => entry.title.toLocaleLowerCase().includes(needle));
  const status = results.length
    ? `${results.length} ${results.length === 1 ? (kind === "companies" ? "company" : "role") : kind}`
    : entries.length
      ? `No ${kind} match. Try a shorter search.`
      : `No ${kind} are available right now.`;

  return (
    <div className="reading-directory">
      <div>
        <label htmlFor={searchId}>Search {kind}</label>
        <Input
          id={searchId}
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p className="reading-directory-status" role="status">{status}</p>
      {results.length > 0 && (
        <ul className="reading-rows">
          {results.map(({ title, href, description }) => (
            <li key={href}>
              <a href={href} className="reading-row">
                <span>
                  <span className="reading-row-heading">{title}</span>
                  {description && <span className="reading-row-caption">{description}</span>}
                </span>
                <span aria-hidden="true" className="reading-row-arrow">→</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
