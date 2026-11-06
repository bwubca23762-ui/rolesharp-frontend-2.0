import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { checkLinkedinProfile } from "@/lib/linkedin-checker";

export const runtime = "nodejs";

const Body = z.object({
  profileText: z.string().min(120).max(40000),
  targetRole: z.string().max(160).optional(),
  targetCompany: z.string().max(160).optional(),
  jdText: z.string().max(20000).optional(),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "check-linkedin", 20);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  // String, not .flatten(): the client renders this into a <p> — an object
// child crashes React ("Objects are not valid as a React child").
if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });

  const result = checkLinkedinProfile(parsed.data);
  return NextResponse.json(result);
}
