import { createHash } from "node:crypto";
import policy from "./url-policy-v1.json";

export type CanonicalUrl = {
  canonicalUrl: string;
  urlHash: string;
  canonicalJobKey: `url:${string}`;
};

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedHost(hostname: string): string {
  return hostname.toLocaleLowerCase("en").replace(/^www\./u, "").replace(/\.$/u, "");
}

export function canonicalizeOfficialApplicationUrl(value: string): CanonicalUrl | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (!(policy.allowedSchemes as string[]).includes(url.protocol)) return null;
  if (url.username || url.password || !url.hostname) return null;
  if (policy.unverifiedRedirectHosts.includes(url.hostname.toLocaleLowerCase("en"))) return null;
  url.hash = "";
  url.hostname = normalizedHost(url.hostname);
  url.port = (url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80") ? "" : url.port;
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLocaleLowerCase("en");
    if (policy.dropParameters.includes(normalized) || policy.dropParameterPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/{2,}/gu, "/").replace(/\/$/u, "") || "/";
  const canonicalUrl = url.toString();
  const urlHash = hash(canonicalUrl);
  return { canonicalUrl, urlHash, canonicalJobKey: `url:${urlHash}` };
}

function safeIdentityPart(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/[^0-9a-z:_-]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 80);
}

export function providerFallbackJobKey(providerNamespace: string, providerJobId: string): `provider:${string}` {
  const provider = safeIdentityPart(providerNamespace) || "unknown";
  return `provider:${provider}:${hash(providerJobId).slice(0, 40)}`;
}

export type CanonicalCompanyIdentity = {
  canonicalCompanyKey: `employer:${string}` | `domain:${string}`;
  verifiedEmployerId: string | null;
  verifiedDomain: string | null;
  state: "verified" | "ambiguous";
  automationBlocked: boolean;
};

export function canonicalCompanyIdentity(input: {
  employerId?: unknown;
  companyUrl?: unknown;
  companyName: string;
}): CanonicalCompanyIdentity {
  if (typeof input.employerId === "string" && /^[0-9A-Za-z._:-]{1,120}$/u.test(input.employerId)) {
    const employerId = safeIdentityPart(input.employerId);
    return {
      canonicalCompanyKey: `employer:${employerId}`,
      verifiedEmployerId: input.employerId,
      verifiedDomain: null,
      state: "verified",
      automationBlocked: false,
    };
  }
  if (typeof input.companyUrl === "string") {
    try {
      const url = new URL(input.companyUrl);
      if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.hostname.includes(".")) {
        const domain = normalizedHost(url.hostname);
        if (!/^(localhost|127\.|0\.|10\.|192\.168\.)/u.test(domain)) {
          return {
            canonicalCompanyKey: `domain:${domain}`,
            verifiedEmployerId: null,
            verifiedDomain: domain,
            state: "verified",
            automationBlocked: false,
          };
        }
      }
    } catch {}
  }
  const fallback = hash(input.companyName.normalize("NFKC").toLocaleLowerCase("en")).slice(0, 32);
  return {
    canonicalCompanyKey: `employer:ambiguous-${fallback}`,
    verifiedEmployerId: `ambiguous-${fallback}`,
    verifiedDomain: null,
    state: "ambiguous",
    automationBlocked: true,
  };
}
