"use client";

import { useState } from "react";
import { Badge, Button, Card } from "@/components/ui/primitives";

const COMPETITOR_SUBS = [
  { id: "jobscan", name: "Jobscan", monthly: 49.95, tag: "ATS Keyword Scanner" },
  { id: "teal", name: "Teal+", monthly: 29.0, tag: "Resume & Tracker" },
  { id: "rezi", name: "Rezi Pro", monthly: 29.0, tag: "AI Resume Writer" },
  { id: "kickresume", name: "Kickresume", monthly: 19.0, tag: "Templates & Cover Letters" },
  { id: "finalround", name: "Final Round AI", monthly: 148.0, tag: "Interview Copilot" },
] as const;

export function SubscriptionSavingsCalculator() {
  const [selected, setSelected] = useState<string[]>(["jobscan", "teal"]);

  function toggle(id: string) {
    setSelected((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));
  }

  const monthlySpend = COMPETITOR_SUBS.filter((c) => selected.includes(c.id)).reduce((sum, c) => sum + c.monthly, 0);
  const threeMonthSpend = Math.round(monthlySpend * 3);
  const rolesharpPass = 12;
  const saved = Math.max(0, threeMonthSpend - rolesharpPass);

  return (
    <Card variant="elevated" padding="lg" className="mb-8">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <Badge variant="primary">Interactive Savings Calculator</Badge>
          <h2 className="mt-2 text-xl md:text-2xl font-extrabold! tracking-tight text-[var(--fg)]">
            How much are recurring job-search subscriptions costing you?
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-fg)]">
            Select the tools you’re comparing for a typical 3-month job search. RoleSharp replaces recurring subscriptions with a single one-time pass that never auto-renews.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {COMPETITOR_SUBS.map((sub) => {
              const active = selected.includes(sub.id);
              return (
                <button
                  key={sub.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(sub.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.97] ${
                    active
                      ? "border-[#0071E3] bg-[#0071E3]/10 text-[#0066CC] dark:text-[#5AC8FA] shadow-2xs"
                      : "border-black/[0.1] dark:border-white/[0.14] bg-[var(--surface-2)] text-[var(--muted-fg)] hover:text-[var(--fg)]"
                  }`}
                >
                  <span>{active ? "✓" : "+"}</span>
                  <span>{sub.name}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] opacity-80">${sub.monthly}/mo</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[18px] border border-black/[0.08] dark:border-white/[0.12] bg-[var(--surface-2)] p-5 text-center lg:col-span-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-fg)]">
            3-Month Search Cost Comparison
          </p>
          <div className="mt-3 flex items-baseline justify-center gap-4">
            <div>
              <div className="text-xs text-[var(--muted-fg)]">Competitors (3 mos)</div>
              <div className="text-xl font-bold text-[var(--muted-fg)] line-through">${threeMonthSpend}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#0066CC] dark:text-[#5AC8FA]">RoleSharp Pass</div>
              <div className="text-3xl font-extrabold! text-[var(--fg)]">${rolesharpPass}</div>
            </div>
          </div>
          <p className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            You save ~${saved} — zero recurring billing
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button as="a" href="/checker" size="sm">
              📊 Try Free ATS Checker →
            </Button>
            <Button as="a" href="/pricing" variant="outline" size="sm">
              See Plans
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
