"use client";

import { useCallback, useEffect, useState } from "react";
import { CLIP_PARAM, decodeClip } from "./job-clipper";

/**
 * Shared workspace context (2026-10-21): one storage contract for the
 * resume draft every tool reads and writes, replacing the checker's
 * private `rolesharp-checker-draft` key. Storage key is versioned so a
 * future shape change migrates again instead of corrupting drafts.
 *
 * Migration: on first read, a legacy `rolesharp-checker-draft` payload is
 * copied into the new key and the old key removed — a user who pasted into
 * /checker yesterday opens /resume-fixer with the same resume loaded.
 */

export const WORKSPACE_STORAGE_KEY = "rs_active_workspace_v1";
const WORKSPACE_CHANGE_EVENT = "rolesharp:workspace-change";
const LEGACY_CHECKER_KEY = "rolesharp-checker-draft";

export type WorkspaceDraft = {
  resumeText?: string;
  resumeFileName?: string;
  jdText?: string;
  targetRole?: string;
  targetCompany?: string;
  /** Source surface that last touched the draft (debug/UX label). */
  origin?: string;
  updatedAt?: number;
};

export function readStorage(): WorkspaceDraft | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as WorkspaceDraft;
    // One-time migration from the checker's private draft.
    const legacy = localStorage.getItem(LEGACY_CHECKER_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as WorkspaceDraft | null;
      if (parsed?.resumeText) {
        const migrated: WorkspaceDraft = { ...parsed, origin: "checker-migrated", updatedAt: Date.now() };
        localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_CHECKER_KEY);
        return migrated;
      }
      localStorage.removeItem(LEGACY_CHECKER_KEY);
    }
  } catch {}
  return null;
}

export function writeStorage(draft: WorkspaceDraft | null): void {
  try {
    if (!draft || ![draft.resumeText, draft.jdText, draft.targetRole, draft.targetCompany].some((value) => value?.trim())) {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } else {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ ...draft, updatedAt: Date.now() }));
    }
  } catch {}
  window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGE_EVENT, { detail: draft }));
}

export function useWorkspaceDraft() {
  const [draft, setDraftState] = useState<WorkspaceDraft | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onLocalChange = (event: Event) => setDraftState((event as CustomEvent<WorkspaceDraft | null>).detail);
    const onStorage = (event: StorageEvent) => {
      if (event.key === WORKSPACE_STORAGE_KEY || event.key === null) setDraftState(readStorage());
    };
    window.addEventListener(WORKSPACE_CHANGE_EVENT, onLocalChange);
    window.addEventListener("storage", onStorage);
    setDraftState(readStorage());
    // Job clipper handoff (?clip=<base64url posting>): land the posting in
    // the JD slot of the workspace draft, then strip the param so a refresh
    // or share never re-imports it.
    try {
      const params = new URLSearchParams(window.location.search);
      const clipRaw = params.get(CLIP_PARAM);
      if (clipRaw) {
        const clip = decodeClip(clipRaw);
        const existing = readStorage();
        if (clip) {
          const next: WorkspaceDraft = {
            ...existing,
            jdText: clip.s,
            targetCompany: clip.t || existing?.targetCompany,
            origin: "job-clipper",
            updatedAt: Date.now(),
          };
          writeStorage(next);
          setDraftState(next);
        }
        params.delete(CLIP_PARAM);
        const cleaned = window.location.pathname + (params.toString() ? `?${params.toString()}` : "") + window.location.hash;
        window.history.replaceState(window.history.state, "", cleaned);
      } else {
        setDraftState(readStorage());
      }
    } catch {
      setDraftState(readStorage());
    }
    setLoaded(true);
    return () => {
      window.removeEventListener(WORKSPACE_CHANGE_EVENT, onLocalChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const updateDraft = useCallback((patch: Partial<WorkspaceDraft>, origin?: string) => {
    // Merge against storage so another mounted tool's latest fields survive.
    const current = readStorage();
    const next: WorkspaceDraft = { ...current, ...patch, origin: origin ?? current?.origin, updatedAt: Date.now() };
    writeStorage(next);
    setDraftState(next);
  }, []);

  const clearDraft = useCallback(() => {
    setDraftState(null);
    writeStorage(null);
  }, []);

  /** Loads a demonstrative sample so a first-run visitor sees the studio alive. */
  const loadSampleDraft = useCallback((sample: WorkspaceDraft) => {
    const next: WorkspaceDraft = { ...sample, origin: "sample", updatedAt: Date.now() };
    setDraftState(next);
    writeStorage(next);
  }, []);

  return { draft, loaded, updateDraft, clearDraft, loadSampleDraft };
}

/** Rough bullet count for the source pill: non-empty lines that look like bullets. */
export function countBullets(resumeText: string): number {
  return resumeText
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 12 && !/^[A-Z\s&/]+:$/.test(line))
    .length;
}
