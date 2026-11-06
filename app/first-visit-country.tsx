"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/primitives/Button";
import { Select } from "@/components/ui/primitives/Form";
import { getCookieConsent, onCookieConsentChange } from "@/lib/cookie-consent";
import { flagEmoji } from "@/lib/country-codes";

// Asks the visitor to confirm their country so we can tailor to the local
// hiring market. Uses accurate Cloudflare IP geo (/api/geo) with an Intl-locale
// fallback. Rendered as a FIXED bottom bar so it never shifts page layout
// (keeps CLS at 0 — a layout banner inside the hero caused CLS 0.16).

type C = { code: string; name: string; flag: string };

function detectLocale(): C | null {
  try {
    const region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).region;
    if (!region || region.length !== 2) return null;
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(region);
    if (!name) return null;
    return { code: region, name, flag: flagEmoji(region) };
  } catch { return null; }
}

export default function FirstVisitCountry() {
  const [country, setCountry] = useState<C | null>(null);
  const [show, setShow] = useState(false);
  const [changing, setChanging] = useState(false);
  const [all, setAll] = useState<C[]>([]);
  // Both this pill and the cookie banner are bottom-anchored and full-width on
  // mobile, and the banner sits above it (z-80 vs z-50), so a first-time
  // visitor saw the pill completely covered. Wait for the consent choice, then
  // take the space the banner just vacated.
  const [consentSettled, setConsentSettled] = useState(true);

  useEffect(() => {
    setConsentSettled(getCookieConsent() !== null);
    return onCookieConsentChange(() => setConsentSettled(true));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem("rolesharp-country")) return;
      if (localStorage.getItem("rolesharp-country-dismissed")) return;
    } catch {}
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onScroll: (() => void) | undefined;
    (async () => {
      let c: C | null = null;
      try {
        const r = await fetch("/api/geo");
        const j = await r.json();
        if (j?.detected) c = { code: j.code, name: j.name, flag: j.flag };
      } catch {}
      if (!c) c = detectLocale();
      // Keep the first screen focused on the resume decision. Reveal this
      // prompt after the visitor moves beyond the hero, with a quiet timeout
      // fallback for people who pause on the page.
      if (c) {
        setCountry(c);
        const reveal = () => {
          setShow(true);
          if (onScroll) window.removeEventListener("scroll", onScroll);
        };
        onScroll = () => {
          if (window.scrollY > Math.min(640, window.innerHeight * 0.75)) reveal();
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        timer = setTimeout(reveal, 12_000);
      }
    })();
    return () => {
      clearTimeout(timer);
      if (onScroll) window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const save = (c: C) => {
    try { localStorage.setItem("rolesharp-country", JSON.stringify(c)); } catch {}
    setShow(false);
  };

  const dismiss = () => {
    try { localStorage.setItem("rolesharp-country-dismissed", "1"); } catch {}
    setShow(false);
  };

  const openChange = async () => {
    setChanging(true);
    if (!all.length) {
      try {
        const r = await fetch("/api/countries");
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j?.countries;
        if (Array.isArray(arr)) setAll(arr.map((x: any) => ({ code: x.code, name: x.name, flag: x.flag })));
      } catch {}
    }
  };

  if (!show || !country || !consentSettled) return null;

  // Compact floating pill (not a full-width sheet): one short line + inline
  // 48px actions, anchored bottom-right on larger screens, so it never covers
  // the hero CTAs on small screens.
  return (
    <div
      className="first-visit-country fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 left-3 sm:left-auto sm:max-w-md z-50 rounded-2xl border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] shadow-[var(--shadow-lg)]"
      role="dialog"
      aria-label="Confirm your country"
    >
      <div className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          {!changing ? (
            <>
              <span className="text-lg shrink-0" aria-hidden="true">{country.flag}</span>
              <span className="flex-1 min-w-0 text-sm leading-snug text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                Job hunting in <strong>{country.name}</strong>?
              </span>
              <Button as="a" href={`/build#country=${country.code}`} size="sm" className="min-h-[48px] shrink-0" onClick={() => save(country)}>
                Yes
              </Button>
              <Button variant="outline" size="sm" className="min-h-[48px] shrink-0" onClick={openChange}>Change</Button>
            </>
          ) : (
            <>
              <Select
                className="flex-1 min-w-0"
                defaultValue={country.code}
                onChange={(e) => {
                  const c = all.find((x) => x.code === e.target.value) || country;
                  setCountry(c);
                }}
                aria-label="Select your country"
              >
                {(all.length ? all : [country]).map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </Select>
              <Button as="a" href={`/build#country=${country.code}`} size="sm" className="min-h-[48px] shrink-0" onClick={() => save(country)}>
                Confirm
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="inline-flex items-center justify-center w-12 h-12 -mr-1.5 shrink-0 rounded-full text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)] dark:hover:bg-[var(--color-dark-surface-2)] transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
