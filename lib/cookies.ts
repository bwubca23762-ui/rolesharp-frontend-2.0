import { env } from "./env";

function isIpAddress(hostname: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function sharedCookieDomain(originOrUrl: string): string | undefined {
  try {
    const hostname = new URL(originOrUrl).hostname.toLowerCase();
    if (hostname === "localhost" || isIpAddress(hostname)) return undefined;
    const parts = hostname.split(".").filter(Boolean);
    if (parts.length < 2) return undefined;
    return `.${parts.slice(-2).join(".")}`;
  } catch {
    return undefined;
  }
}

export function siteCookieDomain() {
  return sharedCookieDomain(env.siteUrl);
}
