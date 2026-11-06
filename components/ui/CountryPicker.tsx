"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown } from "@/app/icons";
import { fallbackCountries } from "@/lib/country-codes";

export type Country = {
  code: string;
  name: string;
  flag: string;
  count: number;
  rules?: Record<string, unknown>;
};

export default function CountryPicker({
  value,
  onChange,
  id = "country-picker",
  includeRules = false,
}: {
  value: string;
  onChange: (code: string, name: string, country: Country) => void;
  id?: string;
  includeRules?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Country[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // One-time fetch + cache via browser
  useEffect(() => {
    fetch(includeRules ? "/api/countries/rules" : "/api/countries")
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Country list unavailable")))
      .then((arr: Country[]) => {
        const received = Array.isArray(arr) ? arr.filter((country) => /^[A-Z]{2}$/.test(country.code)) : [];
        const receivedCodes = new Set(received.map((country) => country.code));
        setList([...received, ...fallbackCountries().filter((country) => !receivedCodes.has(country.code))]);
      })
      .catch(() => setList(fallbackCountries()));
  }, [includeRules]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const selected = list.find((c) => c.code === value);

  const filtered = q.trim()
    ? list.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase() === q.toLowerCase())
    : list;

  const pick = useCallback((c: Country) => {
    onChange(c.code, c.name, c);
    setQ("");
    setOpen(false);
    setActive(-1);
  }, [onChange]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (open && active >= 0 && filtered[active]) pick(filtered[active]); }
    else if (e.key === "Escape") { setOpen(false); setActive(-1); }
  };

  return (
    <div className="country-picker" onKeyDown={onKey} ref={rootRef}>
      <button
        id={id}
        type="button"
        className="field country-picker-btn"
        role="combobox"
        aria-label="Country"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-haspopup="listbox"
        aria-activedescendant={open && active >= 0 && filtered[active] ? `${id}-option-${filtered[active].code}` : undefined}
        onClick={() => { setOpen((v) => !v); setQ(""); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        {selected ? <span>{selected.flag} {selected.name}</span> : <span className="text-[var(--muted-fg)]">Choose a country…</span>}
        <ChevronDown size={16} className={open ? "rotated" : ""} />
      </button>
      {open && (
        <div className="country-picker-drop">
          <input
            ref={inputRef}
            className="field country-picker-search"
            aria-label="Search countries"
            aria-controls={`${id}-listbox`}
            aria-activedescendant={active >= 0 && filtered[active] ? `${id}-option-${filtered[active].code}` : undefined}
            placeholder="Search countries…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            autoFocus
          />
          <div
            className="country-picker-list"
            role="listbox"
            id={`${id}-listbox`}
          >
            {filtered.length === 0 && <div className="country-picker-empty text-[var(--muted-fg)]">No countries match</div>}
            {filtered.map((c, i) => (
              <div
                id={`${id}-option-${c.code}`}
                key={c.code}
                role="option"
                aria-selected={value === c.code}
                className={`country-picker-opt ${i === active ? "active" : ""} ${value === c.code ? "selected" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
              >
                <span>{c.flag} {c.name}</span>
                <span className="text-[12px] text-[var(--muted-fg)]">{c.count > 0 ? `${c.count.toLocaleString()} company guides` : "Supported"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
