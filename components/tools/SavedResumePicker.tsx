"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/app/session-context";
import { Button, Label, Select } from "@/components/ui/primitives";
import { FileText } from "@/app/icons";

// Universal saved-resume selector for logged-in tool users. Queries
// /api/resumes once per mount, renders nothing for anonymous visitors or
// members with no saved resumes, and hands the chosen resume id to the host
// tool's load handler. This is the "pick up where you left off" path —
// an alternative to the file upload, not a replacement for it.
export type SavedResumeSummary = {
  id: string;
  candidate_name?: string | null;
  headline?: string | null;
  ats_score?: number | null;
  company_name?: string | null;
  role_title?: string | null;
  created_at: string;
};

export default function SavedResumePicker({
  onSelect,
  label = "Or pick from your saved resumes",
  className = "",
}: {
  onSelect: (resumeId: string) => void;
  label?: string;
  className?: string;
}) {
  const { session } = useSession();
  const [resumes, setResumes] = useState<SavedResumeSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    if (!session?.loggedIn) return;
    let active = true;
    fetch("/api/resumes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: SavedResumeSummary[]) => {
        if (active && Array.isArray(data)) setResumes(data);
      })
      .catch(() => {
        // A failed listing must not wedge the tool: the picker simply stays
        // hidden and the manual paste/upload paths keep working.
        if (active) setLoadErr("");
      });
    return () => { active = false; };
  }, [session?.loggedIn]);

  if (!session?.loggedIn) return null;
  if (resumes === null) {
    return (
      <div className={`my-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)] ${className}`} aria-busy="true">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Saved resumes</span>
        <div className="mt-1.5 h-8 w-full animate-pulse rounded-md bg-[color-mix(in_oklab,var(--color-text-muted)_12%,transparent)]" />
      </div>
    );
  }
  if (resumes.length === 0) return null;

  return (
    <div className={`my-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)] ${className}`}>
      <Label htmlFor="saved-resume-select" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
        <FileText size={14} aria-hidden="true" /> {label}
      </Label>
      <div className="mt-1.5 flex items-center gap-2">
        <Select
          id="saved-resume-select"
          value={selectedId}
          onChange={(e) => { setSelectedId(e.target.value); setLoadErr(""); }}
          className="flex-1 text-sm"
        >
          <option value="">Select a saved resume...</option>
          {resumes.map((r) => {
            const title = r.role_title || r.headline || r.candidate_name || "Resume";
            const date = new Date(r.created_at).toLocaleDateString();
            return (
              <option key={r.id} value={r.id}>
                {title} (ATS: {r.ats_score ?? "—"}/100) — {date}
              </option>
            );
          })}
        </Select>
        <Button
          size="sm"
          disabled={!selectedId}
          onClick={() => { if (selectedId) onSelect(selectedId); }}
        >
          Load
        </Button>
      </div>
      {loadErr && <p className="mt-1.5 text-xs font-semibold text-[var(--color-danger)]" role="alert">{loadErr}</p>}
    </div>
  );
}
