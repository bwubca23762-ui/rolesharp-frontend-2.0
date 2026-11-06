import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import {
  FEATURE_ACCESS_KEYS,
  listFeatureAccess,
  requestFeatureAccess,
} from "@/lib/feature-access";
import { mutationOriginAllowed, workflowApiError } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestInput = z.object({
  featureKey: z.enum(FEATURE_ACCESS_KEYS),
}).strict();

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  return NextResponse.json({ grants: await listFeatureAccess(user.id) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "feature-access-request", 10);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }
  const parsed = RequestInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_feature_access_request" }, { status: 400 });
  try {
    return NextResponse.json({ grant: await requestFeatureAccess(user.id, parsed.data.featureKey) }, {
      status: 202,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return workflowApiError(error, "feature_access_request_failed");
  }
}
