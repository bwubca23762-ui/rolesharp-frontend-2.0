type RequestOriginInput = {
  headers: Pick<Headers, "get">;
  fallbackHost?: string | null;
};

const HOST_PATTERN = /^(?:\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/iu;

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",", 1)[0]?.trim().toLowerCase();
  return first || null;
}

function safeHost(value: string | null): string | null {
  const host = firstHeaderValue(value);
  if (!host || !HOST_PATTERN.test(host)) return null;
  const port = host.match(/:(\d+)$/u)?.[1];
  if (port && Number(port) > 65_535) return null;
  return host;
}

export function publicRequestHost(input: RequestOriginInput): string | null {
  // Prefer Host because the front proxy is expected to preserve the public
  // authority. Only consult X-Forwarded-Host when Host is unavailable; trusting
  // a client-supplied forwarded value over Host would weaken same-origin checks.
  return safeHost(input.headers.get("host"))
    ?? safeHost(input.headers.get("x-forwarded-host"))
    ?? safeHost(input.fallbackHost ?? null);
}

export function publicRequestOrigin(
  input: RequestOriginInput & { fallbackProtocol?: string | null },
): string | null {
  const host = publicRequestHost(input);
  if (!host) return null;

  const forwardedProtocol = firstHeaderValue(input.headers.get("x-forwarded-proto"));
  const fallbackProtocol = input.fallbackProtocol?.trim().toLowerCase().replace(/:$/u, "") ?? "";
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : fallbackProtocol === "http" || fallbackProtocol === "https"
      ? fallbackProtocol
      : "https";

  return `${protocol}://${host}`;
}

export function sameOriginRequest(input: RequestOriginInput): boolean {
  const origin = input.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host.toLowerCase() === publicRequestHost(input);
  } catch {
    return false;
  }
}
