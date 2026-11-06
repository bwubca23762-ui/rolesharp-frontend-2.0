import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { variantOutcomes } from "@/lib/db";
import { summarizeVariants } from "@/lib/applications/variant-stats";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  try {
    const rows = await variantOutcomes(user.id);
    return NextResponse.json({ variants: summarizeVariants(rows) });
  } catch {
    return NextResponse.json({ error: "variant_stats_unavailable" }, { status: 503 });
  }
}
