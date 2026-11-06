import { hasDb, q } from "./db";

// The landing banner must never advertise a promo code that does not exist,
// so it reads the live promo_codes table instead of hardcoding one. Admin
// creates a code in Admin → Settings → Promo codes, and the banner picks it
// up automatically; deactivate the code and the banner drops back to the
// referral message. Fails closed: any error renders no promo at all.

export type FeaturedPromo = {
  code: string;
  percentageOff: number | null;
  amountOffCents: number | null;
};

const TTL_MS = 10 * 60 * 1000;
let cache: { ts: number; promo: FeaturedPromo | null } | null = null;

export async function featuredPromo(): Promise<FeaturedPromo | null> {
  if (!hasDb()) return null;
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.promo;

  let promo: FeaturedPromo | null = null;
  try {
    // One featured code at a time: the biggest live percentage discount wins,
    // then fixed-amount codes. Bounded to a handful so the banner query is
    // trivially cheap; the 10-minute cache keeps it off the hot path.
    const rows = await q<{ code: string; percentage_off: number | null; amount_off_cents: number | null }>(
      `select code, percentage_off, amount_off_cents
       from promo_codes
       where deactivated_at is null
         and (expires_at is null or expires_at > now())
         and (max_redemptions is null or times_redeemed < max_redemptions)
       order by percentage_off desc nulls last, amount_off_cents desc nulls last
       limit 5`,
    );
    const row = rows[0];
    if (row) {
      promo = { code: row.code, percentageOff: row.percentage_off, amountOffCents: row.amount_off_cents };
    }
  } catch {
    promo = null;
  }
  cache = { ts: Date.now(), promo };
  return promo;
}
