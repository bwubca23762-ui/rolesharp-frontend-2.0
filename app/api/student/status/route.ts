import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { currentStudentOfferSummary } from "@/lib/offers";
import { isStudentOfferActive } from "@/lib/student";

export const runtime = "nodejs";

// GET /api/student/status — drives the StudentOfferCard states.
export async function GET() {
  const user = await currentUser();
  if (!user) {
    // Kill switch must be visible to logged-out visitors too: the claim card
    // on /pricing renders for them and must show "applications closed", not
    // a stale "log in to claim" pitch.
    return NextResponse.json({
      enabled: await isStudentOfferActive(),
      eligible: false,
      pending: false,
      claimed: false,
      activeStudent: false,
      studentEmail: null,
      premiumUntil: null,
      offer: null,
      claimedOfferVersion: null,
    });
  }

  const u = (await q<{ premium_until: string | null; premium_source: string | null; student_email: string | null }>(
    "select premium_until, premium_source, student_email from users where id=$1",
    [user.id],
  ))[0];
  const claim = (await q<{
    student_email: string;
    claimed_at: string;
    offer_version_number: number;
    offer_terms_snapshot: unknown;
  }>(
    `select student_email,claimed_at,offer_version_number,offer_terms_snapshot
     from student_claims where user_id=$1`,
    [user.id],
  ))[0];
  const pending = (await q<{ n: string }>(
    "select count(*)::int n from student_verification_tokens where user_id=$1 and used_at is null and expires_at > now()",
    [user.id],
  ))[0];

  // The offer summary throws offer_unavailable when no published version is
  // effective (e.g., enrollment ended) — that must surface as data, not a 500.
  // enabled:false closes the claim form; activeStudent is untouched, so
  // verified students keep reading their own status correctly.
  const offerEnabled = await isStudentOfferActive();
  const offer = offerEnabled ? await currentStudentOfferSummary().catch(() => null) : null;
  const activeStudent = !!claim && u?.premium_source === "student" && !!u?.premium_until && new Date(u.premium_until) > new Date();
  return NextResponse.json({
    enabled: offerEnabled,
    eligible: !claim && offerEnabled,
    pending: Number(pending?.n ?? 0) > 0,
    claimed: !!claim,
    activeStudent,
    studentEmail: claim?.student_email ?? u?.student_email ?? null,
    premiumUntil: u?.premium_until ?? null,
    offer,
    claimedOfferVersion: claim?.offer_version_number ?? null,
  });
}
