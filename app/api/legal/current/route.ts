import { NextResponse } from "next/server";
import { currentRequiredLegalVersions } from "@/lib/legal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const versions = await currentRequiredLegalVersions();
  if (versions.length !== 2) {
    return NextResponse.json({ error: "legal_versions_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ versions }, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
