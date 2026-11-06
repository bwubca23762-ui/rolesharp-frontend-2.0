import { ImageResponse } from "next/og";
import { getCompanyBySlug, getRoleBySlug } from "@/lib/db";
import { companyDisplayName } from "@/lib/company-display";
import { seoCountryName } from "@/lib/country-display";

export const runtime = "nodejs";
export const alt = "Company and role resume guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-pair OG card for /resume/<company>/<role>: the company + role on the
// card instead of the generic site image. ~400k pair pages share one layout;
// the pair identity is the whole point of the share.
export default async function OgImage({ params }: { params: Promise<{ company: string; role: string }> }) {
  const { company, role } = await params;
  const [cRow, rRow] = await Promise.all([
    getCompanyBySlug(company).catch(() => null),
    getRoleBySlug(role).catch(() => null),
  ]);
  const titleCase = (slug: string) =>
    slug.replace(/^[a-z]{2}-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const companyName = cRow ? companyDisplayName(company, cRow.name) : titleCase(company);
  const roleName = rRow?.title ?? titleCase(role);
  const market = seoCountryName(cRow?.country_code);

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
            Resume guide{market ? ` — ${market}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, fontSize: 76, fontWeight: 700, maxWidth: 1000, letterSpacing: "-0.02em" }}>
          <span>{companyName}</span>
          <span style={{ color: "#818CF8", fontSize: 54 }}>·</span>
          <span>{roleName}</span>
        </div>
        <div style={{ fontSize: 28, color: "#94a3b8", marginTop: 26, fontWeight: 500 }}>
          Tailor your resume to this exact company and role — free ATS score on every version.
        </div>
      </div>
    ),
    { ...size },
  );
}
