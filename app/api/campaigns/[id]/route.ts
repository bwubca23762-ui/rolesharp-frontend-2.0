import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { CampaignUpdateInput } from "@/lib/jobs-workflow/contracts";
import { getCampaign, updateCampaign } from "@/lib/jobs-workflow/campaigns";
import { mutationOriginAllowed, workflowApiError } from "@/lib/jobs-workflow/api";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const Id = z.string().uuid();

export async function GET(_req: NextRequest, { params }: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const id = Id.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "invalid_campaign_id" }, { status: 400 });
  const campaign = await getCampaign(user.id, id.data);
  if (!campaign) return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
  return NextResponse.json({ campaign }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const id = Id.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "invalid_campaign_id" }, { status: 400 });
  const parsed = CampaignUpdateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_campaign_update", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const campaign = await updateCampaign(user.id, id.data, parsed.data);
    if (!campaign) return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
    return NextResponse.json({ campaign }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return workflowApiError(error, "campaign_update_failed");
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const body = new NextRequest(req.url, { method: "PATCH", headers: req.headers, body: JSON.stringify({ action: "cancel" }) });
  return PATCH(body, context);
}
