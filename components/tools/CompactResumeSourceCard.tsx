"use client";

import { useMemo, useState } from "react";
import { countBullets, type WorkspaceDraft } from "@/lib/workspace-context";

/**
 * CompactResumeSourceCard — the resume input for every studio tool.
 * Three source tabs (Saved / Upload / Paste) collapse into a 48px summary
 * pill once a resume is loaded, so the Target Role + Job Description inputs
 * fit above the fold without scrolling.
 */

export type ResumeSource = "saved" | "upload" | "paste";

export function CompactResumeSourceCard({
  draft,
  onText,
  renderSavedPicker,
  renderUpload,
}: {
  draft: WorkspaceDraft | null;
  /** Called whenever the effective resume text changes. */
  onText: (text: string) => void;
  /** Optional: renders the SavedResumePicker inside the Saved tab. */
  renderSavedPicker?: () => React.ReactNode;
  /** Optional: renders the file upload control inside the Upload tab. */
  renderUpload?: () => React.ReactNode;
}) {
  const [tab, setTab] = useState<ResumeSource>("paste");
  const [editing, setEditing] = useState(false);

  const text = draft?.resumeText ?? "";
  const wordCount = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text]);
  const bullets = useMemo(() => (text ? countBullets(text) : 0), [text]);
  const hasResume = text.trim().length > 80;

  if (hasResume && !editing) {
    return (
      <div className="flex h-12 items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] px-4">
        <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--fg)]" aria-live="polite">
          <span aria-hidden>📄</span>
          <span className="truncate font-medium">{draft?.resumeFileName || `${wordCount} words`}</span>
          <span className="shrink-0 text-xs text-[var(--muted-fg)]">· {bullets} bullets</span>
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)] transition-colors hover:border-[var(--primary)]"
        >
          Edit text
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div role="tablist" aria-label="Resume source" className="mb-3 flex gap-1 rounded-lg bg-[var(--surface-2)] p-1 text-xs font-semibold">
        {(["saved", "upload", "paste"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${
              tab === t ? "bg-[var(--surface)] text-[var(--fg)] shadow-sm" : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
            }`}
          >
            {t === "saved" ? "Saved" : t === "upload" ? "Upload PDF/DOCX" : "Paste text"}
          </button>
        ))}
      </div>

      {tab === "saved" && (
        <div>
          {renderSavedPicker ? (
            renderSavedPicker()
          ) : (
            <p className="text-sm text-[var(--muted-fg)]">Sign in to pick a saved resume.</p>
          )}
        </div>
      )}

      {tab === "upload" && (
        <div>
          {renderUpload ? (
            renderUpload()
          ) : (
            <p className="text-sm text-[var(--muted-fg)]">PDF/DOCX upload is available on the full checker.</p>
          )}
        </div>
      )}

      {tab === "paste" && (
        <div>
          <label htmlFor="compact-resume-text" className="mb-1 block text-xs font-semibold text-[var(--muted-fg)]">
            Paste your resume text
          </label>
          <textarea
            id="compact-resume-text"
            rows={8}
            value={text}
            onChange={(event) => onText(event.target.value)}
            placeholder="Paste the full resume text — the more real evidence, the sharper the analysis."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          {hasResume && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="mt-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--fg)] transition-colors hover:border-[var(--primary)]"
            >
              Done — collapse to summary
            </button>
          )}
        </div>
      )}
    </div>
  );
}
