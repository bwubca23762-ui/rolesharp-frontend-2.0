import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { activateStudentOffer, isStudentOfferActive, sendStudentActivatedEmail } from "@/lib/student";

export const runtime = "nodejs";

// GET /api/student/confirm?token= — activate the 6-month student Premium.
// The claim insert is the atomic gate: ON CONFLICT DO NOTHING means a student
// email can only ever be claimed once, even under concurrent clicks.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  // The #student anchor rides in the redirect Location header; the browser
  // applies it after landing, so an email-link tap on mobile scrolls straight
  // to the status card instead of the top of /pricing.
  const back = (path: string) => NextResponse.redirect(`${env.siteUrl}${path}`);
  // Kill switch: an already-emailed token must not activate after close.
  if (!(await isStudentOfferActive())) return back("/pricing?student=disabled#student");
  if (!token) return back("/pricing?student=invalid#student");

  let result: Awaited<ReturnType<typeof activateStudentOffer>>;
  try {
    result = await activateStudentOffer(token);
  } catch {
    // Account deleted or banned between token request and confirm — the
    // transaction rolled back, the token stays unused, the offer stays shut.
    return back("/pricing?student=invalid#student");
  }
  if (result.kind === "invalid") return back("/pricing?student=expired#student");
  if (result.kind === "claimed") return back("/pricing?student=claimed#student");

  try {
    await sendStudentActivatedEmail(
      result.studentEmail,
      new Date(result.premiumUntil),
      result.offer,
    );
  } catch {}
  return back("/settings?student=activated");
}
