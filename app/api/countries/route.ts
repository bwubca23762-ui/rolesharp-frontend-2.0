import { NextResponse } from "next/server";
import { countryList } from "@/lib/country-list";

export const runtime = "nodejs";
// Next's route cache absorbs repeated origin requests even when the outer CDN
// is configured to bypass /api/*.
export const revalidate = 300;

export async function GET() {
  const list = await countryList();
  return NextResponse.json(list, {
    headers: { "Cache-Control": "public, s-maxage=300", "CDN-Cache-Control": "public, s-maxage=300" },
  });
}
