import { ImageResponse } from "next/og";
import { candidatesPromise, salaryPageStats } from "@/lib/salary-pages";

export const runtime = "nodejs";
export const alt = "Role and country salary data";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-role×market OG card for /salaries/<role>/<country>: the median from
// live postings goes on the card — the number is the share's value, and it
// always comes from the same stats engine the page renders (no drift).
export default async function OgImage({ params }: { params: Promise<{ role: string; country: string }> }) {
  const { role: roleSlug, country } = await params;
  const candidates = await candidatesPromise(150).catch(() => []);
  const candidate = candidates.find(
    (c) => c.roleSlug === roleSlug && c.countryCode.toLowerCase() === country,
  );
  const stats = candidate ? await salaryPageStats(roleSlug, country, new Set([`${roleSlug}/${country}`])).catch(() => null) : null;

  const roleTitle = stats?.roleTitle ?? candidate?.roleTitle ?? roleSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const median =
    stats?.median != null
      ? `${stats.currency} ${stats.median.toLocaleString()}`
      : "Real advertised pay";
  const sampleLine = stats
    ? `Computed from ${stats.sampleSize.toLocaleString()} live postings with published annual pay`
    : "Computed from live job postings with published salaries — never estimates";

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
            Salary data — no estimates
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, fontSize: 72, fontWeight: 700, maxWidth: 1000, letterSpacing: "-0.02em" }}>
          <span style={{ textTransform: "capitalize" }}>{roleTitle}</span>
          <span style={{ color: "#818CF8", fontSize: 54 }}>·</span>
          <span style={{ textTransform: "uppercase" }}>{country}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 30 }}>
          <span style={{ fontSize: 26, color: "#94a3b8", fontWeight: 500 }}>Median advertised:</span>
          <span style={{ fontSize: 44, fontWeight: 700, color: "#818CF8" }}>{median}</span>
        </div>
        <div style={{ fontSize: 24, color: "#94a3b8", marginTop: 18, fontWeight: 500, maxWidth: 1000 }}>
          {sampleLine}
        </div>
      </div>
    ),
    { ...size },
  );
}
