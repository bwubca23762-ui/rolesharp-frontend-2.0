"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "@/app/icons";
import { Button, Input, Label } from "@/components/ui/primitives";

export default function RoleBankExplorer({ roles }: { roles: Array<{ slug: string; title: string }> }) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const filtered = roles.filter((role) => role.title.toLowerCase().includes(search) || role.slug.includes(search));

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(15rem,.65fr)_minmax(0,1.65fr)] lg:gap-12">
      <div>
        <Label htmlFor="role-bank-search">Find a role</Label>
        <div className="relative">
          <Search size={17} aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 my-auto text-[var(--muted-fg)]" />
          <Input id="role-bank-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="E.g. Data Analyst" className="pl-9" />
        </div>
        <div className="mt-5 border-t border-[var(--hairline)] pt-4">
          <p className="text-sm leading-6 text-[var(--muted-fg)]">Use a saved resume to practise with questions about your own work.</p>
          <Button as="a" href="/interview-prep" variant="outline" className="mt-3">Practise with a resume</Button>
        </div>
      </div>

      <section aria-labelledby="role-bank-results" className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--hairline)] pb-3">
          <h2 id="role-bank-results" className="text-xl font-semibold tracking-tight">Role question banks</h2>
          <p role="status" className="text-sm tabular-nums text-[var(--muted-fg)]">{filtered.length} {filtered.length === 1 ? "role" : "roles"}</p>
        </div>
        {filtered.length ? (
          <ul className="grid sm:grid-cols-2 sm:gap-x-8">
            {filtered.map((role) => (
              <li key={role.slug} className="min-w-0 border-b border-[var(--hairline)]">
                <Link href={`/interview-questions/${role.slug}`} className="group flex min-h-14 items-center justify-between gap-3 rounded-sm py-3 font-semibold text-[var(--fg)] transition-colors hover:text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] motion-reduce:transition-none">
                  <span className="min-w-0 break-words">{role.title}</span>
                  <span aria-hidden="true" className="text-[var(--muted-fg)] group-hover:text-[var(--primary)]">→</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-b border-[var(--hairline)] py-6">
            <p className="font-semibold">No matching roles</p>
            <p className="mt-1 text-sm text-[var(--muted-fg)]">Try a shorter title or see all available question banks.</p>
            <Button type="button" variant="outline" size="compact" className="mt-3" onClick={() => setQuery("")}>Show all roles</Button>
          </div>
        )}
      </section>
    </div>
  );
}
