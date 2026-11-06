import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  if (!(await currentUser())) return NextResponse.redirect(`${env.siteUrl}/login?next=/settings`);
  if (!env.googleEnabled) return NextResponse.redirect(`${env.siteUrl}/settings?error=google_reauth_unavailable`);
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const secure = env.siteUrl.startsWith("https://");
  const jar = await cookies();
  jar.set("delete_g_state", state, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 600 });
  jar.set("delete_g_nonce", nonce, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 600 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.googleClientId);
  url.searchParams.set("redirect_uri", `${env.siteUrl}/api/account/delete/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state); url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account"); url.searchParams.set("max_age", "0");
  return NextResponse.redirect(url);
}
