import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { CampaignCreateInput } from "@/lib/jobs-workflow/contracts";
import { mutationOriginAllowed, workflowApiError } from "@/lib/jobs-workflow/api";
import { createCampaign, listCampaigns } from "@/lib/jobs-workflow/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  try {
    return NextResponse.json({ campaigns: await listCampaigns(user.id) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return workflowApiError(error, "campaigns_unavailable");
  }
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const parsed = CampaignCreateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_campaign", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const campaign = await createCampaign(user.id, parsed.data);
    return NextResponse.json({ campaign }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return workflowApiError(error, "campaign_create_failed");
  }
}
