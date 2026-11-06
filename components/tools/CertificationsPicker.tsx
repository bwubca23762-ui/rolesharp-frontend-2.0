"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "@/app/icons";
import { Button } from "@/components/ui/primitives";
import { AVAILABLE_CERTIFICATION_CATEGORIES, FREE_CERTIFICATIONS, type CertificationCategory } from "@/lib/certifications-registry";

const CATEGORY_LABELS: Record<CertificationCategory, string> = {
  tech: "Software & IT", "data-ai": "Data & AI", cloud: "Cloud", cybersecurity: "Cybersecurity", marketing: "Marketing", business: "Business",
};

export default function CertificationsPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CertificationCategory | "all">("all");
  const [selectedId, setSelectedId] = useState("");
  const [completed, setCompleted] = useState(false);
  const [year, setYear] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return FREE_CERTIFICATIONS.filter((item) => (category === "all" || item.category === category)
      && (!query || [item.title, item.provider, ...item.skills].some((text) => text.toLocaleLowerCase().includes(query))));
  }, [search, category]);

  function addSelected() {
    const item = FREE_CERTIFICATIONS.find((candidate) => candidate.id === selectedId);
    if (!item || !completed) return;
    const line = year.trim() ? `${item.resumeTitle} — ${year.trim()}` : item.resumeTitle;
    const existing = value.split(/\r?\n/).map((row) => row.trim().toLocaleLowerCase());
    if (existing.includes(line.toLocaleLowerCase())) {
      setNotice("That credential is already in the list.");
      return;
    }
    onChange([value.trimEnd(), line].filter(Boolean).join("\n"));
    setNotice("Credential added. You can edit the line in the resume field.");
    setOpen(false);
    setSelectedId("");
    setCompleted(false);
    setYear("");
  }

  return <>
    <Button type="button" variant="outline" size="compact" onClick={() => { setNotice(""); setOpen(true); }}>Browse free certifications</Button>
    <dialog ref={dialogRef} onClose={() => setOpen(false)} onCancel={() => setOpen(false)} aria-labelledby="cert-picker-title" className="m-auto max-h-[90dvh] w-[min(94vw,46rem)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-2xl backdrop:bg-slate-950/60 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]">
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-5 dark:border-[var(--color-dark-border)] sm:p-6"><div><h2 id="cert-picker-title" className="text-xl font-bold">Add an earned credential</h2><p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Only add a certificate or badge you have actually earned.</p></div><button type="button" aria-label="Close certification picker" onClick={() => dialogRef.current?.close()} className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:border-[var(--color-dark-border)]"><X size={18} /></button></div>
        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="relative"><span className="sr-only">Search certifications</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search course, provider, or skill" className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-3 text-sm dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]" /></label>
            <label className="sr-only" htmlFor="cert-picker-category">Topic</label><select id="cert-picker-category" value={category} onChange={(event) => setCategory(event.target.value as CertificationCategory | "all")} className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]"><option value="all">All topics</option>{AVAILABLE_CERTIFICATION_CATEGORIES.map((item) => <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>)}</select>
          </div>
          <ul className="mt-4 max-h-60 space-y-2 overflow-y-auto" aria-label="Available free credentials">
            {visible.map((item) => <li key={item.id}><label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-[var(--color-primary)] ${selectedId === item.id ? "border-[var(--color-primary)] bg-[var(--color-primary-50)] dark:bg-[var(--color-dark-surface-2)]" : "border-[var(--color-border)] dark:border-[var(--color-dark-border)]"}`}><input type="radio" name="certification" value={item.id} checked={selectedId === item.id} onChange={() => { setSelectedId(item.id); setCompleted(false); setNotice(""); }} className="mt-1 size-4 accent-[var(--color-primary)]" /><span><span className="block text-sm font-semibold">{item.title}</span><span className="mt-0.5 block text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{item.provider} · {item.credentialType}</span></span></label></li>)}
            {visible.length === 0 ? <li className="p-4 text-sm text-[var(--color-text-muted)]">No matching credentials.</li> : null}
          </ul>
          {selectedId ? <div className="mt-4 space-y-3 rounded-xl bg-[var(--color-surface-2)] p-4 dark:bg-[var(--color-dark-surface-2)]">
            <label className="flex items-start gap-3 text-sm leading-5"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} className="mt-0.5 size-4 accent-[var(--color-primary)]" /><span>I completed this program and earned the credential shown above.</span></label>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Completion year (optional)<input type="text" inputMode="numeric" maxLength={4} value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 2026" className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]" /></label>
          </div> : null}
          {notice ? <p role="status" className="mt-3 text-sm text-[var(--color-primary)]">{notice}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]"><Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>Cancel</Button><Button type="button" disabled={!selectedId || !completed} onClick={addSelected}>Add to resume</Button></div>
      </div>
    </dialog>
  </>;
}
