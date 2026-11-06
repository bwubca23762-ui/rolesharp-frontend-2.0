import { NextResponse } from "next/server";
import { countryList } from "@/lib/country-list";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  const list = await countryList(true);
  return NextResponse.json(list, {
    headers: { "Cache-Control": "public, s-maxage=300", "CDN-Cache-Control": "public, s-maxage=300" },
  });
}
