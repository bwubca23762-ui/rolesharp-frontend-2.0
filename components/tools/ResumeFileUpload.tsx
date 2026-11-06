"use client";

import { useRef, useState } from "react";
import { FileText } from "@/app/icons";

// The file-upload dropzone the /checker page ships, extracted for the other
// long-document tools (CV converter, resume match, version compare). Posts to
// /api/check-resume/upload — the same 80-character minimum and 5 MB cap — and
// hands the extracted text to the parent so the user can edit before running.
type Props = {
  /** Receives the extracted plain text (and the source filename). */
  onText: (text: string, filename: string) => void;
  label?: string;
};

export default function ResumeFileUpload({ onText, label = "Or upload a file" }: Props) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined | null) {
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/check-resume/upload", { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not read this file.");
        return;
      }
      setUploadedName(`${j.filename} — ${j.wordCount} words`);
      onText(String(j.text ?? ""), String(j.filename ?? file.name));
    } catch {
      setErr("Upload failed. Paste the text instead.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label
        className={`upload-box ${busy ? "busy" : ""} ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void upload(e.dataTransfer.files?.[0]); }}
      >
        <input
          ref={inputRef}
          className="file-input-hidden"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={(e) => void upload(e.target.files?.[0])}
          disabled={busy}
        />
        <span className="upload-icon"><FileText size={18} /></span>
        <span>
          <b>{busy ? "Reading file..." : uploadedName || (dragOver ? "Drop your file to upload" : label)}</b>
          <small>{uploadedName ? "Text extracted below — edit before you run the tool." : "PDF, DOCX, or TXT. Max 5 MB. Text is only extracted, never stored."}</small>
        </span>
      </label>
      {err && <p className="mt-2 text-sm font-semibold text-[var(--color-danger)]" role="alert">{err}</p>}
    </div>
  );
}
