import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSalaryStats } from "@/lib/salary-data";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Query = z.object({
  // 120, not 60: /api/roles publishes slugs like
  // "adult-basic-education-adult-secondary-education-and-english-as-a-second-language"
  // (79 chars). Capping below the site's own slug length made the API reject
  // roles the API itself hands out.
  role: z.string().trim().min(2).max(120),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/),
});

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "salary-lookup", 30);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const parsed = Query.safeParse({
    role: req.nextUrl.searchParams.get("role") ?? "",
    country: req.nextUrl.searchParams.get("country") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ error: "role and country required" }, { status: 400 });

  const stats = await getSalaryStats(parsed.data.role, parsed.data.country.toUpperCase());
  if (!stats) {
    return NextResponse.json(
      { error: "no_data", message: "Not enough salary data for this role and country yet. Try a broader role title." },
      { status: 404 },
    );
  }
  return NextResponse.json(stats, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400" } });
}
