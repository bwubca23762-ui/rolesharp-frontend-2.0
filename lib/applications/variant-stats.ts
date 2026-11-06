// Variant outcome summaries (Phase 4 A/B analytics). Pure functions — the
// SQL layer returns raw counts per label; everything user-facing
// (response rate, small-sample honesty, "leading so far") is derived here
// so it stays testable. Tracker stages record the candidate's own
// workflow, not verified employer outcomes, so the copy never claims
// statistical significance and small samples are flagged as noise.

export const MIN_RELIABLE_SAMPLE = 5;

export type VariantOutcomeRow = {
  label: string;
  total: number;
  sent: number;
  interviews: number;
  offers: number;
  rejections: number;
  lastUsed: string | null;
};

export type VariantSummary = VariantOutcomeRow & {
  /** Interviews + offers + rejections over sent; null when nothing was sent. */
  responseRate: number | null;
  /** Below MIN_RELIABLE_SAMPLE sent — patterns at this size are noise. */
  sampleTooSmall: boolean;
  /** Highest response rate among sufficiently-sampled variants (one at most). */
  leading: boolean;
};

export function responseRate(
  sent: number,
  interviews: number,
  offers: number,
  rejections: number,
): number | null {
  if (sent <= 0) return null;
  const responses = interviews + offers + rejections;
  return Math.round((responses / sent) * 100);
}

export function summarizeVariants(rows: VariantOutcomeRow[]): VariantSummary[] {
  const withRates = rows.map((row) => ({
    ...row,
    responseRate: responseRate(row.sent, row.interviews, row.offers, row.rejections),
    sampleTooSmall: row.sent < MIN_RELIABLE_SAMPLE,
    leading: false,
  }));
  const eligible = withRates.filter((row) => !row.sampleTooSmall && row.responseRate !== null);
  if (eligible.length >= 2) {
    const best = eligible.reduce((a, b) => (b.responseRate! > a.responseRate! ? b : a));
    // A tie is not a lead: only mark the leader when it is strictly ahead.
    const strictlyAhead = eligible.filter((row) => row.responseRate === best.responseRate);
    if (strictlyAhead.length === 1) best.leading = true;
  }
  return withRates;
}
