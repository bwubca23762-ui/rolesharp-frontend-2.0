"use client";

// One saved country across surfaces. The first-visit prompt and the jobs
// picker already persist the visitor's confirmed market here; the tools
// (checker, fixer, builder) read it so they stop disagreeing — the checker
// geo-detecting India while the fixer hardcodes the US while the builder
// waits for a URL param reads as three different products.

const COUNTRY_KEY = "rolesharp-country";

export type SavedCountry = { code: string; name: string };

export function savedCountry(): SavedCountry | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(COUNTRY_KEY) || "null");
    if (stored?.code && /^[A-Za-z]{2}$/.test(String(stored.code))) {
      return { code: String(stored.code).toUpperCase(), name: String(stored.name || "") };
    }
  } catch {}
  return null;
}
