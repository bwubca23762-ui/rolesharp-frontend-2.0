import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; evidenceId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await hasAdminPermission("support.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, evidenceId } = await params;
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(evidenceId).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const rows = await q<{ file_name: string; content_type: string; data: Buffer }>(
    `select file_name, content_type, data from internship_report_evidence
     where id=$1 and report_id=$2`,
    [evidenceId, id],
  );
  const file = rows[0];
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const safeName = file.file_name.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 180);
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.content_type,
      "Content-Disposition": `attachment; filename="${safeName.replace(/\"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
