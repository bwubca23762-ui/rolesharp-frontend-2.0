import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { jobsWorkflowConfig } from "@/lib/jobs-workflow/config";
import { listMailboxConnections } from "@/lib/mail/connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const config = jobsWorkflowConfig();
  return NextResponse.json({
    connections: await listMailboxConnections(user.id),
    providers: {
      google: { configured: config.gmail.configured },
      microsoft: { configured: config.microsoft.configured },
    },
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
