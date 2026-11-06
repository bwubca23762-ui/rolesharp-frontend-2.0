"use client";

import { useEffect, useRef, useState } from "react";

type AutocompleteOptions = {
  query: string;
  url: string;
  minimumLength?: number;
  enabled?: boolean;
  debounceMs?: number;
};

export function useAutocomplete<T>({
  query,
  url,
  minimumLength = 0,
  enabled = true,
  debounceMs = 200,
}: AutocompleteOptions) {
  const [results, setResults] = useState<T[]>([]);
  const requestSequence = useRef(0);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!enabled || normalizedQuery.length < minimumLength) {
      setResults([]);
      return;
    }

    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("autocomplete_unavailable");
        const data = await response.json();
        if (sequence === requestSequence.current) {
          setResults(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if ((error as { name?: string })?.name !== "AbortError" && sequence === requestSequence.current) {
          setResults([]);
        }
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [debounceMs, enabled, minimumLength, query, url]);

  return { results, setResults };
}
