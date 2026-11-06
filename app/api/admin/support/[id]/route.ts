import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { getTicket, addTicketMessage, setTicketStatus } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminPermission("support.read")) && !(await hasAdminPermission("support.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const ticket = await getTicket(id, { isAdmin: true });
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminPermission("support.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const { id } = await params;
  const ticket = await getTicket(id, { isAdmin: true });
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const action = String(body.action ?? "reply").trim();
  if (!["reply", "resolve", "reopen"].includes(action)) return NextResponse.json({ error: "invalid_action" }, { status: 400 });

  if (action === "resolve") {
    await setTicketStatus(id, "resolved");
    await recordAdminAction("support_resolve", { targetUserId: ticket.user_id_text, targetEmail: ticket.email, details: { ticketId: id } });
    return NextResponse.json({ ok: true, status: "resolved" });
  }

  if (action === "reopen") {
    await setTicketStatus(id, "open");
    await recordAdminAction("support_reopen", { targetUserId: ticket.user_id_text, targetEmail: ticket.email, details: { ticketId: id } });
    return NextResponse.json({ ok: true, status: "open" });
  }

  // default: add a reply
  const message = String(body.message ?? "").trim().slice(0, 4000);
  if (message.length < 8) return NextResponse.json({ error: "Write a reply first." }, { status: 400 });
  await addTicketMessage(id, "admin", message);
  await recordAdminAction("support_reply", { targetUserId: ticket.user_id_text, targetEmail: ticket.email, details: { ticketId: id, messageLength: message.length } });
  return NextResponse.json({ ok: true });
}
