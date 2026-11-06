import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { mutationOriginAllowed, workflowApiError } from "@/lib/jobs-workflow/api";
import { approveApplicationPackages } from "@/lib/jobs-workflow/packages";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const parsed = z.object({ approvals: z.array(z.object({
    packageId: z.string().uuid(), selectedRecipient: z.string().trim().email().max(320),
  }).strict()).min(1).max(5) }).strict()
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_approval_batch" }, { status: 400 });
  try {
    return NextResponse.json(await approveApplicationPackages(user.id, parsed.data.approvals));
  } catch (error) {
    return workflowApiError(error, "package_approval_failed");
  }
}
