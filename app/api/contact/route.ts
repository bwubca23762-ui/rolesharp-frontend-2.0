import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { sendMail, emailEnabled } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { escapeHtml } from "@/lib/escape-html";

export const runtime = "nodejs";

const SUPPORT_TO = process.env.SUPPORT_EMAIL || SUPPORT_EMAIL;

export async function POST(req: NextRequest) {
  // Throttle to stop the form being used as a spam relay.
  const limited = await rateLimit(req, "contact", 5);
  if (!limited.ok)
    return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().slice(0, 200);
  const subject = String(body.subject ?? "").trim().slice(0, 160);
  const message = String(body.message ?? "").trim().slice(0, 4000);
  // Honeypot — bots fill hidden fields; humans never see it.
  const trap = String(body.company ?? "").trim();
  if (trap) return NextResponse.json({ ok: true }); // silently accept + drop

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: "Enter a valid email so we can reply." }, { status: 400 });
  if (message.length < 10)
    return NextResponse.json({ error: "Please add a few more details (10+ characters)." }, { status: 400 });

  if (!emailEnabled())
    return NextResponse.json({ error: `Messaging is temporarily unavailable. Email ${SUPPORT_EMAIL} directly.` }, { status: 503 });

  const subjectLine = subject ? `[Contact] ${subject}` : "[Contact] New message from RoleSharp";
  const text = `From: ${name || "(no name)"} <${email}>\nSubject: ${subject || "(none)"}\n\n${message}`;

  try {
    await sendMail({
      to: SUPPORT_TO,
      type: "contact",
      subject: subjectLine,
      text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <p><b>From:</b> ${escapeHtml(name || "(no name)")} &lt;${escapeHtml(email)}&gt;</p>
        <p><b>Subject:</b> ${escapeHtml(subject || "(none)")}</p>
        <hr/>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      </div>`,
      replyTo: email,
    });
  } catch (e) {
    console.error("[contact] send failed", e);
    return NextResponse.json({ error: `Could not send right now. Email ${SUPPORT_EMAIL} directly.` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

