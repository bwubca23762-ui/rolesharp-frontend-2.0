import { NextRequest, NextResponse } from "next/server";
import { searchCompanies } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { searchDevCompanies } from "@/lib/local-dev-store";
import { TtlCache } from "@/lib/ttl-cache";
import { connection, redisDeadline } from "@/lib/queue";

export const runtime = "nodejs";

type CompanyResult = Awaited<ReturnType<typeof searchCompanies>>;
const resultCache = new TtlCache<CompanyResult>(200, 30_000);
const SHARED_CACHE_VERSION = "v1";
const SHARED_CACHE_TTL_SECONDS = 10 * 60;

// Autocomplete for "search any company". Falls back to empty list w/o DB.
export async function GET(req: NextRequest) {
  // Unauthenticated + hits a trigram DB query, so throttle generously per IP to
  // stop scrapers/floods from hammering Postgres. 40/min covers fast typing.
  const limited = await rateLimit(req, "company-search", 40);
  if (!limited.ok) return NextResponse.json([], { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const term = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const country = req.nextUrl.searchParams.get("country")?.trim().toUpperCase() || undefined;
  if (term.length < 2) return NextResponse.json([]);
  if (env.localDevMode) return NextResponse.json(await searchDevCompanies(term, country));
  const cacheKey = `${country ?? "*"}:${term.toLocaleLowerCase()}`;
  const cached = resultCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-RoleSharp-Cache": "LOCAL" } });
  }
  const sharedKey = `company-search:${SHARED_CACHE_VERSION}:${cacheKey}`;
  try {
    const shared = await redisDeadline(() => connection.get(sharedKey));
    if (shared) {
      const parsed = JSON.parse(shared) as CompanyResult;
      if (Array.isArray(parsed)) {
        resultCache.set(cacheKey, parsed);
        return NextResponse.json(parsed, { headers: { "X-RoleSharp-Cache": "SHARED" } });
      }
    }
  } catch (error) {
    console.warn("[company-search] shared cache unavailable", error instanceof Error ? error.message : error);
  }
  try {
    const results = await searchCompanies(term, 10, country);
    resultCache.set(cacheKey, results);
    // Fire-and-forget. Populating a shared cache is not something the caller
    // should wait on, and during an outage awaiting it cost a full deadline on
    // top of the one already paid for the read.
    void redisDeadline(() => connection.set(sharedKey, JSON.stringify(results), "EX", SHARED_CACHE_TTL_SECONDS))
      .catch((error) => console.warn("[company-search] shared cache write unavailable", error instanceof Error ? error.message : error));
    return NextResponse.json(results, { headers: { "X-RoleSharp-Cache": "MISS" } });
  } catch {
    return NextResponse.json([]);
  }
}
