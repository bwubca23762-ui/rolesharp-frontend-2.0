"use client";

import { useState } from "react";
import { Button, Card, ToolShell } from "@/components/ui/primitives";
import { FaqSection } from "@/app/seo-blocks";
import { useWorkspaceDraft } from "@/lib/workspace-context";

const FAQS: [string, string][] = [
  ["How long should a LinkedIn headline be?", "LinkedIn allows 220 characters. The best headlines run 60–120 characters — long enough to name your role and one or two skills, short enough to scan in a search result."],
  ["Why does the formula matter?", "Recruiters search LinkedIn by keyword. A headline like 'Passionate ninja' matches nothing. 'Product Manager | SQL — Tableau' matches every search for those skills."],
  ["Should I include my current company?", "No. Your headline is for discoverability, not branding. Company names belong in the experience section."],
];

const SAMPLE_HEADLINES = [
  "Senior Product Manager | B2B SaaS, SQL & Funnel Analytics | Cut Churn 18% in 6 Months",
  "Product Manager — SQL, Power BI & Stakeholder Alignment — Cut Churn 18% in 6 Months",
  "Product Manager | SQL · Power BI · Experimentation | Driving Retention & Revenue Growth",
];

export default function HeadlineGeneratorPage() {
  const { draft } = useWorkspaceDraft();
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [achievement, setAchievement] = useState("");
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [err, setErr] = useState("");

  function fillSample() {
    setRole("Senior Product Manager");
    setSkills("SQL, Power BI, B2B SaaS, Experimentation, Stakeholder Management");
    setAchievement("Cut churn 18% in 6 months across 140K accounts");
    setErr("");
  }

  function fillFromWorkspace() {
    if (!draft) return;
    if (draft.targetRole) setRole(draft.targetRole);
  }

  function resetAll() {
    setRole("");
    setSkills("");
    setAchievement("");
    setHeadlines([]);
    setNotes([]);
    setErr("");
  }

  async function generate() {
    if (busy || role.trim().length < 2) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/tools/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "headlines",
          role: role.trim(),
          skills: skills.trim(),
          achievement: achievement.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      setHeadlines(j.headlines ?? []);
      setNotes(j.notes ?? []);
    } catch {
      setErr("Could not generate headlines. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, index: number) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedIdx(index);
        setTimeout(() => setCopiedIdx(null), 2000);
      })
      .catch(() => {});
  }

  function copyAll() {
    if (!headlines.length) return;
    navigator.clipboard
      ?.writeText(headlines.join("\n"))
      .then(() => {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
      })
      .catch(() => {});
  }

  const displayList = headlines.length > 0 ? headlines : SAMPLE_HEADLINES;
  const isSampleView = headlines.length === 0;

  return (
    <ToolShell
      eyebrow="Free — no account"
      title="LinkedIn headline generator"
      subtitle="Type your role and top skills. Get headline candidates built on the formula recruiters search: Role | Skills | Proof."
      workspaceSize="large"
      onLoadSample={fillSample}
      onReset={resetAll}
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT 6 COLS: INPUTS */}
        <Card className="lg:col-span-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              1. Role, skills &amp; proof
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="compact" onClick={fillSample}>
                ⚡ Fill sample
              </Button>
              {draft?.targetRole && (
                <Button type="button" variant="outline" size="compact" onClick={fillFromWorkspace}>
                  📄 Use target role
                </Button>
              )}
              <Button type="button" variant="ghost" size="compact" onClick={resetAll}>
                🧹 Clear
              </Button>
            </div>
          </div>

          <label className="mb-3.5 block">
            <span className="mb-1 block text-sm font-bold text-[var(--fg)]">Your target or current role *</span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Product Manager"
              maxLength={100}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>
          <label className="mb-3.5 block">
            <span className="mb-1 block text-sm font-bold text-[var(--fg)]">
              Top searchable skills <span className="font-normal text-[var(--muted-fg)]">(comma-separated)</span>
            </span>
            <input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="SQL, Power BI, stakeholder management"
              maxLength={600}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-bold text-[var(--fg)]">
              Best quantified achievement <span className="font-normal text-[var(--muted-fg)]">(optional)</span>
            </span>
            <input
              value={achievement}
              onChange={(e) => setAchievement(e.target.value)}
              placeholder="Cut churn 18% in 6 months"
              maxLength={300}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button onClick={() => void generate()} isLoading={busy} disabled={role.trim().length < 2}>
              ✨ Generate headlines
            </Button>
            <span className="text-xs text-[var(--muted-fg)]">LinkedIn limit: 220 characters</span>
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-[var(--color-danger)]" role="alert">{err}</p>}
        </Card>

        {/* RIGHT 6 COLS: STICKY HEADLINE CANDIDATES */}
        <Card className="lg:col-span-6 lg:sticky lg:top-24">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
            <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              {isSampleView ? "2. Sample headline formulas" : `2. Your headline candidates (${headlines.length})`}
            </span>
            {!isSampleView ? (
              <Button type="button" variant="outline" size="compact" onClick={copyAll}>
                {copiedAll ? "✓ Copied all" : "📋 Copy all"}
              </Button>
            ) : (
              <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--muted-fg)]">
                Sample preview
              </span>
            )}
          </div>

          <div className="grid gap-2.5">
            {displayList.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--fg)]">{h}</p>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted-fg)]">
                    {h.length} / 220 chars
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(h, i)}
                  className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--primary)] transition-colors hover:border-[var(--primary)]"
                >
                  {copiedIdx === i ? "✓ Copied" : "📋 Copy"}
                </button>
              </div>
            ))}
          </div>

          {notes.map((n, i) => (
            <p key={i} className="mt-3 text-xs text-[var(--color-warning)]">
              {n}
            </p>
          ))}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--hairline)] pt-4">
            <p className="text-xs text-[var(--muted-fg)]">
              Paste into LinkedIn → Profile → Edit intro → Headline.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button as="a" href="/linkedin-checker" variant="outline" size="sm">
                🔍 Score Full LinkedIn Profile →
              </Button>
              <Button as="a" href="/build" variant="ghost" size="sm">
                ✨ AI Resume Builder
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <FaqSection visible heading="Common questions" faqs={FAQS} />
      </div>
    </ToolShell>
  );
}
