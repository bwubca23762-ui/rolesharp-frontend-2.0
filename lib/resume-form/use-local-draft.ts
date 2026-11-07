"use client";
import { useEffect, useRef, useState } from "react";

export type DraftStatus = "idle" | "restored" | "saved";

type StoredDraft<T> = T & { version: number; savedAt: string };

type Options<T> = {
  /** localStorage key. One per tool. */
  key: string;
  /** Bump when the draft shape changes; older drafts are discarded, not restored. */
  version: number;
  /** Drafts older than this are removed instead of restored. */
  maxAgeMs: number;
  /** Current form values. Serialized as-is, so keep bytes (photos, files) out. */
  value: T;
  /** Called once on mount with a valid, current draft. */
  onRestore: (draft: T) => void;
};

/**
 * Device-local autosave for the resume tools: restore once on mount, then save
 * on a 500ms debounce.
 *
 * Saving is gated on the restore pass completing, so the empty initial render
 * can never overwrite a stored draft. The debounce timer is cleared on unmount,
 * so navigating away mid-edit does not fire a save into a dead component.
 */
export function useLocalDraft<T>({ key, version, maxAgeMs, value, onRestore }: Options<T>): {
  status: DraftStatus;
  clear: () => void;
} {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [ready, setReady] = useState(false);
  const skipNextSave = useRef(false);
  const lastSaved = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Held in a ref so a caller passing an inline closure does not re-run restore.
  const restore = useRef(onRestore);
  restore.current = onRestore;

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null") as StoredDraft<T> | null;
      const savedAt = parsed?.savedAt ? Date.parse(parsed.savedAt) : Number.NaN;
      const current = parsed?.version === version
        && Number.isFinite(savedAt)
        && Date.now() - savedAt <= maxAgeMs;
      if (parsed && !current) localStorage.removeItem(key);
      if (parsed && current) {
        skipNextSave.current = true;
        restore.current(parsed);
        setStatus("restored");
      }
    } catch {
      // A malformed device-local draft never blocks the tool.
    } finally {
      setReady(true);
    }
  }, [key, version, maxAgeMs]);

  // Serializing once gives both the payload and the change signal, so callers
  // cannot desync a hand-maintained dependency list from the saved shape.
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (!ready) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      lastSaved.current = serialized;
      return;
    }
    if (serialized === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({
          ...(JSON.parse(serialized) as T),
          version,
          savedAt: new Date().toISOString(),
        }));
        lastSaved.current = serialized;
        setStatus("saved");
      } catch {
        setStatus("idle");
      }
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ready, serialized, key, version]);

  return {
    status,
    clear: () => {
      if (timer.current) clearTimeout(timer.current);
      try { localStorage.removeItem(key); } catch {}
      lastSaved.current = null;
      setStatus("idle");
    },
  };
}
