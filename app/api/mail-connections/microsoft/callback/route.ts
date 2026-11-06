import { NextRequest, NextResponse } from "next/server";
import { currentSessionBinding, currentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { completeMailboxAuthorization } from "@/lib/mail/connection-flow";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const [user, sessionBinding] = await Promise.all([currentUser(), currentSessionBinding()]);
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  if (!user || !sessionBinding || !state || !code) {
    return NextResponse.redirect(`${env.siteUrl}/auto-apply?connection=microsoft_failed`);
  }
  try {
    await completeMailboxAuthorization({ userId: user.id, provider: "microsoft", sessionBinding, state, code });
    return NextResponse.redirect(`${env.siteUrl}/auto-apply?connection=microsoft_connected`);
  } catch {
    return NextResponse.redirect(`${env.siteUrl}/auto-apply?connection=microsoft_failed`);
  }
}
