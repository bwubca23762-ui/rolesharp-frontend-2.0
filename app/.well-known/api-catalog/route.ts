import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RFC 9727 API catalog — lets agents discover what machine-readable surface
// RoleSharp has: the llms.txt service description and the public health check.
// We deliberately do NOT advertise auth'd endpoints; there is no public API.
export async function GET() {
  const catalog = {
    linkset: [
      {
        anchor: `${env.siteUrl}/`,
        "service-doc": [
          { href: `${env.siteUrl}/llms.txt`, type: "text/plain", title: "RoleSharp service description for LLMs/agents" },
        ],
        status: [{ href: `${env.siteUrl}/api/health` }],
      },
    ],
  };
  return NextResponse.json(catalog, {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
