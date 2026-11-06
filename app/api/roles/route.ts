import { NextRequest, NextResponse } from "next/server";
import { listRoles, searchRoles } from "@/lib/db";
import { env } from "@/lib/env";
import { listDevRoles, searchDevRoles } from "@/lib/local-dev-store";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// ?q= -> search by title (for the autocomplete). No q -> a default sample.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "role-search", 90);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length > 100) return NextResponse.json({ error: "query_too_long" }, { status: 400 });
  if (env.localDevMode) {
    try {
      return NextResponse.json(query.length >= 2 ? await searchDevRoles(query, 20) : await listDevRoles(30));
    } catch (error) {
      console.error("[roles:local-search]", error instanceof Error ? error.name : "unknown_error");
      return NextResponse.json({ error: "search_unavailable" }, { status: 503 });
    }
  }
  try {
    return NextResponse.json(query.length >= 2 ? await searchRoles(query, 20) : await listRoles(30));
  } catch (error) {
    console.error("[roles:search]", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "search_unavailable" }, { status: 503 });
  }
}
