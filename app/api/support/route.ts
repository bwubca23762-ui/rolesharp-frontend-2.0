import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { hasDb, listUserTickets, createTicket } from "@/lib/db";
import { SUPPORT_EMAIL } from "@/lib/contact";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const tickets = await listUserTickets(user.id);
  return NextResponse.json({ tickets });
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "support", 3);
  if (!limited.ok)
    return NextResponse.json({ error: `Too many messages — slow down. Email ${SUPPORT_EMAIL} if it's urgent.` }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const name = String(body.name ?? "").trim().slice(0, 80) || undefined;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: "A valid email is needed so we can reach you." }, { status: 400 });
  if (subject.length < 3)
    return NextResponse.json({ error: "Give your issue a short subject." }, { status: 400 });
  if (message.length < 10)
    return NextResponse.json({ error: "Tell us a bit more about what happened (10+ characters)." }, { status: 400 });

  // createTicket throws without a pool (withTransaction refuses), so the ticket
  // was never silently dropped — but the user got an unhandled 500. Say what
  // happened and where to go instead. This route's errors are rendered
  // verbatim by app/support/support-form.tsx, so it uses sentences.
  if (!hasDb())
    return NextResponse.json(
      { error: `Support is temporarily unavailable — email ${SUPPORT_EMAIL} and we'll pick it up there.` },
      { status: 503 },
    );

  // Logged-in users are auto-linked to their account.
  const user = await currentUser().catch(() => null);
  await createTicket({ userId: user?.id ?? null, email, name, subject: subject.slice(0, 200), body: message.slice(0, 4000) });
  return NextResponse.json({ ok: true });
}
