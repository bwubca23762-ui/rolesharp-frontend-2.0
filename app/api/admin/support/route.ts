import { NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { listAllTickets, countOpenTickets } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await hasAdminPermission("support.read")) && !(await hasAdminPermission("support.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rawStatus = new URL(req.url).searchParams.get("status");
  const status = rawStatus === "open" || rawStatus === "answered" || rawStatus === "resolved" ? rawStatus : undefined;
  const [tickets, open] = await Promise.all([listAllTickets(status || undefined), countOpenTickets()]);
  return NextResponse.json({ tickets, openCount: open });
}
