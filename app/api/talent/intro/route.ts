import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { cleanIntroRequest, recordTalentIntroRequest, talentIntroCountForOwner } from "@/lib/talent-marketplace";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";

export const runtime = "nodejs";

const Body = z.object({
  siteId: z.string().uuid(),
  contact: z.string().max(200),
  company: z.string().max(120),
  message: z.string().max(1_000),
});

// Owner-facing count: pending intro requests on their opted-in site.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  try {
    return NextResponse.json({ pending: await talentIntroCountForOwner(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ pending: 0 });
  }
}

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "talent-intro", 5);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cleaned = cleanIntroRequest(parsed.data);
  if (!cleaned) {
    return NextResponse.json({ error: "invalid_intro", message: "Add a real email or LinkedIn, the company, and a sentence or two about the role." }, { status: 400 });
  }
  const recorded = await recordTalentIntroRequest(parsed.data.siteId, cleaned).catch(() => false);
  if (!recorded) return NextResponse.json({ error: "not_listed" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
