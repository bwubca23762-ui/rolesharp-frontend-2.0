import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { mutationOriginAllowed, workflowApiError } from "@/lib/jobs-workflow/api";
import { getApplicationPackage, reviseApplicationPackage } from "@/lib/jobs-workflow/packages";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const Id = z.string().uuid();

export async function GET(_req: NextRequest, { params }: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const id = Id.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "invalid_package_id" }, { status: 400 });
  const applicationPackage = await getApplicationPackage(user.id, id.data);
  if (!applicationPackage) return NextResponse.json({ error: "package_not_found" }, { status: 404 });
  return NextResponse.json({ package: applicationPackage }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const id = Id.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "invalid_package_id" }, { status: 400 });
  const parsed = z.object({
    subject: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(10_000).optional(),
  }).strict().refine((value) => value.subject !== undefined || value.body !== undefined)
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_package_revision" }, { status: 400 });
  try {
    const revised = await reviseApplicationPackage({ userId: user.id, packageId: id.data, ...parsed.data });
    if (!revised) return NextResponse.json({ error: "package_not_found" }, { status: 404 });
    return NextResponse.json({ package: revised }, { status: 201 });
  } catch (error) {
    return workflowApiError(error, "package_revision_failed");
  }
}
