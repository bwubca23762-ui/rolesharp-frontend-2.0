import { NextRequest, NextResponse } from "next/server";
import { sameOriginRequest } from "@/lib/request-origin";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CROSS_ORIGIN_EXCEPTIONS = new Set(["/api/pay/crypto/webhook", "/api/pay/razorpay/webhook"]);

const LOCALE_HEADERS: Record<string, { lang: string; dir: "ltr" | "rtl" }> = {
  "en-us": { lang: "en-US", dir: "ltr" },
  "en-gb": { lang: "en-GB", dir: "ltr" },
  "en-ca": { lang: "en-CA", dir: "ltr" },
  "en-in": { lang: "en-IN", dir: "ltr" },
  "de-de": { lang: "de-DE", dir: "ltr" },
  "fr-fr": { lang: "fr-FR", dir: "ltr" },
  "es-es": { lang: "es-ES", dir: "ltr" },
  "ja-jp": { lang: "ja-JP", dir: "ltr" },
  "ar-ae": { lang: "ar-AE", dir: "rtl" },
};

function preferredHost() {
  const siteUrl = process.env.SITE_URL ?? "";
  try {
    const hostname = new URL(siteUrl).hostname.toLowerCase();
    if (hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) return null;
    return hostname;
  } catch {
    return null;
  }
}

function canonicalHostRedirect(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) return null;
  if (req.method !== "GET" && req.method !== "HEAD") return null;

  const preferred = preferredHost();
  if (!preferred || preferred.startsWith("www.")) return null;

  const host = (req.headers.get("host") ?? "").toLowerCase();
  const hostname = host.split(":")[0];
  if (hostname !== `www.${preferred}`) return null;

  const url = req.nextUrl.clone();
  url.protocol = "https:";
  url.host = preferred;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

function csrfBlocked(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/") || !UNSAFE.has(req.method) || CROSS_ORIGIN_EXCEPTIONS.has(pathname)) {
    return false;
  }
  const origin = req.headers.get("origin");
  if (origin) {
    return !sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host });
  }
  const referer = req.headers.get("referer");
  if (!referer) return true;
  const headers = new Headers(req.headers);
  headers.set("origin", referer);
  return !sameOriginRequest({ headers, fallbackHost: req.nextUrl.host });
}

export function middleware(req: NextRequest) {
  const hostRedirect = canonicalHostRedirect(req);
  if (hostRedirect) return hostRedirect;

  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (csrfBlocked(req)) {
      return NextResponse.json({ error: "cross_origin_blocked" }, { status: 403 });
    }
  }
  const requestHeaders = new Headers(req.headers);
  const firstSegment = req.nextUrl.pathname.split("/")[1]?.toLowerCase() ?? "";
  const locale = LOCALE_HEADERS[firstSegment] ?? { lang: "en", dir: "ltr" as const };
  requestHeaders.set("x-route-path", req.nextUrl.pathname);
  requestHeaders.set("x-route-locale", locale.lang);
  requestHeaders.set("x-route-dir", locale.dir);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-512.png).*)"],
};
