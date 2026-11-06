import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { handleTaken, saveSite, siteForUser } from "@/lib/db/personal-sites";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { cleanCaseStudies, cleanPortfolio, CASE_STUDY_MAX, HANDLE_MESSAGES, handleError, normalizeHandle, PORTFOLIO_MAX } from "@/lib/personal-site";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  handle: z.string().min(1).max(60),
  resumeId: z.string().uuid(),
  displayName: z.string().min(1).max(120),
  showContact: z.boolean(),
  indexable: z.boolean(),
  talentOptIn: z.boolean(),
  published: z.boolean(),
  portfolio: z
    .array(z.object({ title: z.string().max(200), url: z.string().max(500).optional(), description: z.string().max(600).optional() }))
    .max(PORTFOLIO_MAX)
    .default([]),
  caseStudies: z
    .array(z.object({
      title: z.string().max(120),
      problem: z.string().max(600).optional(),
      approach: z.string().max(600).optional(),
      result: z.string().max(600).optional(),
      url: z.string().max(500).optional(),
    }))
    .max(CASE_STUDY_MAX)
    .default([]),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  try {
    const site = await siteForUser(user.id);
    return NextResponse.json({ site }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "personal_site_unavailable" }, { status: 503 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "personal-site", 30);
  if (!limited.ok) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_site", fields: parsed.error.flatten().fieldErrors }, { status: 400 });

  const handle = normalizeHandle(parsed.data.handle);
  const invalid = handleError(handle);
  if (invalid) return NextResponse.json({ error: "invalid_handle", message: HANDLE_MESSAGES[invalid] }, { status: 400 });
  if (await handleTaken(handle, user.id).catch(() => false)) {
    return NextResponse.json({ error: "handle_taken", message: "That handle is already in use." }, { status: 409 });
  }

  // saveSite selects the resume by id AND owner, so a resume the caller does
  // not own matches no row and returns nothing rather than being published
  // under their handle.
  // Cleaned here, not just on render: an unsafe URL should never reach the row
  // in the first place, and the render-side clean is the second line, not the
  // only one.
  const portfolio = cleanPortfolio(parsed.data.portfolio);
  const caseStudies = cleanCaseStudies(parsed.data.caseStudies);
  const site = await saveSite(user.id, { ...parsed.data, handle, portfolio, caseStudies }).catch(() => null);
  if (!site) return NextResponse.json({ error: "resume_not_found" }, { status: 404 });
  return NextResponse.json({ site }, { headers: { "Cache-Control": "private, no-store" } });
}
