"use client";

import { useState } from "react";
import Link from "next/link";
import type { MapRole } from "@/lib/career-map";

// The 60-role pill cloud used to render unsorted and unfilterable — finding
// one title on mobile meant scrolling all of them. Client-side title filter;
// the links and aria-current behaviour are identical to the previous markup.
export default function RoleFilter({ roles, selectedSlug }: { roles: MapRole[]; selectedSlug?: string }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = q ? roles.filter((role) => role.title.toLowerCase().includes(q)) : roles;

  return (
    <>
      <div className="mb-4">
        <label htmlFor="role-filter" className="sr-only">Filter roles by title</label>
        <input
          id="role-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter roles — e.g. analyst, engineer…"
          className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]"
        />
        {q && <p className="mt-1.5 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]" role="status">{visible.length} of {roles.length} roles</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((role) => (
          <Link
            key={role.slug}
            href={`/career-map?role=${role.slug}`}
            aria-current={selectedSlug === role.slug ? "true" : undefined}
            className={`rounded-[var(--radius-lg)] border px-4 py-2 text-sm font-medium transition-colors ${
              selectedSlug === role.slug
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] text-[var(--color-text)] dark:text-[var(--color-dark-text)] hover:border-[var(--color-primary)]"
            }`}
          >
            {role.title}
          </Link>
        ))}
        {visible.length === 0 && <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">No role titles match. Try a shorter fragment — "data", "ops", "engineer".</p>}
      </div>
    </>
  );
}
