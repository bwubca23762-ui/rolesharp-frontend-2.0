import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission, currentAdminPrincipal } from "@/lib/admin-authorization";
import { q, withTransaction } from "@/lib/db";
import { recordAdminAction } from "@/lib/admin-audit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  if (!(await hasAdminPermission("system.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rows = await q(
    `select code, percentage_off, amount_off_cents, applies_to, max_redemptions,
            times_redeemed, expires_at, deactivated_at, created_at
     from promo_codes order by created_at desc limit 50`,
  );
  return NextResponse.json({ codes: rows }, { headers: { "Cache-Control": "private, no-store" } });
}

const CreateBody = z.object({
  action: z.literal("create"),
  code: z.string().trim().regex(/^[A-Z0-9]{4,24}$/).transform((s) => s.toUpperCase()),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().int().min(1),
  // Must match the plan ids validatePromoCode compares applies_to against;
  // a typo here would create a code that silently never applies.
  planId: z.enum(["", "monthly", "yearly"]).optional().default(""),
  maxRedemptions: z.number().int().min(1).optional(),
  // Bare YYYY-MM-DD from the UI's <input type="date"> is normalized to
  // end-of-day UTC so a code does not die at 00:00 on its expiry date.
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?Z?)?$/)
    .transform((s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T23:59:59Z` : s))
    .refine((s) => !Number.isNaN(Date.parse(s)), "invalid_date")
    .optional(),
}).strict();

const DeactivateBody = z.object({
  action: z.literal("deactivate"),
  code: z.string().trim().min(4).max(24),
}).strict();

export async function POST(req: NextRequest) {
  const principal = await currentAdminPrincipal();
  if (!principal || !principal.permissions.has("system.manage")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const limited = await rateLimit(req, "promo-admin", 10);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests", retryAfter: limited.retryAfter }, { status: 429 });

  const parsed = z.discriminatedUnion("action", [CreateBody, DeactivateBody]).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  if (parsed.data.action === "create") {
    const { code, discountType, discountValue, planId, maxRedemptions, expiresAt } = parsed.data;
    const pct = discountType === "percentage" ? Math.min(100, discountValue) : null;
    const amt = discountType === "fixed" ? discountValue : null;
    try {
      await withTransaction(async (query) => {
        await query(
          `insert into promo_codes (code, percentage_off, amount_off_cents, applies_to, max_redemptions, expires_at, created_by)
           values ($1,$2,$3,$4,$5,${expiresAt ? `$6::timestamptz` : "null"},$${expiresAt ? 7 : 6})`,
          [code, pct, amt, planId ? [planId] : [], maxRedemptions ?? null,
            ...(expiresAt ? [expiresAt] : []),
            principal.staffAccountId ?? null],
        );
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("duplicate key") || msg.includes("unique")) {
        return NextResponse.json({ error: "That code already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: "Could not create promo code." }, { status: 500 });
    }
    await recordAdminAction("promo_code_create", {
      details: { code, discountType, discountValue },
    });
    return NextResponse.json({ ok: true, code });
  }

  // deactivate
  const rows = await q(
    `update promo_codes set deactivated_at=now() where code=$1 and deactivated_at is null returning code`,
    [parsed.data.code.toUpperCase()],
  );
  if (!rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await recordAdminAction("promo_code_deactivate", {
    details: { code: parsed.data.code },
  });
  return NextResponse.json({ ok: true });
}
