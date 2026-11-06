import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { withTransaction } from "@/lib/db";
import { env } from "@/lib/env";
import {
  isStudentOfferActive,
  createStudentToken,
  deliverStudentVerification,
  isAcademicEmail,
  normalizeStudentEmail,
} from "@/lib/student";
import { banUser, checkIpStudentVelocity, clientIpFromRequest, isDisposableEmail, isIpBanned } from "@/lib/anti-farming";

export const runtime = "nodejs";

// POST /api/student/send { studentEmail } — email a verification link to the
// academic address. One lifetime claim per student email AND per account.
// Farm guards are hard by owner decision (2026-09-18): a burner inbox or a
// multi-account IP farm is not rejected but BANNED — premium stripped,
// sessions killed, IP blocklisted, everything written to admin_actions and
// banned_identifiers for audit/reversal.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  // Kill switch before any lock or token work (migration 065 / env switch):
  // the program is closed for new applications; structured, not a 500.
  if (!(await isStudentOfferActive())) {
    return NextResponse.json({ error: "student_offer_disabled", message: "The Student Premium promotion is currently closed for new applications." }, { status: 410 });
  }
  const limited = await rateLimit(req, "student-send", 5);
  if (!limited.ok) return NextResponse.json({ error: "too_many_attempts" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const ip = clientIpFromRequest(req);
  // A blocklisted IP never reaches token work at all (banned_identifiers row).
  if (await isIpBanned(ip)) {
    return NextResponse.json({ error: "student_blocked" }, { status: 403 });
  }

  const { studentEmail } = await req.json().catch(() => ({}));
  const raw = String(studentEmail || "").trim().toLowerCase();
  if (!isAcademicEmail(raw)) {
    return NextResponse.json({ error: "not_academic" }, { status: 400 });
  }
  // A burner-shaped inbox on an academic-shaped domain is deliberate fraud,
  // not a typo: ban on sight (defense-in-depth — the abuse list usually
  // rejects these earlier as not_academic).
  if (await isDisposableEmail(raw)) {
    await banUser(user.id, "student_offer_disposable_email", ip);
    return NextResponse.json({ error: "student_blocked" }, { status: 403 });
  }
  // Multi-account farming from one IP: the check auto-blocklists the IP;
  // the requesting account joins it with a hard ban.
  const velocity = await checkIpStudentVelocity(ip);
  if (!velocity.ok) {
    await banUser(user.id, "student_offer_ip_velocity_farm", ip);
    return NextResponse.json({ error: "student_blocked" }, { status: 403 });
  }
  const claimKey = normalizeStudentEmail(raw);

  // Serialize admission for both this account and this domain. The transaction
  // rechecks lifetime claims, applies daily caps, records a throttle audit, and
  // creates the pending token as one decision.
  const DOMAIN_DAILY_CAP = env.studentDomainDailyCap;
  const domain = claimKey.split("@")[1] || "";
  const admission = await withTransaction(async (query) => {
    await query("select pg_advisory_xact_lock(hashtext($1))", [`student-account:${user.id}`]);
    await query("select pg_advisory_xact_lock(hashtext($1))", [`student-domain:${domain}`]);

    const claimed = (await query<{ user_id: string | null }>(
      "select user_id from student_claims where student_email=$1",
      [claimKey],
    ))[0];
    if (claimed) return claimed.user_id === user.id ? "already_active" as const : "email_claimed" as const;
    const mine = (await query<{ student_email: string }>(
      "select student_email from student_claims where user_id=$1",
      [user.id],
    ))[0];
    if (mine) return "account_already_claimed" as const;

    const sentToday = Number((await query<{ n: string }>(
      "select count(*)::int n from student_verification_tokens where user_id=$1 and created_at > now() - interval '1 day'",
      [user.id],
    ))[0]?.n ?? 0);
    if (sentToday >= 3) return "too_many_attempts" as const;

    const domainToday = Number((await query<{ n: string }>(
      `select count(distinct user_id)::int n
       from student_verification_tokens
       where split_part(lower(student_email), '@', 2)=$1
         and created_at > now() - interval '1 day'`,
      [domain],
    ))[0]?.n ?? 0);
    if (domainToday >= DOMAIN_DAILY_CAP) {
      await query(
        `insert into admin_actions (action, target_email, details) values ($1,$2,$3)`,
        ["student_domain_throttled", claimKey, JSON.stringify({ domain, distinctAccountsToday: domainToday })],
      );
      return "too_many_attempts" as const;
    }
    return createStudentToken(user.id, claimKey, query, ip);
  });

  if (typeof admission === "string") {
    const status = admission === "too_many_attempts" ? 429 : 409;
    return NextResponse.json({ error: admission }, { status });
  }
  try {
    await deliverStudentVerification(admission, raw);
  } catch {
    return NextResponse.json({ error: "email_send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sentTo: raw });
}
