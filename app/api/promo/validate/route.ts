import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validatePromoCode } from "@/lib/promo-codes";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Query = z.object({
  code: z.string().trim().min(4).max(24),
  plan: z.string().trim().min(2).max(30),
});

// Read-only promo validation for the checkout UI. The discount is applied
// server-side at invoice creation; this endpoint only confirms eligibility.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "promo-validate", 20);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });

  const parsed = Query.safeParse({
    code: req.nextUrl.searchParams.get("code") ?? "",
    plan: req.nextUrl.searchParams.get("plan") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ valid: false, error: "invalid_input" }, { status: 400 });

  const result = await validatePromoCode(parsed.data.code, parsed.data.plan);
  if ("error" in result) return NextResponse.json({ valid: false, reason: result.error }, { status: 200 });
  return NextResponse.json({ valid: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
}
