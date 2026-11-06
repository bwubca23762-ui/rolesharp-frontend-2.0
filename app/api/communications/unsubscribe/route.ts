import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { unsubscribeCommunication } from "@/lib/communications";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Token = z.string().min(40).max(2000);

async function unsubscribe(req: NextRequest, token: unknown) {
  const limited = await rateLimit(req, "communication-unsubscribe", 30);
  if (!limited.ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = Token.safeParse(token);
  if (!parsed.success || !(await unsubscribeCommunication(parsed.data))) {
    return NextResponse.json({ error: "unsubscribe_token_expired_or_invalid" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, unsubscribed: true });
}

export async function GET(req: NextRequest) {
  return unsubscribe(req, req.nextUrl.searchParams.get("token"));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { token?: unknown } | null;
  return unsubscribe(req, body?.token);
}
