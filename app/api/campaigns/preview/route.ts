import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { CampaignCreateInput } from "@/lib/jobs-workflow/contracts";
import { previewCampaign } from "@/lib/jobs-workflow/campaigns";
import { mutationOriginAllowed, workflowApiError } from "@/lib/jobs-workflow/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const parsed = CampaignCreateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_campaign", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    return NextResponse.json({ preview: previewCampaign(parsed.data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return workflowApiError(error, "campaign_preview_failed");
  }
}
