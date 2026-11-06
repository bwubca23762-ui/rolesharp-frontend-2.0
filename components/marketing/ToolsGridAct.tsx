"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Reveal } from "@/components/motion";
import { Button, Container } from "@/components/ui/primitives";
import { Search, Upload, Download, X } from "@/app/icons";
import NextImage from "next/image";
import { TOOLS, type Tool } from "@/lib/tools-registry";


/**
 * Act 1b — the free-tools catalogue. v4 (owner ask: "every tool good visual
 * and link", Apple/GitHub-style landing): the twelve paragraph cards became a
 * bento grid. The flagship ATS checker takes a double tile with a live sample
 * score dial, its full paragraph, and its three-step strip; the other eleven
 * tools are visual tiles — tinted icon, name, one-line hook, tag, and a
 * hover-sliding arrow — each one a full-surface link into its tool. The data
 * array stays the single source of truth for /tools and the JSON-LD.
 */


// Tag colours use theme aliases (--primary/--success/--muted-fg), which
// resolve to the page theme — no per-section canvas any more.
// Category colours: 700-series on light (600-series ink like emerald-600 is
// ~4.0:1 on white — under the 4.5:1 axe floor for 12px text), 400-series on
// dark. Same rule the amber tag fix documented.
const CATEGORY_STYLES: Record<Tool["category"], { iconBg: string; text: string }> = {
  checkers: { iconBg: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300", text: "text-emerald-800 dark:text-emerald-300" },
  builders: { iconBg: "bg-indigo-500/10 text-indigo-800 dark:text-indigo-300", text: "text-indigo-800 dark:text-indigo-300" },
  career: { iconBg: "bg-purple-500/10 text-purple-700 dark:text-purple-400", text: "text-purple-700 dark:text-purple-400" },
  interview: { iconBg: "bg-amber-500/10 text-amber-800 dark:text-amber-300", text: "text-amber-800 dark:text-amber-300" },
};

const TAG_STYLES: Record<Tool["tag"], string> = {
  Check: "text-[var(--success)]",
  Build: "text-[var(--primary)]",
  Research: "text-[var(--primary)]",
  // Amber-solid (#D97706) on the white tile is 3.18:1 — under the 4.5:1 AA
  // floor for this 12px mono tag. Same pair the announcement rails axe fix
  // shipped: dark ink on light, lifted amber on the dark canvas.
  Prep: "text-[var(--color-brand-amber-ink)] dark:text-[var(--color-secondary-hover)]",
};

const FILTER_CATEGORIES = [
  { id: "all", label: "All Tools" },
  { id: "checkers", label: "ATS & Checkers" },
  { id: "builders", label: "AI Writers & Polishers" },
  { id: "career", label: "Career & Salaries" },
  { id: "interview", label: "Interview & Negotiation" },
] as const;

export function ToolsGridAct() {
  const freeToolCount = TOOLS.filter((tool) => !tool.premium).length;
  const [selectedCat, setSelectedCat] = useState<Tool["category"] | "all">("all");
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const isMatching = (tool: Tool) => {
    const matchesCategory = selectedCat === "all" || tool.category === selectedCat;
    const matchesSearch = !q
      || tool.name.toLowerCase().includes(q)
      || tool.description.toLowerCase().includes(q)
      || tool.tag.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  };
  // Counts stay live so the tab labels can never drift from the data.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: TOOLS.length, checkers: 0, builders: 0, career: 0, interview: 0 };
    for (const tool of TOOLS) counts[tool.category] += 1;
    return counts;
  }, []);
  const visibleCount = TOOLS.filter(isMatching).length;
  const [flagship, ...rest] = TOOLS;
  return (
    <section id="tools" className="scroll-mt-20 py-14 md:py-20">
      <Container size="large">
        <Reveal variant="rise">
          <div className="max-w-3xl">
            <p className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-[0.15em] text-[var(--primary)]">Career tools</p>
            <h2 className="mt-3 max-w-[820px] text-[clamp(1.9rem,3.4vw,2.75rem)] font-extrabold! leading-[1.05]! tracking-[-0.035em]! text-[var(--fg)] text-balance">
              Find the right tool for your next step.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted-fg)] md:text-lg md:leading-8">
              Check a resume, build from your experience, or prepare for what comes next. {freeToolCount} tools are free with no account; the Premium cover-letter generator is clearly marked.
            </p>
          </div>
        </Reveal>
        {/* Interactive filter + search. Non-matching tiles stay in the DOM
            as display:none so the E2E href pins and axe's full-DOM scan keep
            seeing every tool. */}
        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tools by category">
            {FILTER_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                aria-pressed={selectedCat === cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                  selectedCat === cat.id
                    ? "bg-[var(--color-primary-solid)] text-white shadow-sm"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-fg)] hover:border-[var(--primary)] hover:text-[var(--fg)] dark:bg-[var(--surface-2)]"
                }`}
              >
                <span className="min-w-0 text-left lg:text-center">{cat.label}</span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none ${selectedCat === cat.id ? "bg-white/15 text-white" : "bg-[var(--surface-2)] text-[var(--muted-fg)]"}`}>{categoryCounts[cat.id]}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-auto">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-fg)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${TOOLS.length} tools...`}
              aria-label="Filter tools by keyword"
              className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-10 pr-10 text-base text-[var(--fg)] placeholder:text-[var(--muted-fg)] focus:border-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:text-sm lg:rounded-full dark:bg-[var(--surface-2)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-[var(--muted-fg)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        {q && (
          <p className="mt-3 text-xs text-[var(--muted-fg)]" role="status">
            Showing {visibleCount} of {TOOLS.length} tools for &ldquo;{search}&rdquo;
          </p>
        )}
        {/* Bento grid: the flagship checker owns a double tile with the sample
            score dial; the other nineteen tools are visual tiles, each one a
            full-surface link. 2×2 + 19 singles = 23 cells. */}
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Reveal variant="rise" className={`sm:col-span-2 lg:col-span-2 lg:row-span-2 ${!isMatching(flagship) ? "hidden" : ""}`}>
            <Link
              href={flagship.href}
              className="rs-tool-tile rs-tool-flagship group h-full"
            >
              <span className="flex items-start justify-between gap-4">
                <span className="flex items-center gap-3.5">
                  <span className="rs-tool-icon grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--primary)_16%,transparent)] text-[var(--primary)]">
                    <flagship.icon size={22} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xl font-bold leading-6 text-[var(--fg)]">{flagship.name}</span>
                    <span className={`mt-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] ${TAG_STYLES[flagship.tag]}`}>
                      {flagship.tag}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-[color-mix(in_oklab,var(--primary)_45%,transparent)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-[0.1em] text-[var(--primary)]">
                  Start here
                </span>
              </span>

              <span className="mt-5 block max-w-xl text-[15px] leading-7 text-[var(--muted-fg)]">
                {flagship.body}
              </span>

              {/* Sample dial + how-it-runs strip: the flagship keeps the depth
                  the other tiles trade for visuals. */}
              <span className="mt-auto flex flex-wrap items-center gap-6 pt-6">
                <span
                  className="rs-tool-dial"
                  role="img"
                  aria-label="Sample ATS score: 82 out of 100"
                >
                  <span className="rs-tool-dial-core">
                    <strong>82</strong>
                    <small>sample</small>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-[family-name:var(--font-mono)] text-xs text-[var(--muted-fg)]">
                  {flagship.steps.map((step, i) => (
                    <span key={step} className="flex items-center gap-2">
                      {i > 0 && <span aria-hidden className="opacity-60">→</span>}
                      <span className="rounded-md border border-[var(--border)] px-2 py-1">{step}</span>
                    </span>
                  ))}
                </span>
                <span aria-hidden className="rs-tool-arrow ml-auto text-lg text-[var(--muted-fg)]">→</span>
              </span>
            </Link>
          </Reveal>

          {rest.map((tool, index) => {
            const styles = CATEGORY_STYLES[tool.category];
            return (
              <Reveal key={tool.href} variant="rise" delay={Math.min((index + 1) * 50, 250)} className={isMatching(tool) ? "" : "hidden"}>
                <Link href={tool.href} className="rs-tool-tile group h-full">
                  <span className="flex items-start justify-between gap-3">
                    <span className={`rs-tool-icon grid h-11 w-11 shrink-0 place-items-center rounded-xl ${styles.iconBg}`}>
                      <tool.icon size={20} />
                    </span>
                    <span className={`pt-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] ${styles.text}`}>
                      {tool.premium ? "Premium" : tool.tag}
                    </span>
                  </span>
                  <span className="mt-4 block text-lg font-bold leading-6 text-[var(--fg)]">{tool.name}</span>
                  <span className="mt-1.5 block text-sm leading-6 text-[var(--muted-fg)]">{tool.description}</span>
                  <span aria-hidden className="rs-tool-arrow mt-auto pt-4 text-lg text-[var(--muted-fg)]">→</span>
                </Link>
              </Reveal>
            );
          })}
        </div>

        {/* Import/export pair closes the act: the two newest capabilities,
            phrased as outcomes rather than features. */}
        <Reveal variant="rise">
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-4 rounded-2xl border border-[var(--border)] p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-[var(--primary)]"><Upload size={20} /></span>
              <span>
                <span className="block text-lg font-bold text-[var(--fg)]">Bring your old resume, leave with a new one</span>
                <span className="mt-1.5 block text-sm leading-6 text-[var(--muted-fg)]">
                  Upload any existing resume — any template, any layout — and Premium pulls every section
                  straight into the builder as labelled fields. Your format becomes ours in seconds.
                </span>
                <Link href="/build" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline underline-offset-4">
                  Import into the builder →
                </Link>
              </span>
            </div>
            <div className="flex items-start gap-4 rounded-2xl border border-[var(--border)] p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-[var(--primary)]"><Download size={20} /></span>
              <span>
                <span className="block text-lg font-bold text-[var(--fg)]">Export clean, share anywhere</span>
                <span className="mt-1.5 block text-sm leading-6 text-[var(--muted-fg)]">
                  Every generator output downloads as a watermark-free PDF on Premium, DOCX included for
                  editable copies — letterhead-ready for portals that accept attachments.
                </span>
                <Link href="/pricing" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline underline-offset-4">
                  See Premium plans →
                </Link>
              </span>
            </div>
          </div>
        </Reveal>

        {/* Template fan — the seven real resume templates, three shown fanned
            like held cards. Real product output (the actual template previews
            rendered by the same engines the builder uses), not stock art. */}
        <Reveal variant="rise">
          <div className="mt-14 grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--muted-fg)]">
                Seven real templates
              </p>
              <h3 className="mt-3 text-[clamp(1.5rem,2.6vw,2.2rem)] font-extrabold! leading-[1.06]! tracking-[-0.02em]! text-[var(--fg)] text-balance">
                Your content, dressed for the industry you are aiming at.
              </h3>
              <p className="mt-4 max-w-lg text-base leading-7 text-[var(--muted-fg)]">
                Every template is rendered by the same engine that exports your PDF — what you
                see here is what recruiters get. Corporate serif for finance, clean monospace-
                friendly layouts for engineering, and every one of them single-column so the ATS
                reads the whole page.
              </p>
              <Button as="a" href="/resume-templates" variant="outline" size="sm" className="mt-5">
                Browse the template gallery →
              </Button>
            </div>
            <div className="rs-template-fan mx-auto w-full max-w-md" aria-label="Three RoleSharp resume templates: Ledger, Momentum, and Clarity">
              <div className="rs-template-fan-card" style={{ transform: "translateX(-50%) rotate(-6deg)" }}>
                <NextImage src="/templates/executive.webp" alt="Ledger template: serif, corporate navy" width={480} height={680} sizes="240px" className="h-auto w-full" />
              </div>
              <div className="rs-template-fan-card" style={{ transform: "translateX(-50%) rotate(0deg) translateY(-6px)" }}>
                <NextImage src="/templates/modern.webp" alt="Momentum template: indigo accents" width={480} height={680} sizes="240px" className="h-auto w-full" />
              </div>
              <div className="rs-template-fan-card" style={{ transform: "translateX(-50%) rotate(6deg)" }}>
                <NextImage src="/templates/basic.webp" alt="Clarity template: clean monochrome" width={480} height={680} sizes="240px" className="h-auto w-full" />
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal variant="rise">
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <Button as="a" href="/resume-fixer" size="lg" variant="primary">
              Start with a free resume check →
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
