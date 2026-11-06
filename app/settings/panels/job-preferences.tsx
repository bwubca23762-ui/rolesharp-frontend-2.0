"use client";
import { useEffect, useState } from "react";
import { Button, Input, Label, Notice, Select } from "@/components/ui/primitives";
import { JOB_COUNTRIES } from "@/lib/job-config";
import { Target } from "../../icons";
import Skeleton from "@/components/ui/Skeleton";
import FeatureSection from "../feature-section";

// Declared deal breakers (Phase 2). Saving here feeds the match scorer's veto
// layer (lib/job-match/scoring-v2.ts): a posting below the salary floor or a
// non-remote posting when remote-only is set is excluded from Daily Matches
// and RoleSharp Apply no matter how well it scores. The languages field is
// stored for profile matching — it does not veto yet, and the copy says so.

const CURRENCIES = ["USD", "GBP", "INR", "EUR", "CAD", "AUD", "AED", "SGD"] as const;

type Preferences = {
  minSalary: number;
  currency: string;
  remoteOnly: boolean;
  languages: string[];
  locationScope: "in_country" | "out_of_country" | "both";
  homeCountry: string | null;
  targetCountries: string[];
};

export default function JobPreferencesPanel() {
  const [prefs, setPrefs] = useState<Preferences>({
    minSalary: 0, currency: "USD", remoteOnly: false, languages: [],
    locationScope: "both", homeCountry: null, targetCountries: [],
  });
  const [targetCountriesText, setTargetCountriesText] = useState("");
  const [languagesText, setLanguagesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/job-preferences", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok || !data || typeof data !== "object") throw new Error("unavailable");
        const p = (data.preferences ?? {}) as Partial<Preferences>;
        setPrefs({
          minSalary: Number(p.minSalary ?? 0), currency: p.currency ?? "USD",
          remoteOnly: Boolean(p.remoteOnly), languages: p.languages ?? [],
          locationScope: p.locationScope ?? "both", homeCountry: p.homeCountry ?? null,
          targetCountries: p.targetCountries ?? [],
        });
        setLanguagesText((p.languages ?? []).join(", "));
        setTargetCountriesText((p.targetCountries ?? []).join(", "));
      })
      .catch(() => { if (active) setError("Preferences are temporarily unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save() {
    if (busy) return; // one save in flight
    setBusy(true); setMessage(""); setError("");
    try {
      const languages = languagesText.split(",").map((l) => l.trim()).filter((l) => l.length >= 2).slice(0, 10);
      const res = await fetch("/api/job-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minSalary: Math.max(0, Math.round(Number(prefs.minSalary) || 0)),
          currency: prefs.currency,
          remoteOnly: prefs.remoteOnly,
          languages,
          locationScope: prefs.locationScope,
          homeCountry: prefs.homeCountry,
          targetCountries: targetCountriesText.split(",").map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)).slice(0, 20),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(res.status === 400 ? "Check the values — something was out of range." : "Could not save right now. Try again in a moment.");
        return;
      }
      const saved = data.preferences as Preferences;
      setPrefs(saved);
      setLanguagesText((saved.languages ?? []).join(", "));
      setMessage("Saved. Daily Matches and RoleSharp Apply will respect these from the next run.");
    } catch {
      setError("Could not save right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FeatureSection
      icon={<Target size={20} />}
      title="Job matching preferences"
      description="Your hard lines for Daily Matches and RoleSharp Apply. Postings that violate them are excluded before you ever see them."
    >
      {message && <Notice variant="success" role="status" className="mb-4">{message}</Notice>}
      {error && <Notice variant="danger" role="alert" className="mb-4">{error}</Notice>}
      {loading ? (
        <div className="grid gap-3" aria-busy="true">
          <Skeleton variant="card" height="6rem" />
          <Skeleton variant="card" height="6rem" />
        </div>
      ) : (
        <div className="grid gap-5">
          <fieldset className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]">
            <legend className="px-1.5 text-sm font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Job locations</legend>
            <div className="grid gap-2">
              {([
                { value: "in_country", label: "In my home country only" },
                { value: "out_of_country", label: "Abroad / international only" },
                { value: "both", label: "Both home and international" },
              ] as const).map((option) => (
                <label key={option.value} className="flex min-h-9 items-center gap-2 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  <input
                    type="radio"
                    name="pref-location-scope"
                    checked={prefs.locationScope === option.value}
                    onChange={() => setPrefs({ ...prefs, locationScope: option.value })}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pref-home-country">Home country</Label>
                <Select id="pref-home-country" value={prefs.homeCountry ?? ""} onChange={(e) => setPrefs({ ...prefs, homeCountry: e.target.value || null })}>
                  <option value="">Not set</option>
                  {JOB_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </Select>
              </div>
              {prefs.locationScope !== "in_country" && (
                <div>
                  <Label htmlFor="pref-target-countries">Target countries (2-letter codes, comma-separated)</Label>
                  <Input
                    id="pref-target-countries"
                    value={targetCountriesText}
                    onChange={(e) => setTargetCountriesText(e.target.value)}
                    placeholder="US, GB, CA, DE, AE"
                  />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Job suggestions after you build a resume respect these. Leave target countries empty and a sensible default set is used.
            </p>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <div>
              <Label htmlFor="pref-min-salary">Minimum salary (leave 0 for no floor)</Label>
              <Input
                id="pref-min-salary"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                value={prefs.minSalary || ""}
                onChange={(e) => setPrefs({ ...prefs, minSalary: Number(e.target.value) || 0 })}
                placeholder="e.g. 60000"
              />
            </div>
            <div>
              <Label htmlFor="pref-currency">Currency</Label>
              <Select id="pref-currency" value={prefs.currency} onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            The floor vetoes only postings whose stated salary is in the same currency — we never compare across currencies.
          </p>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              checked={prefs.remoteOnly}
              onChange={(e) => setPrefs({ ...prefs, remoteOnly: e.target.checked })}
            />
            <span className="text-sm leading-6 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              Remote only — exclude hybrid and onsite postings.
            </span>
          </label>
          <div>
            <Label htmlFor="pref-languages">Working languages (comma-separated — stored for profile matching; does not filter yet)</Label>
            <Input
              id="pref-languages"
              value={languagesText}
              onChange={(e) => setLanguagesText(e.target.value)}
              placeholder="English, Hindi"
              maxLength={120}
            />
          </div>
          <div>
            <Button onClick={save} disabled={busy} isLoading={busy}>Save preferences</Button>
          </div>
        </div>
      )}
    </FeatureSection>
  );
}
