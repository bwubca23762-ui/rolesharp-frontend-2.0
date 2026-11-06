import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // An OG render is a real CPU cost per hit and the image carries only
  // caller-supplied, non-personal numbers — cache it publicly and rate-limit
  // so a scripted flood cannot turn a share-card into a render farm.
  const limited = await rateLimit(req, "score-card", 30);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const url = new URL(req.url);
  const score = Math.max(0, Math.min(100, Number(url.searchParams.get("s") ?? "0")) || 0);
  const role = (url.searchParams.get("r") ?? "").slice(0, 40) || null;
  // Up to three category labels with their own scores.
  // Separator: the LAST hyphen, colon, pipe, comma or equals in the value —
  // labels legitimately contain spaces and some contain hyphens ("full-stack"),
  // so last-match is the least-surprising rule. Malformed values render as an
  // omitted category rather than a silent empty half of the card.
  const cats: Array<{ label: string; pct: number }> = [];
  for (const key of ["c1", "c2", "c3"]) {
    const raw = url.searchParams.get(key);
    if (!raw) continue;
    const sep = Math.max(raw.lastIndexOf("-"), raw.lastIndexOf(":"), raw.lastIndexOf("|"), raw.lastIndexOf(","), raw.lastIndexOf("="));
    if (sep < 1) continue;
    const label = raw.slice(0, sep).trim().slice(0, 28);
    if (!label) continue;
    const pct = Math.max(0, Math.min(100, Number(raw.slice(sep + 1)) || 0));
    cats.push({ label, pct });
  }

  const tone = score >= 75 ? "#10b981" : score >= 55 ? "#3b82f6" : "#f59e0b";
  const dark = "#061426";
  const muted = "#8FA3BC";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex",
          background: `linear-gradient(135deg, ${dark} 0%, #0d2036 100%)`,
          padding: "48px 56px",
          fontFamily: "system-ui, sans-serif",
          color: "#F4F7FB",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: "#123B7A", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 26 }}>R</span>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", display: "flex" }}>
              <span>Role</span>
              <span style={{ color: tone }}>Sharp</span>
            </div>
            {role && (
              <div style={{ marginLeft: "auto", fontSize: 20, color: muted, display: "flex" }}>
                <span>Target:&nbsp;</span>
                <span>{role}</span>
              </div>
            )}
          </div>

          {/* Score + bars */}
          <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 64, marginTop: 12 }}>
            <div style={{ position: "relative", width: 260, height: 260, display: "flex", flexShrink: 0 }}>
              <svg width="260" height="260" viewBox="0 0 260 260" style={{ display: "flex" }}>
                <circle cx="130" cy="130" r="110" stroke="#112943" strokeWidth="22" fill="none" />
                <circle
                  cx="130" cy="130" r="110" stroke={tone} strokeWidth="22" fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 691} 691`}
                  transform="rotate(-90 130 130)"
                />
              </svg>
              {/* Satori's absolute+inset centring drifts left and collides with
                  the ring; explicit width + flex centring is deterministic. */}
              <div style={{ position: "absolute", top: 0, left: 0, width: 260, height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 88, fontWeight: 800, lineHeight: 1 }}>{score}</span>
                <span style={{ fontSize: 18, color: muted, letterSpacing: 2, marginTop: 6 }}>{"ATS SCORE"}</span>
              </div>
            </div>

            {cats.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
                {cats.map((cat) => (
                  <div key={cat.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19 }}>
                      <span>{cat.label}</span>
                      <span style={{ color: muted }}>{cat.pct}</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "#112943", display: "flex" }}>
                      <div style={{ height: 10, borderRadius: 999, background: tone, width: `${cat.pct}%`, display: "flex" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: muted }}>
            <span>Check your resume free at rolesharp.com/checker</span>
            <span>No account needed</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Content is a pure function of the query params and carries no PII —
        // CDN-cacheable for a day, SWR for a week.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
