import { ImageResponse } from "next/og";
import { buildQuestionBank } from "@/lib/interview-bank";

export const runtime = "nodejs";
export const alt = "Interview question bank";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-role OG card for /interview-questions/<role>: the role and question
// count on the card, with the free angle the page leads with.
export default async function OgImage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  const bank = await buildQuestionBank(role).catch(() => null);
  const roleTitle = bank?.roleTitle ?? role.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const count = bank?.questions.length;

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
            Interview question bank — free
          </span>
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, maxWidth: 1000, letterSpacing: "-0.02em", textTransform: "capitalize" }}>{`${roleTitle} interview questions`}</div>
        <div style={{ fontSize: 28, color: "#94a3b8", marginTop: 26, fontWeight: 500, maxWidth: 1000 }}>
          {count
            ? `${count} questions built from what ${roleTitle} postings actually require — each with what strong answers show.`
            : "Built from what the role's postings actually require — each with what strong answers show."}
        </div>
      </div>
    ),
    { ...size },
  );
}
