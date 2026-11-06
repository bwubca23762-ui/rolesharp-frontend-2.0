import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { ApplicationSendPolicyInput } from "@/lib/jobs-workflow/contracts";
import { getApplicationSendPolicy, upsertApplicationSendPolicy } from "@/lib/jobs-workflow/campaigns";
import { mutationOriginAllowed, workflowApiError } from "@/lib/jobs-workflow/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  return NextResponse.json({ policy: await getApplicationSendPolicy(user.id) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const parsed = ApplicationSendPolicyInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_send_policy", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    return NextResponse.json({ policy: await upsertApplicationSendPolicy(user.id, parsed.data) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return workflowApiError(error, "send_policy_update_failed");
  }
}
