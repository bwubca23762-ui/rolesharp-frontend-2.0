import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { sameOriginRequest } from "@/lib/request-origin";
import { rateLimit } from "@/lib/rate-limit";
import {
  getAlerts, createAlert, updateAlert, deleteAlert,
} from "@/lib/job-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateBody = z.object({
  roleKeyword: z.string().trim().min(2).max(60),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/),
  frequency: z.enum(["weekly", "daily"]).default("weekly"),
});

const UpdateBody = z.object({
  id: z.string().uuid(),
  roleKeyword: z.string().trim().min(2).max(60).optional(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).optional(),
  frequency: z.enum(["weekly", "daily"]).optional(),
  paused: z.boolean().optional(),
}).strict();

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const alerts = await getAlerts(user.id);
  return NextResponse.json({ alerts, isPremium: user.premium }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  if (!sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host })) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const limited = await rateLimit(req, "job-alerts-create", 10);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "email_verification_required" }, { status: 403 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const result = await createAlert({
    userId: user.id,
    roleKeyword: parsed.data.roleKeyword,
    countryCode: parsed.data.countryCode,
    frequency: parsed.data.frequency,
    isPremium: user.premium,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, alert: result.alert }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host })) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const limited = await rateLimit(req, "job-alerts-update", 20);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const parsed = UpdateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const alert = await updateAlert(parsed.data.id, user.id, parsed.data, user.premium);
  if (!alert) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, alert });
}

export async function DELETE(req: NextRequest) {
  if (!sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host })) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const deleted = await deleteAlert(id, user.id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
