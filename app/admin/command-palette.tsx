"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetchJson } from "./admin-helpers";

type PaletteAction = {
  id: string;
  label: string;
  hint: string;
  run: () => Promise<void> | void;
};

/**
 * Global ⌘K / Ctrl+K command palette: jump to any admin route, or run an
 * instant operational action without touching the mouse. Escape closes;
 * arrows navigate; Enter runs.
 */
export function AdminCommandPalette({
  open,
  onClose,
  routes,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  routes: Array<{ label: string; href: string; group: string }>;
  actions: PaletteAction[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      setMessage("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const routeItems = routes
      .filter((route) => !q || route.label.toLowerCase().includes(q) || route.href.toLowerCase().includes(q) || route.group.toLowerCase().includes(q))
      .map((route) => ({
        kind: "route" as const,
        id: route.href,
        label: route.label,
        hint: route.group,
        href: route.href,
      }));
    const actionItems = actions
      .filter((action) => !q || action.label.toLowerCase().includes(q) || action.hint.toLowerCase().includes(q))
      .map((action) => ({ kind: "action" as const, id: action.id, label: action.label, hint: action.hint, action }));
    return [...routeItems, ...actionItems];
  }, [query, routes, actions]);

  useEffect(() => setHighlight(0), [query]);

  async function runItem(item: (typeof items)[number]) {
    if (busyId) return;
    if (item.kind === "route") {
      onClose();
      router.push(item.href);
      return;
    }
    setBusyId(item.id);
    setMessage("");
    try {
      await item.action.run();
      setMessage(`${item.label} — done.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${item.label} failed.`);
    } finally {
      setBusyId("");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="rsx-overlay w-full max-w-xl overflow-hidden rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") { onClose(); return; }
            if (event.key === "ArrowDown") { event.preventDefault(); setHighlight((h) => (h + 1) % Math.max(1, items.length)); return; }
            if (event.key === "ArrowUp") { event.preventDefault(); setHighlight((h) => (h - 1 + items.length) % Math.max(1, items.length)); return; }
            if (event.key === "Enter") {
              event.preventDefault();
              const picked = items[Math.min(highlight, items.length - 1)];
              if (picked) void runItem(picked);
            }
          }}
          placeholder="Jump to a module, or run an action…"
          aria-label="Command palette search"
          className="w-full border-0 border-b border-admin-border bg-transparent px-4 py-3.5 text-sm text-admin-fg placeholder:text-admin-muted-fg focus:outline-none"
        />
        <div className="max-h-[46vh] overflow-auto p-1.5">
          {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-admin-muted-fg">Nothing matches “{query}”.</p>}
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              disabled={!!busyId}
              onClick={() => void runItem(item)}
              onMouseEnter={() => setHighlight(index)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                index === Math.min(highlight, items.length - 1) ? "bg-[var(--color-admin-primary)]/15 text-admin-fg" : "text-admin-muted-fg hover:bg-admin-muted"
              }`}
            >
              <span className="min-w-0 truncate">
                <b className="font-semibold text-admin-fg">{item.label}</b>
                <small className="ml-2 text-xs text-admin-muted-fg">{item.hint}</small>
              </span>
              <kbd className="rsx-mono shrink-0 rounded border border-admin-border px-1.5 py-0.5 text-[10px]">↵</kbd>
            </button>
          ))}
        </div>
        {(message || busyId) && (
          <p className="border-t border-admin-border px-4 py-2.5 text-xs font-semibold text-admin-muted-fg" role="status">
            {busyId ? "Working…" : message}
          </p>
        )}
      </div>
    </div>
  );
}

/** Convenience builders for the instant operational actions. */
export function defaultPaletteActions(): PaletteAction[] {
  return [
    {
      id: "purge-cache",
      label: "Purge CDN cache",
      hint: "Cloudflare — instant",
      run: async () => {
        const result = await adminFetchJson<{ purged?: number }>("/api/admin/cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!result.ok) throw new Error(result.error);
      },
    },
    {
      id: "toggle-maintenance",
      label: "Toggle maintenance mode",
      hint: "Feature flag",
      run: async () => {
        const current = await adminFetchJson<{ flags?: Array<{ name: string; enabled: boolean }> }>("/api/admin/flags");
        const flag = current.data?.flags?.find((f) => f.name === "maintenance_mode");
        const next = !(flag?.enabled ?? false);
        const result = await adminFetchJson("/api/admin/flags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "maintenance_mode", enabled: next }),
        });
        if (!result.ok) throw new Error(result.error);
        window.dispatchEvent(new CustomEvent("rs-admin-toast", { detail: `Maintenance mode ${next ? "ENABLED" : "disabled"}.` }));
      },
    },
  ];
}
