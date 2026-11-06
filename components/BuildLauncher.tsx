"use client";

import { useState } from "react";
import { Button, Card, Label, Input } from "@/components/ui/primitives";
import CountryPicker from "@/components/ui/CountryPicker";
import { useAutocomplete } from "@/app/build/use-autocomplete";

/**
 * Turns a landing page into an actual entry point.
 *
 * /resume-translator and /resume-tailoring rank for tool intent but the work
 * itself is done by /build, which accepts prefill through the URL fragment
 * (see the `prefill()` reader in app/build/page.tsx). Rather than duplicating
 * the builder, collect the one or two values the page is about and hand them
 * over. Fragments are used, not query strings, so these stay off the indexed
 * URL surface — the same contract /resume/[company]/[role] already uses.
 */

type Company = { slug: string; name: string };
type Role = { slug: string; title: string };

export default function BuildLauncher({
  mode,
  heading,
  description,
  actionLabel,
}: {
  mode: "country" | "tailor";
  heading: string;
  description: string;
  actionLabel: string;
}) {
  const [countryCode, setCountryCode] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [company, setCompany] = useState<Company | null>(null);
  const [roleQuery, setRoleQuery] = useState("");
  const [role, setRole] = useState<Role | null>(null);

  const { results: companies } = useAutocomplete<Company>({
    query: companyQuery,
    url: `/api/companies/search?q=${encodeURIComponent(companyQuery.trim())}`,
    minimumLength: 2,
    enabled: mode === "tailor" && !(company && companyQuery === company.name),
  });
  const { results: roles } = useAutocomplete<Role>({
    query: roleQuery,
    url: `/api/roles?q=${encodeURIComponent(roleQuery.trim())}`,
    // /api/roles answers an empty query with defaults, which would drop an
    // unprompted suggestion list onto the page before anyone types.
    minimumLength: 2,
    enabled: mode === "tailor" && !(role && roleQuery === role.title),
  });

  const fragment = () => {
    const parts: string[] = [];
    if (mode === "country" && countryCode) parts.push(`country=${encodeURIComponent(countryCode)}`);
    if (mode === "tailor") {
      if (company?.slug) parts.push(`company=${encodeURIComponent(company.slug)}`);
      if (role?.slug) parts.push(`role=${encodeURIComponent(role.slug)}`);
    }
    return parts.length ? `/build#${parts.join("&")}` : "/build";
  };

  const ready = mode === "country" ? Boolean(countryCode) : Boolean(company || role);

  return (
    <Card padding="lg">
      <h2 className="text-xl font-bold tracking-[-0.025em] text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{heading}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{description}</p>

      {mode === "country" ? (
        <div className="mt-6">
          <Label htmlFor="launcher-country">Target country</Label>
          <CountryPicker id="launcher-country" value={countryCode} onChange={(code) => setCountryCode(code)} />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="relative">
            <Label htmlFor="launcher-company">Company</Label>
            <Input
              id="launcher-company"
              value={companyQuery}
              autoComplete="off"
              placeholder="Google, Infosys, Deloitte…"
              onChange={(event) => { setCompanyQuery(event.target.value); setCompany(null); }}
            />
            {companies.length > 0 && !company && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]">
                {companies.slice(0, 8).map((item) => (
                  <li key={item.slug}>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-surface-2)] dark:hover:bg-[var(--color-dark-surface-2)]"
                      onClick={() => { setCompany(item); setCompanyQuery(item.name); }}
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="relative">
            <Label htmlFor="launcher-role">Role</Label>
            <Input
              id="launcher-role"
              value={roleQuery}
              autoComplete="off"
              placeholder="Software Engineer, Analyst…"
              onChange={(event) => { setRoleQuery(event.target.value); setRole(null); }}
            />
            {roles.length > 0 && !role && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]">
                {roles.slice(0, 8).map((item) => (
                  <li key={item.slug}>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-surface-2)] dark:hover:bg-[var(--color-dark-surface-2)]"
                      onClick={() => { setRole(item); setRoleQuery(item.title); }}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mt-5">
        <Button as="a" href={fragment()} size="lg">{actionLabel}</Button>
        {!ready && (
          <p className="mt-3 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            {mode === "country"
              ? "Pick a country and the builder opens with that market's resume conventions applied."
              : "Pick a company or role and the builder opens already targeted."}
          </p>
        )}
      </div>
    </Card>
  );
}
