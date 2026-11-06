import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { marketDemandSignal } from "@/lib/market-alarm";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  try {
    const signal = await marketDemandSignal(user.id);
    return NextResponse.json({ signal });
  } catch {
    return NextResponse.json({ signal: null });
  }
}
