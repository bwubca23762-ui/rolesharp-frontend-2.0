// The one place the plan allowances are written down.
//
// lib/env.ts reads these as its defaults, so server code gets the live value
// (env vars still win). Client components import these directly, because
// lib/env.ts parses process.env at module scope and must not reach the browser
// bundle -- no client component imports it today and none should start.
//
// ponytail: a deployment that overrides FREE_MONTHLY_LIMIT in .env makes
// server-rendered copy disagree with client-rendered copy. Acceptable while the
// env vars are an emergency lever rather than a routine setting. If they start
// being set per-deployment, pass the resolved values down as props instead.
export const DEFAULT_FREE_MONTHLY_LIMIT = 1;
export const DEFAULT_PREMIUM_MONTHLY_LIMIT = 5;
export const DEFAULT_STUDENT_MONTHLY_LIMIT = 2;

/** Credits earned per referral, and the rolling-30-day ceiling on them. */
export const DEFAULT_REFERRAL_CREDIT_REWARD = 1;
export const DEFAULT_REFERRAL_MONTHLY_CAP = 3;

/** Premium pass lengths, in days. */
export const DEFAULT_DAYS_MONTHLY = 30;
export const DEFAULT_DAYS_YEARLY = 365;

/**
 * "1 tailored resume" / "5 tailored resumes". The free plan is 1 by default,
 * so every surface that interpolated the count read "1 tailored resumes" until
 * this existed. Written once rather than as a ternary at each call site.
 */
export function tailoredResumes(count: number): string {
  return `${count} tailored ${count === 1 ? "resume" : "resumes"}`;
}

/**
 * Render a price the way a customer should read it: no cents on a round
 * amount, always two digits when there are cents. The student win-back plans
 * are 80% of the list price, so they land on values like 960 and 6320 that
 * `toLocaleString` would otherwise show as "9.6".
 */
export function formatPlanPrice(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}
