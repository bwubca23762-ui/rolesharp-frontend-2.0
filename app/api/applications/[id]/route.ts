import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { ApplicationPatchSchema } from "@/lib/applications/contracts";
import { ApplicationDomainError, deleteApplication, updateApplication } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const ApplicationIdSchema = z.string().uuid();

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "update-application", 30);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  const id = ApplicationIdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "invalid_application_id" }, { status: 400 });
  const payload = await req.json().catch(() => null);
  if (payload === null) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  const parsed = ApplicationPatchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_application_patch", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    const updated = await updateApplication(user.id, id.data, parsed.data);
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApplicationDomainError) {
      const status = error.code === "resume_not_owned" ? 403 : 400;
      return NextResponse.json({ error: error.code }, { status });
    }
    return NextResponse.json({ error: "application_update_failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "delete-application", 15);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  const id = ApplicationIdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "invalid_application_id" }, { status: 400 });
  const deleted = await deleteApplication(user.id, id.data);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
