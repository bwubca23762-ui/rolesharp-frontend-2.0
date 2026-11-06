import { NextRequest, NextResponse } from "next/server";
import { flagEmoji } from "@/lib/country-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache — per-visitor IP geo

// Accurate IP-based country from Cloudflare's edge (CF-IPCountry header).
// Far more reliable than browser Intl locale, and needs no permission prompt.
// Falls back to Vercel/other geo headers, then null.

export async function GET(req: NextRequest) {
  const h = req.headers;
  let code =
    h.get("cf-ipcountry") ||
    h.get("x-vercel-ip-country") ||
    h.get("x-country-code") ||
    "";
  code = code.trim().toUpperCase();
  // CF uses "XX" for unknown and "T1" for Tor — treat as no signal.
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") {
    return NextResponse.json({ detected: false }, { headers: { "cache-control": "no-store" } });
  }
  let name = code;
  try {
    name = new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {}
  return NextResponse.json(
    { detected: true, code, name, flag: flagEmoji(code) },
    { headers: { "cache-control": "no-store" } },
  );
}
