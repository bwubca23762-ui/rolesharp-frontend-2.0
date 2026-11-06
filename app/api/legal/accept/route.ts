import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import {
  legalRequestEvidenceDigest,
  pendingLegalAcceptances,
  recordPendingLegalAcceptances,
} from "@/lib/legal";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AcceptInput = z.object({
  versionIds: z.array(z.string().uuid()).min(1).max(4),
  surface: z.enum(["legal_notice", "settings", "api"]),
}).strict();

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pending = await pendingLegalAcceptances(user.id);
  return NextResponse.json({ pending }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limited = await rateLimit(req, `legal-accept:${user.id}`, 15, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "too_many_requests" }, {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }
  const parsed = AcceptInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_legal_acceptance" }, { status: 400 });
  try {
    const requestEvidenceDigest = legalRequestEvidenceDigest({
      headers: req.headers,
      userId: user.id,
      versionIds: parsed.data.versionIds,
      surface: parsed.data.surface,
    });
    const accepted = await withTransaction((query) => recordPendingLegalAcceptances({
      query,
      userId: user.id,
      versionIds: parsed.data.versionIds,
      surface: parsed.data.surface,
      requestEvidenceDigest,
    }));
    return NextResponse.json({ accepted }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "legal_acceptance_failed";
    const status = code.startsWith("legal_") ? 409 : 500;
    if (status === 500) console.error("legal_acceptance_failed", { error: code });
    return NextResponse.json({ error: status === 500 ? "legal_acceptance_failed" : code }, { status });
  }
}
