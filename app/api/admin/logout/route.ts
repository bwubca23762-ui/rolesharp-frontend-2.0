import { NextRequest, NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/auth";
import { currentAdminPrincipal } from "@/lib/admin-authorization";
import { clearStaffCookie, revokeCurrentStaffSession } from "@/lib/staff-auth";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const principal = await currentAdminPrincipal();
  await revokeCurrentStaffSession();
  const [adminCookies, staffCookies] = await Promise.all([clearAdminSession(), clearStaffCookie()]);
  if (principal) {
    await recordAdminAction("admin_logout", {
      details: {
        authenticationMethod: principal.authenticationMethod,
        staffAccountId: principal.staffAccountId,
      },
    });
  }
  const res = NextResponse.json({ ok: true });
  for (const cookie of [...adminCookies, ...staffCookies]) res.headers.append("Set-Cookie", cookie);
  return res;
}
