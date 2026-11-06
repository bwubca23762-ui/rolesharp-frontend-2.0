"use client";

import { useEffect, useId, useRef, useState } from "react";
import { KEY_LOCALES } from "@/lib/locales";
import { Globe } from "./icons";

export default function LanguagePicker({ pathname, onOpen }: { pathname: string; onOpen: () => void }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const active = KEY_LOCALES.find((locale) => `/${locale.slug}` === pathname);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={root}
      className="rs-language-picker"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="rs-language-trigger"
        aria-label="Language and region"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
      >
        <Globe size={18} aria-hidden="true" />
        <span>{(active?.lang.split("-")[0] ?? "en").toUpperCase()}</span>
      </button>
      {open && (
        <div id={id} className="rs-language-panel">
          <p className="rs-language-heading">Language and region</p>
          <p className="rs-language-help">Open a regional resume guide in your language.</p>
          <ul>
            <li><a href="/" lang="en" hrefLang="en" aria-current={pathname === "/" ? "page" : undefined}>English homepage</a></li>
            {KEY_LOCALES.map((locale) => (
              <li key={locale.slug}>
                <a href={`/${locale.slug}`} lang={locale.lang} hrefLang={locale.lang} dir="auto" aria-current={active?.slug === locale.slug ? "page" : undefined}>
                  {locale.nativeName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
