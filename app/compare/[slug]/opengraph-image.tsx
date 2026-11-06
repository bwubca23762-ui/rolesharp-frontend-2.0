import { ImageResponse } from "next/og";
import { COMPETITORS } from "@/content/competitors";

export const runtime = "nodejs";
export const alt = "RoleSharp comparison";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-comparison OG card ("RoleSharp vs X") — comparison queries have high
// commercial intent, and a versus-styled card wins clicks on shares/Discover.
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = COMPETITORS.find((x) => x.slug === slug);
  const them = c?.name ?? "the alternatives";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "80px",
          background: "#1e293b",
          color: "#f8fafc",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 800, marginBottom: 40, letterSpacing: 2 }}>
          <span>ROLE</span>
          <span style={{ color: "#818CF8" }}>SHARP</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 40, fontSize: 76, fontWeight: 700, letterSpacing: "-0.02em" }}>
          <span>RoleSharp</span>
          <span style={{ color: "#818CF8", fontSize: 54 }}>vs</span>
          <span>{them}</span>
        </div>
        <div style={{ fontSize: 30, color: "#94a3b8", marginTop: 36, fontWeight: 500, textAlign: "center" }}>
          Honest feature-by-feature comparison — pricing, ATS scoring, free tiers.
        </div>
      </div>
    ),
    { ...size },
  );
}
