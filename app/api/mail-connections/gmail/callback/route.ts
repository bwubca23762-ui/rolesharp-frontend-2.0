import { NextRequest, NextResponse } from "next/server";
import { currentSessionBinding, currentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { completeMailboxAuthorization } from "@/lib/mail/connection-flow";
import { safeProviderFailure } from "@/lib/mail/providers";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const [user, sessionBinding] = await Promise.all([currentUser(), currentSessionBinding()]);
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  if (!user || !sessionBinding || !state || !code) {
    return NextResponse.redirect(`${env.siteUrl}/auto-apply?connection=gmail_failed`);
  }
  try {
    await completeMailboxAuthorization({ userId: user.id, provider: "google", sessionBinding, state, code });
    return NextResponse.redirect(`${env.siteUrl}/auto-apply?connection=gmail_connected`);
  } catch (error) {
    const reason = safeProviderFailure(error) === "refresh_consent_required" ? "gmail_consent_required" : "gmail_failed";
    return NextResponse.redirect(`${env.siteUrl}/auto-apply?connection=${reason}`);
  }
}
