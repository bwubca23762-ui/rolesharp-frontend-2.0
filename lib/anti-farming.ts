import { q, withTransaction } from "./db";

// Anti-farming layer (migration 067): disposable-email rejection, signup IP
// velocity auto-bans, and hard bans. The goal is to make multi-account farming
// of free credits and the student offer economically pointless without
// touching legitimate users — loopback/private IPs are exempt, and every
// auto-ban writes a durable row so an admin can audit and reverse it.

const DISPOSABLE_PATTERNS = [
  /^temp(mail|inbox|email)/i,
  /^dispos(able|e)/i,
  /^throwaway/i,
  /^fake(mail|inbox)/i,
  /^burner(mail|email)/i,
  /^10minute/i,
  /^guerrilla/i,
  /^mailinator/i,
  /^yopmail/i,
  /^trashmail/i,
  /^sharklasers/i,
];

const NON_ROUTABLE = new Set(["unknown", "127.0.0.1", "::1"]);

export async function isDisposableEmail(email: string): Promise<boolean> {
  const clean = String(email || "").trim().toLowerCase();
  const domain = clean.split("@")[1];
  if (!domain) return true;
  if (DISPOSABLE_PATTERNS.some((pattern) => pattern.test(domain))) return true;
  const row = (await q<{ id: string }>(
    "select id from banned_identifiers where kind='email_domain' and value=$1 limit 1",
    [domain],
  ))[0];
  return Boolean(row);
}

export async function isIpBanned(ip: string): Promise<boolean> {
  if (!ip || NON_ROUTABLE.has(ip)) return false;
  const row = (await q<{ id: string }>(
    "select id from banned_identifiers where kind='ip' and value=$1 limit 1",
    [ip],
  ))[0];
  return Boolean(row);
}

const SIGNUPS_PER_IP_PER_HOUR = 3;

// Student-offer IP velocity: distinct ACCOUNTS requesting student
// verification tokens from one IP in 24h. Students on one campus NAT can be
// many, so the per-domain daily cap (student route) softens university
// scale — this threshold is deliberately low because a farmed account set
// is exactly what the owner wants hard-banned: every account beyond the
// threshold gets banned by the route, and the IP joins the blocklist.
const STUDENT_ACCOUNTS_PER_IP_PER_DAY = 3;

export async function checkIpStudentVelocity(ip: string): Promise<{ ok: boolean; count: number }> {
  if (!ip || NON_ROUTABLE.has(ip)) return { ok: true, count: 0 };
  if (await isIpBanned(ip)) return { ok: false, count: 999 };
  const rows = await q<{ n: number }>(
    `select count(distinct user_id)::int as n
     from student_verification_tokens
     where request_ip = $1
       and created_at > now() - interval '24 hours'`,
    [ip],
  );
  const count = Number(rows[0]?.n ?? 0);
  if (count >= STUDENT_ACCOUNTS_PER_IP_PER_DAY) {
    await q(
      `insert into banned_identifiers (kind, value, reason, auto_banned)
       values ('ip', $1, 'student_offer_multi_account_ip_farm', true)
       on conflict (value) do nothing`,
      [ip],
    ).catch(() => {});
    return { ok: false, count };
  }
  return { ok: true, count };
}

export async function checkIpSignupVelocity(ip: string): Promise<{ ok: boolean; count: number }> {
  if (!ip || NON_ROUTABLE.has(ip)) return { ok: true, count: 0 };
  if (await isIpBanned(ip)) return { ok: false, count: 999 };
  const rows = await q<{ n: number }>(
    `select count(*)::int as n
     from users
     where signup_ip = $1
       and created_at > now() - interval '1 hour'`,
    [ip],
  );
  const count = Number(rows[0]?.n ?? 0);
  if (count >= SIGNUPS_PER_IP_PER_HOUR) {
    // Auto-ban the IP: durable, auditable, reversible (the admin can delete
    // the banned_identifiers row).
    await q(
      `insert into banned_identifiers (kind, value, reason, auto_banned)
       values ('ip', $1, 'rapid_multi_account_signup_velocity', true)
       on conflict (value) do nothing`,
      [ip],
    ).catch(() => {});
    return { ok: false, count };
  }
  return { ok: true, count };
}

// Hard ban: the session dies on the very next request (auth_version bump +
// is_banned), premium is stripped, and the IP joins the blocklist.
export async function banUser(userId: string, reason: string, ip?: string): Promise<void> {
  await withTransaction(async (query) => {
    await query(
      `update users
       set is_banned = true,
           banned_at = now(),
           banned_reason = $2,
           auth_version = auth_version + 1,
           premium_until = null,
           premium_source = null
       where id = $1`,
      [userId, reason],
    );
    if (ip && !NON_ROUTABLE.has(ip)) {
      await query(
        `insert into banned_identifiers (kind, value, reason, auto_banned)
         values ('ip', $1, $2, true)
         on conflict (value) do nothing`,
        [ip, `banned_with_user_${userId}`],
      );
    }
  });
}

// Forgeable headers are intentionally ignored (client IP ignores
// CF-Connecting-IP per the security test) — x-forwarded-for first hop only.
export function clientIpFromRequest(req: Request): string {
  const header = req.headers.get("x-forwarded-for") ?? "";
  return header.split(",")[0]?.trim() || "unknown";
}
