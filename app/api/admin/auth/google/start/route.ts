import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { beginStaffOAuth, staffGoogleRedirectUri } from "@/lib/staff-auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!env.staffGoogleEnabled) {
    return NextResponse.redirect(new URL("/admin?error=staff_google_unconfigured", env.siteUrl));
  }
  const limited = await rateLimit(req, "staff-google-start", 10);
  if (!limited.ok) {
    return NextResponse.redirect(new URL("/admin?error=staff_google_rate_limited", env.siteUrl));
  }
  try {
    const { state, nonce } = await beginStaffOAuth(req.nextUrl.searchParams.get("next"));
    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.searchParams.set("client_id", env.staffGoogleClientId);
    authorization.searchParams.set("redirect_uri", staffGoogleRedirectUri());
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("scope", "openid email profile");
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("nonce", nonce);
    authorization.searchParams.set("access_type", "online");
    authorization.searchParams.set("prompt", "select_account");
    if (env.staffAllowedDomain) authorization.searchParams.set("hd", env.staffAllowedDomain);
    return NextResponse.redirect(authorization);
  } catch (error) {
    console.error("staff_oauth_start_failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.redirect(new URL("/admin?error=staff_google_failed", env.siteUrl));
  }
}
