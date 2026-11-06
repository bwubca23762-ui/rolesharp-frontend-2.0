/**
 * Offer-to-offer comparison (073 lifecycle expansion).
 * Deterministic, zero-LLM: pure arithmetic over the numbers the candidate
 * enters. Free tier compares 2 offers; Premium lifts the count (tier gate
 * lives in the page, not here).
 */

export type OfferInput = {
  id: string;
  label: string;
  /** Annual base salary in the offer's own currency units. */
  base: number;
  currency: string;
  /** Annual bonus as a percent of base (e.g. 10 for 10%). */
  bonusPct: number;
  signingBonus: number;
  /** Total equity grant value, vested over `vestingSchedule`. */
  equityTotal: number;
  /** Percent vested per year, e.g. [25, 25, 25, 25] for 4-year flat. */
  vestingSchedule: number[];
  ptoDays: number;
  workMode: "onsite" | "hybrid" | "remote";
  /** Cost-of-living index relative to 100 = the comparison baseline. */
  colIndex: number;
};

export type OfferComparisonRow = {
  id: string;
  label: string;
  year1Total: number;
  year1ColAdjusted: number;
  fourYearTotal: number;
  fourYearColAdjusted: number;
  effectiveYear1WithPto: number;
  notes: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function normalizeVesting(schedule: number[] | undefined, equityTotal: number): number[] {
  if (!schedule?.length) return [equityTotal]; // cliff at year 1
  const sum = schedule.reduce((a, b) => a + b, 0);
  if (sum <= 0) return schedule.map(() => 0);
  return schedule.map((pct) => round2((pct / sum) * equityTotal));
}

export function compareOffers(offers: OfferInput[]): OfferComparisonRow[] {
  return offers.map((offer) => {
    const notes: string[] = [];
    const bonus = round2(offer.base * (offer.bonusPct / 100));
    const vesting = normalizeVesting(offer.vestingSchedule, offer.equityTotal);
    const year1Equity = vesting[0] ?? 0;
    const year1Total = round2(offer.base + bonus + offer.signingBonus + year1Equity);

    const colFactor = offer.colIndex > 0 ? offer.colIndex / 100 : 1;
    if (offer.colIndex !== 100 && offer.colIndex > 0) {
      notes.push(`COL index ${offer.colIndex}: figures adjusted ÷ ${colFactor}`);
    }
    const year1ColAdjusted = round2(year1Total / colFactor);

    const vestingYears = Math.max(vesting.length, 1);
    const fourYearEquity = vesting.slice(0, 4).reduce((a, b) => a + b, 0);
    const fourYearTotal = round2((offer.base + bonus) * Math.min(4, Math.max(1, vestingYears)) + offer.signingBonus + fourYearEquity);
    const fourYearColAdjusted = round2(fourYearTotal / colFactor);

    if (offer.vestingSchedule.length && offer.vestingSchedule.some((p) => p > 40)) {
      notes.push("Back-loaded vesting: most equity arrives in later years.");
    }
    if (offer.signingBonus > 0) {
      notes.push(`Includes a one-time signing bonus ($${offer.signingBonus.toLocaleString()}) — it does not repeat in year 2.`);
    }
    if (offer.workMode === "remote") notes.push("Remote — no commute/relocation cost captured.");

    // PTO is monetized as an effective-rate note, not added to the total —
    // more PTO is worth real money but is not salary.
    const ptoNote = offer.ptoDays > 0
      ? `${offer.ptoDays} PTO days ≈ ${(offer.base / 260).toFixed(0)}/day of paid rest`
      : undefined;
    if (ptoNote) notes.push(ptoNote);

    return {
      id: offer.id,
      label: offer.label,
      year1Total,
      year1ColAdjusted,
      fourYearTotal,
      fourYearColAdjusted,
      effectiveYear1WithPto: year1Total,
      notes,
    };
  });
}

/** Best offer by a chosen lens. */
export function bestOffer(rows: OfferComparisonRow[], lens: "year1" | "year1Adjusted" | "fourYear" | "fourYearAdjusted"): OfferComparisonRow | null {
  if (!rows.length) return null;
  const key = lens === "year1" ? "year1Total" : lens === "year1Adjusted" ? "year1ColAdjusted" : lens === "fourYear" ? "fourYearTotal" : "fourYearColAdjusted";
  return rows.reduce((best, row) => ((row[key] as number) > (best[key] as number) ? row : best), rows[0]);
}
