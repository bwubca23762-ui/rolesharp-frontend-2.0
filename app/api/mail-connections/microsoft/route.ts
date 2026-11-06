import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentSessionBinding, currentUser } from "@/lib/auth";
import { mutationOriginAllowed, workflowApiError } from "@/lib/jobs-workflow/api";
import { beginMailboxAuthorization, disconnectAndRevokeMailbox } from "@/lib/mail/connection-flow";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const [user, sessionBinding] = await Promise.all([currentUser(), currentSessionBinding()]);
  if (!user || !sessionBinding) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  try {
    return NextResponse.json(await beginMailboxAuthorization({
      userId: user.id, provider: "microsoft", sessionBinding,
    }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return workflowApiError(error, "microsoft_connect_unavailable");
  }
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const parsed = z.object({ connectionId: z.string().uuid() }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_disconnect_request" }, { status: 400 });
  const disconnected = await disconnectAndRevokeMailbox({ userId: user.id, connectionId: parsed.data.connectionId });
  if (!disconnected) return NextResponse.json({ error: "connection_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, localCredentialsErased: true });
}
