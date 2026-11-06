"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Copy, GraduationCap, Search, X } from "@/app/icons";
import { Button } from "@/components/ui/primitives";
import {
  AVAILABLE_CERTIFICATION_CATEGORIES,
  CERTIFICATION_PROVIDERS,
  FREE_CERTIFICATIONS,
  type CertificationCategory,
  type FreeCertification,
} from "@/lib/certifications-registry";

const CATEGORY_LABELS: Record<CertificationCategory, string> = {
  tech: "Software & IT", "data-ai": "Data & AI", cloud: "Cloud", cybersecurity: "Cybersecurity", marketing: "Marketing", business: "Business",
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

export default function CertificationsCatalog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CertificationCategory | "all">("all");
  const [provider, setProvider] = useState("all");
  const [duration, setDuration] = useState("all");
  const [selected, setSelected] = useState<FreeCertification | null>(null);
  const [copied, setCopied] = useState<"title" | "template" | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selected && !dialog.open) dialog.showModal();
    if (!selected && dialog.open) dialog.close();
  }, [selected]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return FREE_CERTIFICATIONS.filter((item) => {
      const matchesText = !query || [item.title, item.provider, item.description, ...item.skills, ...item.targetRoles]
        .some((value) => value.toLocaleLowerCase().includes(query));
      const matchesCategory = category === "all" || item.category === category;
      const matchesProvider = provider === "all" || item.provider === provider;
      const matchesDuration = duration === "all" || (item.durationHours !== null && item.durationHours <= Number(duration));
      return matchesText && matchesCategory && matchesProvider && matchesDuration;
    });
  }, [search, category, provider, duration]);

  async function copyResumeTitle() {
    if (!selected) return;
    try {
      await copyText(selected.resumeTitle);
      setCopied("title");
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  async function copyEvidenceTemplate() {
    if (!selected) return;
    const template = `After earning ${selected.resumeTitle}, applied [skill] in [project or assessment you completed].`;
    try {
      await copyText(template);
      setCopied("template");
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <>
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(150px,auto))]">
          <label className="relative block">
            <span className="sr-only">Search courses, skills, or roles</span>
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search courses, skills, roles" className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-3 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]" />
          </label>
          <label className="text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Category
            <select value={category} onChange={(event) => setCategory(event.target.value as CertificationCategory | "all")} className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]">
              <option value="all">All topics</option>{AVAILABLE_CERTIFICATION_CATEGORIES.map((item) => <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Provider
            <select value={provider} onChange={(event) => setProvider(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]">
              <option value="all">All providers</option>{CERTIFICATION_PROVIDERS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Estimated time
            <select value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]">
              <option value="all">Any duration</option><option value="4">4 hours or less</option><option value="8">8 hours or less</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]" role="status" aria-live="polite">Showing {visible.length} of {FREE_CERTIFICATIONS.length} verified programs</p>
      </div>

      {visible.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <article key={item.id} className="flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-50)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] dark:bg-[var(--color-dark-surface-2)]"><GraduationCap size={15} />{item.provider}</span>
                <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{item.level}</span>
              </div>
              <h2 className="mt-4 text-lg font-bold leading-snug text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{item.title}</h2>
              <p className="mt-1 text-xs font-medium text-[var(--color-primary)]">Free {item.credentialType} · {item.durationHours === null ? "Duration varies" : `~${item.durationHours} hours`}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{item.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">{item.skills.map((skill) => <span key={skill} className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-muted)] dark:border-[var(--color-dark-border)] dark:text-[var(--color-dark-text-muted)]">{skill}</span>)}</div>
              <p className="mt-4 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{item.requirements}</p>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Provider details checked {new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${item.verifiedAt}T12:00:00Z`))}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary-solid)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2">Start free course <span aria-hidden="true">↗</span></a>
                <Link href="/build" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2">Add to resume</Link>
                <Button type="button" variant="outline" size="compact" onClick={() => { setCopied(null); setSelected(item); }}>Resume format</Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]">
          <p className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">No programs match those filters.</p>
          <button type="button" className="mt-3 min-h-11 rounded-lg px-4 text-sm font-semibold text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" onClick={() => { setSearch(""); setCategory("all"); setProvider("all"); setDuration("all"); }}>Clear filters</button>
        </div>
      )}

      <dialog ref={dialogRef} onClose={() => setSelected(null)} onCancel={() => setSelected(null)} aria-labelledby="resume-format-title" className="m-auto max-h-[90dvh] w-[min(92vw,38rem)] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-2xl backdrop:bg-slate-950/60 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]">
        {selected ? <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">Resume formatting</p><h2 id="resume-format-title" className="mt-2 text-xl font-bold">{selected.title}</h2></div><button type="button" aria-label="Close resume formatting" onClick={() => dialogRef.current?.close()} className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:border-[var(--color-dark-border)]"><X size={18} /></button></div>
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Use this credential title only after you have earned it. Add your own completion year and link if you have them.</p>
          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Credential title</p><p className="mt-2 text-sm font-semibold">{selected.resumeTitle}</p></div>
          <div className="mt-3 rounded-xl bg-[var(--color-primary-50)] p-4 dark:bg-[var(--color-dark-surface-2)]"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">Evidence prompt</p><p className="mt-2 text-sm leading-6">{selected.evidencePrompt}</p><p className="mt-2 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">This is a prompt, not a claim. Write only about work you actually did.</p></div>
          <div className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Editable evidence template</p><p className="mt-2 text-sm leading-6">After earning <strong>{selected.resumeTitle}</strong>, applied <em>[skill]</em> in <em>[project or assessment you completed]</em>.</p><p className="mt-2 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Replace every bracket with accurate details. Remove this line if you do not have relevant project or assessment evidence.</p></div>
          <div className="mt-5 flex flex-wrap gap-3"><Button type="button" onClick={() => void copyResumeTitle()}><Copy size={16} />{copied === "title" ? "Title copied" : "Copy credential title"}</Button><Button type="button" variant="outline" onClick={() => void copyEvidenceTemplate()}><Copy size={16} />{copied === "template" ? "Template copied" : "Copy evidence template"}</Button><Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>Close</Button><Link href="/resume-maker" className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">Open Resume Builder</Link></div>
        </div> : null}
      </dialog>
    </>
  );
}
