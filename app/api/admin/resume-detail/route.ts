import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { ResumeContent } from "@/lib/types";
import { atsDiagnostics } from "@/lib/ats-score";
import { renderResumePdf } from "@/lib/pdf";
import { renderResumeDocx } from "@/lib/docx";
import { resumeSourceText } from "@/lib/ats-extract";
import { rateLimit } from "@/lib/rate-limit";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("users.read"))) return NextResponse.json({ error: "admin_required" }, { status: 403 });
  const limited = await rateLimit(req, "admin-resume-detail", 20);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const rows = await q<any>(
    `select r.*, to_char(r.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_fmt
     from resumes r where r.id = $1`, [id]
  );
  if (!rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const r = rows[0];
  const parsed = ResumeContent.safeParse(r.content);
  const format = req.nextUrl.searchParams.get("format");
  if (format) {
    if (!["pdf", "docx", "txt"].includes(format)) return NextResponse.json({ error: "invalid_format" }, { status: 400 });
    if (!parsed.success) return NextResponse.json({ error: "invalid_resume_content" }, { status: 422 });
    const name = r.candidate_name || "Resume";
    try {
      const artifact = format === "pdf"
        ? await renderResumePdf(parsed.data, name, { template: r.template || "basic", watermark: false })
        : format === "docx" ? await renderResumeDocx(parsed.data, name)
          : Buffer.from(resumeSourceText(parsed.data), "utf8");
      await recordAdminAction("resume_export", { details: { resumeId: r.id, format } });
      return new NextResponse(new Uint8Array(artifact), { headers: {
        "Content-Type": format === "pdf" ? "application/pdf" : format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="resume.${format}"`,
        "Cache-Control": "private, no-store",
      } });
    } catch {
      return NextResponse.json({ error: "export_failed" }, { status: 500 });
    }
  }
  return NextResponse.json({
    id: r.id,
    candidateName: r.candidate_name,
    headline: r.headline,
    companyName: r.company_name,
    roleTitle: r.role_title,
    atsScore: r.ats_score,
    genMs: r.gen_ms,
    template: r.template || "basic",
    premiumUnlock: r.premium_unlock,
    created: r.created_fmt,
    content: r.content,
    jdText: r.jd_text,
    diagnostics: parsed.success ? atsDiagnostics(r.jd_text || "", parsed.data) : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
