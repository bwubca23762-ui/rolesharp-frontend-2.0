import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (env.localDevMode) return NextResponse.json({ payments: [] });

  const payments = await q<{
    order_id: string;
    plan: string | null;
    status: string;
    price_amount: string | null;
    pay_currency: string | null;
    created_at: string;
    updated_at: string;
    provider: "crypto" | "razorpay";
  }>(
    `select order_id, plan, status, price_amount, pay_currency, created_at, updated_at, provider
     from (
       select order_id, plan, status, price_amount::text as price_amount, pay_currency, created_at, updated_at, 'crypto'::text as provider
       from crypto_payments where user_id_text = $1
       union all
       select razorpay_order_id as order_id, plan, status, (amount_paise / 100.0)::text as price_amount, currency as pay_currency, created_at, updated_at, 'razorpay'::text as provider
       from razorpay_payments where user_id_text = $1
     ) payments
     order by created_at desc
     limit 20`,
    [user.id],
  );

  return NextResponse.json(
    { payments },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
