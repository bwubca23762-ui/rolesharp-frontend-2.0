import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { rateLimit } from "@/lib/rate-limit";
import { opsRequest } from "@/lib/ops-control";

export const runtime = "nodejs";
const SERVICES = new Set([
  "resume-web",
  "resume-worker",
  "rolesharp-jobs",
  "rolesharp-recommendation-agent",
  "rolesharp-auto-apply-agent",
  "rolesharp-blog-worker",
]);
const MAX_LINES = 200;

function redact(line: string) {
  return line
    .replace(/([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/giu, "[redacted-email]")
    .replace(/(authorization|cookie|token|secret|password)=([^\s&]+)/giu, "$1=[redacted]");
}

export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("system.read"))) return NextResponse.json({ error: "admin_required" }, { status: 403 });
  const limited = await rateLimit(req, "admin-logs", 30);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const serviceParam = req.nextUrl.searchParams.get("service") || "resume-web";
  const service = SERVICES.has(serviceParam) ? serviceParam : "resume-web";
  const parsedLines = Number(req.nextUrl.searchParams.get("lines") || 100);
  const lines = Number.isSafeInteger(parsedLines) ? Math.min(Math.max(parsedLines, 1), MAX_LINES) : 100;
  // ADMIN-07: journalctl runs in the root ops-helper daemon — the unprivileged
  // web process has no journal read permission of its own.
  const result = await opsRequest({ action: "logs", unit: service, lines });
  if (!result.ok || !result.lines) {
    return NextResponse.json({ service, lines: [], unavailable: true });
  }
  return NextResponse.json({ service, lines: result.lines.slice(-lines).map(redact) });
}
