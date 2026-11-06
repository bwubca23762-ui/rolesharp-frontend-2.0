import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { ApplicationCreateSchema, ApplicationListQuerySchema } from "@/lib/applications/contracts";
import { ApplicationDomainError, createApplication, listApplications } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function domainError(error: unknown): NextResponse | null {
  if (!(error instanceof ApplicationDomainError)) return null;
  const status = error.code === "duplicate_application" ? 409
    : error.code === "resume_not_owned" || error.code === "job_identity_mismatch" ? 403
      : error.code === "job_not_found" ? 404
        : 400;
  return NextResponse.json({ error: error.code }, { status });
}

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const parsed = ApplicationListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_pagination", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    return NextResponse.json(await listApplications(user.id, parsed.data));
  } catch (error) {
    return domainError(error) ?? NextResponse.json({ error: "applications_unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "create-application", 15);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }
  const payload = await req.json().catch(() => null);
  if (payload === null) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  const parsed = ApplicationCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_application", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    const id = await createApplication(user.id, parsed.data);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return domainError(error) ?? NextResponse.json({ error: "application_create_failed" }, { status: 500 });
  }
}
