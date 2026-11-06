import { NextRequest, NextResponse } from "next/server";
import { searchJobs } from "@/lib/jobs";
import { latestResumeText, scoreJobPageForResume } from "@/lib/job-fit-badges";
import { rateLimit } from "@/lib/rate-limit";
import { currentUser } from "@/lib/auth";
import { TtlCache } from "@/lib/ttl-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The search result itself is user-independent (fit badges are layered on
// after), so identical filter sets share one cached page. 60s staleness is
// invisible to seekers — ingestion refreshes markets on a rolling schedule —
// and the country landing pages all hit the same handful of queries.
type SearchResult = Awaited<ReturnType<typeof searchJobs>>;
const searchCache = new TtlCache<SearchResult>(200, 60_000);

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  // Generous per-IP cap: the UI debounces to ~4 req/s max while typing, so 90
  // per minute never touches a real user but stops scripted scraping of the
  // whole index through this endpoint.
  const limited = await rateLimit(req, "jobs-search", 90);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  const p = req.nextUrl.searchParams;
  const params = {
    query: p.get("q") ?? "",
    country: (p.get("country") ?? "").toUpperCase(),
    jobType: p.get("type") ?? "",
    remote: p.get("remote") === "true",
    sort: (p.get("sort") === "salary" ? "salary" : "posted") as "posted" | "salary",
    page: Number(p.get("page") || 1),
    limit: Number(p.get("limit") || 20),
  };
  try {
    const cacheKey = `${params.country}:${params.jobType}:${params.remote}:${params.sort}:${params.page}:${params.limit}:${params.query.trim().toLocaleLowerCase()}`;
    let result = searchCache.get(cacheKey);
    const cacheHit = result !== undefined;
    if (!result) {
      result = await searchJobs(params);
      searchCache.set(cacheKey, result);
    }

    // Fit badges: score the page against the member's latest resume with the
    // same deterministic engine as the tailor flow. Fail-open — badges are a
    // bonus signal, never a reason to break search. Runs AFTER the cache so
    // a shared page still gets per-member scores.
    let badges: Record<string, unknown> = {};
    let hasResume = false;
    try {
      const resumeText = await latestResumeText(user.id);
      if (resumeText) {
        hasResume = true;
        badges = scoreJobPageForResume(resumeText, result.jobs);
      }
    } catch (badgeError) {
      console.error("[jobs-search badges]", badgeError);
    }

    // The 8k description_text only exists for badge scoring — strip it before
    // it inflates the response body. Rows are COPIED, never mutated: the
    // cached entry must keep description_text for the next member's badges.
    const jobs = result.jobs.map((job) => {
      const { description_text: _drop, ...rest } = job;
      void _drop;
      return rest;
    });

    return NextResponse.json(
      { ...result, jobs, badges, hasResume },
      {
        headers: {
          "Cache-Control": "private, no-store",
          ...(cacheHit ? { "X-RoleSharp-Cache": "LOCAL" } : {}),
        },
      },
    );
  } catch (error) {
    console.error("[jobs-search]", error);
    return NextResponse.json(
      { jobs: [], total: 0, page: 1, limit: 20, error: "jobs_unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
