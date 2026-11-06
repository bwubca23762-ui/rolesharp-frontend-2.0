import { q, withTransaction } from "./db";

// ── Promo code validation + redemption (TOOLS-TRACKER P1) ──
// Validation is read-only and safe to call from the checkout UI. Redemption
// happens server-side at invoice creation inside one transaction with a
// conditional UPDATE on times_redeemed so concurrent checkouts can never
// exceed max_redemptions.

export type PromoValidation = {
  code: string;
  percentageOff: number | null;
  amountOffCents: number | null;
};

export function applyDiscount(priceCents: number, promo: PromoValidation): number {
  // Floor at $1.00: a stacked/deep promo must never mint a $0 invoice —
  // providers reject zero-amount charges and a free paid plan breaks the
  // fixed-term accounting. Admins wanting a free grant have feature grants,
  // not promo codes.
  const MIN_PRICE_CENTS = 100;
  if (promo.amountOffCents != null) return Math.max(MIN_PRICE_CENTS, priceCents - promo.amountOffCents);
  if (promo.percentageOff != null) return Math.max(MIN_PRICE_CENTS, Math.round(priceCents * (1 - promo.percentageOff / 100)));
  return Math.max(MIN_PRICE_CENTS, priceCents);
}

export async function validatePromoCode(
  codeInput: string,
  planId: string,
): Promise<PromoValidation | { error: string }> {
  const code = codeInput.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,24}$/.test(code)) return { error: "invalid_code" };

  const rows = await q<{
    code: string; percentage_off: number | null; amount_off_cents: number | null;
    applies_to: string[]; max_redemptions: number | null; times_redeemed: number;
    expires_at: string | null; deactivated_at: string | null;
  }>(
    `select code, percentage_off, amount_off_cents, applies_to, max_redemptions,
            times_redeemed, expires_at, deactivated_at
     from promo_codes where code = $1`,
    [code],
  );
  const row = rows[0];
  if (!row) return { error: "not_found" };
  if (row.deactivated_at) return { error: "inactive" };
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return { error: "expired" };
  if (row.max_redemptions != null && row.times_redeemed >= row.max_redemptions) return { error: "exhausted" };
  if (row.applies_to.length > 0 && !row.applies_to.includes(planId)) return { error: "plan_mismatch" };

  return {
    code: row.code,
    percentageOff: row.percentage_off,
    amountOffCents: row.amount_off_cents,
  };
}

/**
 * Atomically redeem a code for an order. Returns null if the code was
 * exhausted between validation and this call (lost race) — callers must
 * re-validate. `userId` enforces one-redemption-per-user via unique index.
 */
export async function redeemPromoCode(
  code: string,
  userId: string,
  discountCents: number,
  orderId?: string,
): Promise<boolean> {
  const clean = code.trim().toUpperCase();
  return withTransaction(async (query) => {
    // Conditional increment: only succeeds while redemptions remain.
    const bumped = await query<{ code: string }>(
      `update promo_codes set times_redeemed = times_redeemed + 1
       where code = $1
         and deactivated_at is null
         and (expires_at is null or expires_at > now())
         and (max_redemptions is null or times_redeemed < max_redemptions)
       returning code`,
      [clean],
    );
    if (!bumped[0]) return false;
    try {
      await query(
        `insert into promo_redemptions (code, user_id, order_id, discount_cents)
         values ($1,$2,$3,$4)`,
        [clean, userId, orderId ?? null, discountCents],
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // Unique (code,user_id): user already redeemed this code — abort.
      if (msg.includes("promo_redemptions_code_user_id_key") || msg.includes("duplicate key")) return false;
      throw error;
    }
    return true;
  });
}
