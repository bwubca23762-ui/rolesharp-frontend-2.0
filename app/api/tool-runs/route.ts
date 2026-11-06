import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlements";
import { listToolRuns } from "@/lib/tool-runs-server";

export const runtime = "nodejs";

// The premium account's own tool-run trail (Platform Premium toolHistory).
// Uniform 402 contract, same as every other gated surface.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const features = (await getEntitlement(user)).features;
  if (!features.toolHistory) return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });
  return NextResponse.json(
    { runs: await listToolRuns(user.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
