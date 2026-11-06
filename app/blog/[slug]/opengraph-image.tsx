import { ImageResponse } from "next/og";
import { getPost } from "@/lib/blog";

export const runtime = "nodejs";
export const alt = "RoleSharp blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-post OG image: the actual headline on the card lifts CTR from social
// shares and Google Discover versus the one generic site-wide image.
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  const title = post?.h1 ?? "Resume guides that get interviews";
  const category = post?.category ?? "Guide";
  const mins = post?.readMins;

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
        <div style={{ display: "flex", alignItems: "center", fontSize: 36, fontWeight: 800, marginBottom: 20, letterSpacing: 2 }}>
          <span>ROLE</span>
          <span style={{ color: "#818CF8" }}>SHARP</span>
          <span style={{ fontSize: 24, color: "#94a3b8", marginLeft: 24, letterSpacing: 0, fontWeight: 500 }}>
            {category}{mins ? ` — ${mins} min read` : ""}
          </span>
        </div>
        <div style={{ fontSize: title.length > 60 ? 54 : 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000, letterSpacing: "-0.02em" }}>
          {title}
        </div>
        <div style={{ fontSize: 28, color: "#94a3b8", marginTop: 26, fontWeight: 500 }}>
          rolesharp.com/blog — free resume guides, ATS checker, AI builder
        </div>
      </div>
    ),
    { ...size },
  );
}
