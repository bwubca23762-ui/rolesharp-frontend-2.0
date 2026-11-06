import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { submitToIndexNow } from "@/lib/indexnow";
import { listSeoHubs } from "@/lib/db";
import { listPosts } from "@/lib/blog";
import { env } from "@/lib/env";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Push our indexable pages to IndexNow (Bing/Copilot/ChatGPT search).
// Admin-triggered; company×role guides stay user-accessible but are noindex
// until they contain substantive employer-specific evidence.
export async function POST(req: NextRequest) {
  // ADMIN-09: SEO pushes are either a content action or a system action.
  if (!(await hasAdminPermission("content.publish")) && !(await hasAdminPermission("system.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const base = env.siteUrl;
  const urls = new Set<string>([
    base, `${base}/build`, `${base}/checker`, `${base}/jobs`, `${base}/internships`, `${base}/blog`, `${base}/companies`, `${base}/roles`,
  ]);
  // Blog posts
  try { (await listPosts()).forEach((p) => urls.add(`${base}/blog/${p.slug}`)); } catch {}
  // SEO hubs
  try {
    const hubs = await listSeoHubs();
    hubs.companies.forEach((s) => urls.add(`${base}/companies/${s}`));
    hubs.roles.forEach((s) => urls.add(`${base}/roles/${s}`));
  } catch {}
  const result = await submitToIndexNow([...urls]);
  await recordAdminAction("indexnow_submit", { details: result });
  return NextResponse.json(result);
}
