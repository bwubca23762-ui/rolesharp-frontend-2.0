import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Unsubscribe from a job alert via the signed token in the email footer.
// No auth required — the token IS the auth (unique per alert, UUID-based).
//
// GET is deliberate: mail clients (Gmail's unsubscribe chip, Apple Mail)
// follow it, and RFC 8058 one-click POST only applies to the
// List-Unsubscribe-Post header flow the sender also emits. The redirect base
// is env.siteUrl, never the Host header — a forged Host must not steer the
// user off-domain after an unsubscribe.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "job-alerts-unsubscribe", 20);
  if (!limited.ok) {
    return NextResponse.redirect(new URL("/job-alerts?msg=invalid_token", env.siteUrl));
  }
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token.length < 10) {
    return NextResponse.redirect(new URL("/job-alerts?msg=invalid_token", env.siteUrl));
  }
  const rows = await q<{ id: string }>(
    "update job_alerts set paused = true where unsubscribe_token = $1 returning id",
    [token],
  );
  const found = rows.length > 0;
  return NextResponse.redirect(
    new URL(`/job-alerts?msg=${found ? "unsubscribed" : "invalid_token"}`, env.siteUrl),
  );
}

// RFC 8058 one-click: mail clients POST here when the email advertises
// List-Unsubscribe-Post. No redirect — the client is a program, not a person;
// 200 with an empty body is the contract. Same token = same auth.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "job-alerts-unsubscribe", 20);
  if (!limited.ok) return new NextResponse(null, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  // The token may arrive in the query string or as the one-click form body.
  let token = req.nextUrl.searchParams.get("token");
  if (!token) {
    const body = await req.text().catch(() => "");
    token = new URLSearchParams(body).get("token");
  }
  if (!token || token.length < 10) return new NextResponse(null, { status: 200 });
  await q("update job_alerts set paused = true where unsubscribe_token = $1", [token]);
  return new NextResponse(null, { status: 200 });
}
