import type { MetadataRoute } from "next";

/**
 * The web app manifest. This is the whole of RoleSharp's "mobile app".
 *
 * The decision (2026-08-16) was a manifest and nothing else: no native app, no
 * service worker. A native app is a second codebase, two store accounts and a
 * review cycle for a product whose constraint is activation — 94% of signups
 * never generate anything — not reach. A service worker adds offline caching,
 * and a stale cached shell serving an old build is a worse bug than no offline
 * support at all.
 *
 * What this buys: installable to a home screen, its own icon, and a standalone
 * window instead of browser chrome. That is the part of "mobile" that touches
 * retention.
 *
 * Colours match app/layout.tsx's viewport themeColor. `background_color` is the
 * splash behind the icon before the first paint, so it is the light surface
 * even though the app has a dark mode — a dark splash under a light first paint
 * flashes.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RoleSharp — AI Resume Builder",
    short_name: "RoleSharp",
    description:
      "Score your resume, tailor it to one exact job, and track the application. Free ATS checks, no account needed.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#f7f9fc",
    icons: [
      // Both purposes point at the same file deliberately: `maskable` lets
      // Android crop to its adaptive-icon shape, and shipping only `any` gets
      // the icon letterboxed in a white circle.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Check a resume", short_name: "Check", url: "/checker" },
      { name: "Tailor to a job", short_name: "Tailor", url: "/build" },
    ],
  };
}
