/** A claim links only to its declared platform; this is not follow evidence. */
export function socialProfileUrl(platform: string, handle: string): string | null {
  const normalized = handle.trim().replace(/^@/, "");
  if (!/^[a-z0-9._-]{1,60}$/i.test(normalized)) return null;
  const base: Record<string, string> = { x: "https://x.com/", instagram: "https://www.instagram.com/", linkedin: "https://www.linkedin.com/in/" };
  return Object.hasOwn(base, platform) ? base[platform] + encodeURIComponent(normalized) : null;
}
