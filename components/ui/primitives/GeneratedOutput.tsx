"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "@/app/icons";

/**
 * The one result surface for generated text (REDESIGN-SPEC §3.3): a
 * mono-readable block with a copy button and an optional export row. It
 * replaces the scattered pre/extra-box/textarea-result variants — every
 * consumer before this shipped its own spacing, its own surface tokens, and
 * most shipped no way to copy the result at all.
 *
 * `label` names the artifact above the block (screen readers get it through
 * the heading; the block itself is region-labelled by it). `actions` is the
 * export row slot — download/print buttons that belong to this result.
 * `copyDisabled` exists for previews that are illustrations, not results.
 */
export default function GeneratedOutput({
  label,
  text,
  actions,
  copyDisabled = false,
  children,
}: {
  label: string;
  text: string;
  actions?: React.ReactNode;
  copyDisabled?: boolean;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    if (copyDisabled || copied) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <section
      aria-label={label}
      className="rounded-[18px] border border-black/[0.08] dark:border-white/[0.12] bg-[var(--surface-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none"
    >
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] px-4 py-2.5">
        <h3 className="m-0 text-[11px] font-bold! uppercase tracking-[0.14em] text-[var(--muted-fg)]">{label}</h3>
        {!copyDisabled && (
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.14] bg-white dark:bg-zinc-800 px-3 py-1 text-xs font-semibold text-[var(--fg)] shadow-[0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-150 hover:border-[#0071E3] hover:text-[#0066CC] active:scale-[0.97]"
            aria-label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
          >
            {copied ? <Check size={13} className="text-[var(--color-success)]" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words px-4 py-3.5 font-[family-name:var(--font-mono)] text-[15px] leading-6 text-[var(--fg)]">{text}</pre>
      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.06] dark:border-white/[0.08] px-4 py-3">
          {actions}
          {children}
        </div>
      )}
    </section>
  );
}
