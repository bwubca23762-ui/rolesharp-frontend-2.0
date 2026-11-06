export function trustedClientIp(headers: Pick<Headers, "get">) {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for");
  return xff?.split(",").map((s) => s.trim()).filter(Boolean).at(-1) || "unknown";
}
