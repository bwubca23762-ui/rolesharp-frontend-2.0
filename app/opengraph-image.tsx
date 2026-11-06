import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "RoleSharp — AI resume builder tailored to any company & role";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamic Open Graph / Twitter card image (no static asset needed). Next.js
// auto-injects og:image AND twitter:image meta pointing at this route.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#1e293b",
          color: "#f8fafc",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 800, marginBottom: 24, letterSpacing: 2 }}>
          <span>ROLE</span>
          <span style={{ color: "#818CF8" }}>SHARP</span>
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, maxWidth: 940, letterSpacing: "-0.02em" }}>
          Send the final draft, not the first.
        </div>
        <div style={{ fontSize: 30, color: "#94a3b8", marginTop: 28, fontWeight: 500 }}>
          Resume checker — AI builder — ATS score — free to start.
        </div>
      </div>
    ),
    { ...size },
  );
}
