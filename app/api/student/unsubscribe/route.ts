import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { unsubSignature } from "@/lib/student";

export const runtime = "nodejs";

// GET /api/student/unsubscribe?e=&sig= — opt out of the win-back offer email.
// HMAC-signed link, no login required (it arrives in email).
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("e") || "";
  const sig = req.nextUrl.searchParams.get("sig") || "";
  const supplied = Buffer.from(sig);
  const expected = Buffer.from(unsubSignature(email));
  if (!email || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  }
  await q("update student_claims set winback_opt_out=true where student_email=$1", [email]);
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Unsubscribed</title>
     <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f8fafc;color:#0f172a;display:grid;place-items:center;min-height:100vh;margin:0">
     <div style="text-align:center"><h1 style="font-weight:700;letter-spacing:-0.02em">You're unsubscribed.</h1>
     <p style="color:#64748b">No more offer emails to this address. Account emails (receipts, security) still arrive.</p>
     <p><a href="/" style="color:#2563eb;font-weight:600">← Back to RoleSharp</a></p></div>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
