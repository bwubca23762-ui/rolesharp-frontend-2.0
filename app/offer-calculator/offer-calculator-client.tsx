"use client";

import { useMemo, useState } from "react";
import { Button, Label } from "@/components/ui/primitives";
import { bestOffer, compareOffers, type OfferInput } from "@/lib/offer-calculator";

const EMPTY = (): OfferInput => ({
  id: Math.random().toString(36).slice(2, 8),
  label: "Offer A",
  base: 0,
  currency: "USD",
  bonusPct: 0,
  signingBonus: 0,
  equityTotal: 0,
  vestingSchedule: [25, 25, 25, 25],
  ptoDays: 0,
  workMode: "onsite",
  colIndex: 100,
});

const money = (n: number, currency: string) => `${currency} ${Math.round(n).toLocaleString()}`;

export default function OfferCalculatorClient() {
  const [offers, setOffers] = useState<OfferInput[]>([EMPTY(), EMPTY()]);
  const [ran, setRan] = useState(false);

  const rows = useMemo(() => (ran ? compareOffers(offers) : []), [offers, ran]);
  const best = useMemo(() => (ran ? bestOffer(rows, "fourYearAdjusted") : null), [rows, ran]);

  function update(id: string, patch: Partial<OfferInput>) {
    setOffers((current) => current.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  const canRun = offers.every((o) => o.base > 0);

  return (
    <div className="flex flex-col gap-5">
      {offers.map((offer, index) => (
        <div key={offer.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <input
              value={offer.label}
              onChange={(e) => update(offer.id, { label: e.target.value })}
              aria-label={`Offer ${index + 1} label`}
              className="border-none bg-transparent text-sm font-bold text-[var(--fg)] outline-none"
            />
            {offers.length > 2 && (
              <Button variant="outline" size="compact" onClick={() => setOffers((c) => c.filter((o) => o.id !== offer.id))}>
                Remove
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor={`base-${offer.id}`}>Annual base</Label>
              <input id={`base-${offer.id}`} type="number" min={0} value={offer.base || ""} onChange={(e) => update(offer.id, { base: Number(e.target.value) })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--fg)]" />
            </div>
            <div>
              <Label htmlFor={`bonus-${offer.id}`}>Bonus (% of base)</Label>
              <input id={`bonus-${offer.id}`} type="number" min={0} max={100} value={offer.bonusPct || ""} onChange={(e) => update(offer.id, { bonusPct: Number(e.target.value) })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--fg)]" />
            </div>
            <div>
              <Label htmlFor={`signing-${offer.id}`}>Signing bonus</Label>
              <input id={`signing-${offer.id}`} type="number" min={0} value={offer.signingBonus || ""} onChange={(e) => update(offer.id, { signingBonus: Number(e.target.value) })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--fg)]" />
            </div>
            <div>
              <Label htmlFor={`equity-${offer.id}`}>Total equity grant</Label>
              <input id={`equity-${offer.id}`} type="number" min={0} value={offer.equityTotal || ""} onChange={(e) => update(offer.id, { equityTotal: Number(e.target.value) })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--fg)]" />
            </div>
            <div>
              <Label htmlFor={`vest-${offer.id}`}>Vesting % per year (comma-sep)</Label>
              <input id={`vest-${offer.id}`} value={offer.vestingSchedule.join(",")} onChange={(e) => update(offer.id, { vestingSchedule: e.target.value.split(",").map((v) => Number(v.trim()) || 0) })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--fg)]" />
            </div>
            <div>
              <Label htmlFor={`col-${offer.id}`}>Cost-of-living index (100 = baseline)</Label>
              <input id={`col-${offer.id}`} type="number" min={1} value={offer.colIndex} onChange={(e) => update(offer.id, { colIndex: Number(e.target.value) })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--fg)]" />
            </div>
            <div>
              <Label htmlFor={`pto-${offer.id}`}>PTO days</Label>
              <input id={`pto-${offer.id}`} type="number" min={0} value={offer.ptoDays || ""} onChange={(e) => update(offer.id, { ptoDays: Number(e.target.value) })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--fg)]" />
            </div>
            <div>
              <Label htmlFor={`mode-${offer.id}`}>Work mode</Label>
              <select id={`mode-${offer.id}`} value={offer.workMode} onChange={(e) => update(offer.id, { workMode: e.target.value as OfferInput["workMode"] })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--fg)]">
                <option value="onsite">Onsite</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setRan(true)} disabled={!canRun}>Compare offers</Button>
        {offers.length < 4 && (
          <Button variant="outline" onClick={() => setOffers((c) => [...c, { ...EMPTY(), id: Math.random().toString(36).slice(2, 8), label: `Offer ${String.fromCharCode(65 + c.length)}` }])}>
            Add offer
          </Button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4" role="status" aria-live="polite">
          <h2 className="text-base font-bold text-[var(--fg)]">Comparison</h2>
          {best && (
            <p className="mt-1 text-sm text-[var(--muted-fg)]">
              Best 4-year COL-adjusted value: <strong className="text-[var(--fg)]">{best.label}</strong>
            </p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)] text-left text-xs uppercase tracking-wide text-[var(--muted-fg)]">
                  <th className="py-2 pr-4">Offer</th>
                  <th className="py-2 pr-4">Year 1 total</th>
                  <th className="py-2 pr-4">Year 1 COL-adj</th>
                  <th className="py-2 pr-4">4-year total</th>
                  <th className="py-2">4-year COL-adj</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--hairline)]">
                    <td className="py-2 pr-4 font-semibold text-[var(--fg)]">{row.label}</td>
                    <td className="py-2 pr-4 text-[var(--fg)]">{money(row.year1Total, offers.find((o) => o.id === row.id)?.currency ?? "USD")}</td>
                    <td className="py-2 pr-4 text-[var(--fg)]">{money(row.year1ColAdjusted, offers.find((o) => o.id === row.id)?.currency ?? "USD")}</td>
                    <td className="py-2 pr-4 text-[var(--fg)]">{money(row.fourYearTotal, offers.find((o) => o.id === row.id)?.currency ?? "USD")}</td>
                    <td className="py-2 text-[var(--fg)]">{money(row.fourYearColAdjusted, offers.find((o) => o.id === row.id)?.currency ?? "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs leading-5 text-[var(--muted-fg)]">
            {rows.flatMap((row) => row.notes.map((note, i) => (
              <li key={`${row.id}-${i}`}>· {row.label}: {note}</li>
            )))}
          </ul>
          <p className="mt-3 text-xs text-[var(--muted-fg)]">
            Arithmetic on the numbers you entered — no market estimates, no invented equity values. Negotiate with the offer letter, not this table.
          </p>
        </div>
      )}
    </div>
  );
}
