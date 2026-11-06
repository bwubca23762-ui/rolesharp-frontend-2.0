import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { CareerProfileInput } from "@/lib/jobs-workflow/contracts";
import { mutationOriginAllowed, workflowApiError } from "@/lib/jobs-workflow/api";
import { createCareerProfileVersion, listCareerProfileVersions } from "@/lib/jobs-workflow/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  try {
    return NextResponse.json({ profiles: await listCareerProfileVersions(user.id) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return workflowApiError(error, "profiles_unavailable");
  }
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = CareerProfileInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_career_profile", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const profile = await createCareerProfileVersion(user.id, parsed.data);
    return NextResponse.json({ profile }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return workflowApiError(error, "profile_create_failed");
  }
}
