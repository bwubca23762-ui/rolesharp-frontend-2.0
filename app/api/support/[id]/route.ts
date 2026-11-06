import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getTicket, addTicketMessage } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const { id } = await params;
  const ticket = await getTicket(id, { userId: user.id });
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const limited = await rateLimit(req, "support-message", 10);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const { id } = await params;
  const ticket = await getTicket(id, { userId: user.id });
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim().slice(0, 4000);
  if (message.length < 3) return NextResponse.json({ error: "Write at least a few words." }, { status: 400 });

  await addTicketMessage(id, "user", message);
  return NextResponse.json({ ok: true });
}
