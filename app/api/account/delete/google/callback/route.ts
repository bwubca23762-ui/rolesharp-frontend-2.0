import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { currentUser, setDeletionReauth } from "@/lib/auth";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  const jar = await cookies();
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  const expectedState = jar.get("delete_g_state")?.value;
  const expectedNonce = jar.get("delete_g_nonce")?.value;
  jar.delete("delete_g_state"); jar.delete("delete_g_nonce");
  if (!user || !code || !state || state !== expectedState || !expectedNonce) {
    return NextResponse.redirect(`${env.siteUrl}/settings?error=google_reauth_failed`);
  }
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: env.googleClientId, client_secret: env.googleClientSecret,
        redirect_uri: `${env.siteUrl}/api/account/delete/google/callback`, grant_type: "authorization_code" }),
    });
    if (!response.ok) throw new Error("reauth_exchange_failed");
    const token = await response.json() as { id_token?: unknown };
    if (typeof token.id_token !== "string") throw new Error("reauth_token_missing");
    const verified = await jwtVerify(token.id_token, createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")), {
      issuer: ["https://accounts.google.com", "accounts.google.com"], audience: env.googleClientId, maxTokenAge: "10 minutes",
    });
    if (verified.payload.nonce !== expectedNonce || verified.payload.email_verified !== true
      || typeof verified.payload.email !== "string" || verified.payload.email.toLocaleLowerCase("en") !== user.email.toLocaleLowerCase("en")) {
      throw new Error("reauth_identity_mismatch");
    }
    await setDeletionReauth(user.id);
    return NextResponse.redirect(`${env.siteUrl}/settings?deleteReauth=ready`);
  } catch {
    return NextResponse.redirect(`${env.siteUrl}/settings?error=google_reauth_failed`);
  }
}
