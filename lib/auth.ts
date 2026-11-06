import { createHmac, scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import { q } from "./db";
import { env } from "./env";
import { getDevUserById } from "./local-dev-store";
import { siteCookieDomain } from "./cookies";

const SECRET = env.authSecret;
// Node's scrypt defaults (N=16384, r=8, p=1) stated explicitly rather than
// inherited. These are not a tuning choice — they are the values every hash and
// session key in the database was already derived under, so they are now pinned
// so a future Node default change cannot silently weaken new password hashes
// while leaving old ones unverifiable. maxmem must be raised alongside N: the
// default 32MB ceiling is only just above the 16MB this costs.
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
// 256-bit key derived from AUTH_SECRET for AES-GCM content encryption (JWE).
const ENC_KEY = scryptSync(SECRET, "rolesharp-jwe-v1", 32, SCRYPT);
const COOKIE = "rai_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days (absolute cap)
const ADMIN_MAX_AGE = 60 * 60 * 8; // 8 hours (absolute cap)
const DELETE_REAUTH_COOKIE = "rai_delete_reauth";
// Auto-logout on inactivity (sliding idle timeout). Sessions carry `la` (last
// activity) and `sa` (session start); activity slides `la`, but `sa` still
// enforces the absolute cap so a session can never outlive MAX_AGE.
const IDLE_MAX = env.sessionIdleHours * 3600; // users: configurable idle timeout
const ADMIN_IDLE_MAX = env.adminIdleMinutes * 60; // admin: configurable idle timeout
const REFRESH_AFTER = 5 * 60; // re-issue the cookie at most every 5 minutes

// ---- password hashing (scrypt, no native deps) ----
export function hashPassword(pw: string): string {
  if (typeof pw !== "string" || pw.length < 1 || pw.length > 256) throw new Error("password_length_invalid");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64, SCRYPT).toString("hex");
  return `${salt}:${hash}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  if (!stored || typeof pw !== "string" || pw.length > 256) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(pw, salt, 64, SCRYPT);
  const orig = Buffer.from(hash, "hex");
  return test.length === orig.length && timingSafeEqual(test, orig);
}

// ---- encrypted JWT (JWE: dir + A256GCM) ----
// Payload is encrypted AND authenticated — the cookie is fully opaque, so uid /
// email never leak even if a token is captured, and tampering is detected.
async function signToken(payload: Record<string, any>, maxAge: number = MAX_AGE): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .encrypt(ENC_KEY);
}
async function verifyToken(token: string): Promise<Record<string, any> | null> {
  try {
    const { payload } = await jwtDecrypt(token, ENC_KEY, { clockTolerance: 5 });
    return payload as Record<string, any>;
  } catch {
    return null;
  }
}

// ---- session cookie helpers ----
export async function setSession(userId: string, email: string, sessionStart?: number, authVersion?: number, sessionId?: string) {
  const jar = await cookies();
  const now = Math.floor(Date.now() / 1000);
  let av = authVersion;
  if (av === undefined && !env.localDevMode) {
    av = (await q<{ auth_version: number }>("select auth_version from users where id=$1", [userId]))[0]?.auth_version;
  }
  // `sid` identifies the login, not the token. The sliding refresh re-issues a
  // token every 5 minutes and must carry the same sid through, otherwise a
  // token captured before a refresh would hold a sid that logout never revokes
  // and would outlive the logout entirely — the exact hole this closes.
  const sid = sessionId ?? randomBytes(16).toString("hex");
  jar.set(COOKIE, await signToken({ uid: userId, email, av: av ?? 0, sid, la: now, sa: sessionStart ?? now }), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE,
    domain: siteCookieDomain(),
    secure: process.env.NODE_ENV === "production" && (process.env.SITE_URL ?? "").startsWith("https"),
  });
}
// Browsers only delete a cookie when name+domain+path match how it was set.
// Sessions may exist host-only (set while SITE_URL was an IP) or domain-scoped,
// so expire both. The Next cookie jar can't do this — it dedupes by name and
// rewrites Set-Cookie after the handler returns, clobbering appended headers —
// so routes must append these raw headers to a response the jar never touches.
async function expireCookie(name: string): Promise<string[]> {
  const base = `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  const out = [base];
  const domain = siteCookieDomain();
  if (domain) out.push(`${base}; Domain=${domain}`);
  return out;
}
export async function clearSession(): Promise<string[]> {
  // Expiring the cookie only asks the browser to forget the token; anyone who
  // already copied it keeps a valid one. Record the sid so currentUser() stops
  // honouring it, for the remaining lifetime of the token and no longer.
  const token = (await cookies()).get(COOKIE)?.value;
  if (token && !env.localDevMode) {
    const payload = await verifyToken(token);
    const sid = typeof payload?.sid === "string" ? payload.sid : null;
    // Tokens issued before this shipped carry no sid and cannot be revoked
    // individually; they still expire via the idle and absolute caps, and a
    // password change still bumps auth_version to kill them at once.
    if (sid) {
      const expiresAt = new Date(Number(payload?.exp ?? 0) * 1000);
      await q(
        `insert into revoked_sessions (session_id, expires_at) values ($1,$2)
         on conflict (session_id) do nothing`,
        [sid, Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now()
          ? expiresAt.toISOString()
          : new Date(Date.now() + MAX_AGE * 1000).toISOString()],
      // Logout must clear the cookie even if the database is unreachable;
      // failing the revocation write here would leave the user logged in.
      ).catch((e) => console.error("session revocation failed:", e instanceof Error ? e.message : e));
    }
  }
  return expireCookie(COOKIE);
}

export type SessionUser = { id: string; email: string; premium: boolean; premiumUntil: string | null; emailVerified: boolean; premiumSource?: string | null };

// ---- ADMIN auth (completely separate from user login) ----
const ADMIN_COOKIE = "rai_admin";

export function checkAdminCreds(user: string, password: string): boolean {
  if (!env.adminPassword) return false; // admin disabled until password set
  const a = Buffer.from(user ?? "");
  const b = Buffer.from(env.adminUser);
  const c = Buffer.from(password ?? "");
  const d = Buffer.from(env.adminPassword);
  return a.length === b.length && timingSafeEqual(a, b) && c.length === d.length && timingSafeEqual(c, d);
}

function decodeBase32(secret: string): Buffer | null {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.toUpperCase().replace(/[\s=-]/g, "");
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return bytes.length >= 10 ? Buffer.from(bytes) : null;
}

export function verifyAdminTotp(code: string, nowMs = Date.now()): boolean {
  // Local development may omit MFA. Production fails closed unless the secret
  // is present, so a missing deployment variable cannot silently disable MFA.
  if (!env.adminTotpSecret) return process.env.NODE_ENV !== "production";
  if (!/^\d{6}$/.test(code ?? "")) return false;
  const key = decodeBase32(env.adminTotpSecret);
  if (!key) return false;
  const expectedInput = Buffer.from(code);
  const step = Math.floor(nowMs / 30_000);
  for (let drift = -1; drift <= 1; drift++) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step + drift));
    const digest = createHmac("sha1", key).update(counter).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    const candidate = Buffer.from(String(binary).padStart(6, "0"));
    if (candidate.length === expectedInput.length && timingSafeEqual(candidate, expectedInput)) return true;
  }
  return false;
}
export async function setAdminSession(sessionStart?: number) {
  const now = Math.floor(Date.now() / 1000);
  (await cookies()).set(ADMIN_COOKIE, await signToken({ admin: true, la: now, sa: sessionStart ?? now }, ADMIN_MAX_AGE), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: ADMIN_MAX_AGE,
    domain: siteCookieDomain(),
    secure: process.env.NODE_ENV === "production" && (process.env.SITE_URL ?? "").startsWith("https"),
  });
}
export async function clearAdminSession(): Promise<string[]> {
  return expireCookie(ADMIN_COOKIE);
}
export async function isAdmin(): Promise<boolean> {
  const tok = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!tok) return false;
  const p = await verifyToken(tok);
  if (p?.admin !== true) return false;
  const now = Math.floor(Date.now() / 1000);
  const la = Number(p.la ?? p.iat ?? 0);
  const sa = Number(p.sa ?? p.iat ?? 0);
  // Idle timeout (auto-logout) + absolute cap.
  if (la && now - la > ADMIN_IDLE_MAX) return false;
  if (sa && now - sa > ADMIN_MAX_AGE) return false;
  // Sliding refresh: keep the active admin logged in. cookies().set() is only
  // legal in route handlers / server actions — isAdmin is only called there,
  // but guard anyway so a render-context call can't crash.
  if (la && now - la > REFRESH_AFTER) {
    try { await setAdminSession(sa || now); } catch {}
  }
  return true;
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const tok = jar.get(COOKIE)?.value;
  if (!tok) return null;
  const p = await verifyToken(tok);
  if (!p?.uid) return null;
  // Auto-logout: idle timeout + absolute cap (see IDLE_MAX above).
  const nowSec = Math.floor(Date.now() / 1000);
  const la = Number(p.la ?? p.iat ?? 0);
  const sa = Number(p.sa ?? p.iat ?? 0);
  if (la && nowSec - la > IDLE_MAX) return null;
  if (sa && nowSec - sa > MAX_AGE) return null;
  if (env.localDevMode) {
    const u = await getDevUserById(String(p.uid));
    if (!u) return null;
    const premium = !!u.premiumUntil && new Date(u.premiumUntil) > new Date();
    return { id: u.id, email: u.email, premium, premiumUntil: u.premiumUntil, emailVerified: !!u.emailVerifiedAt, premiumSource: u.premiumSource ?? null };
  }
  // The revoked-session lookup rides along in the query currentUser already
  // makes, so server-side logout costs no additional round trip per request.
  const sid = typeof p.sid === "string" ? p.sid : "";
  const rows = await q<{ id: string; email: string; premium_until: string | null; email_verified_at: string | null; premium_source: string | null; auth_version: number; revoked: boolean; is_banned: boolean }>(
    `select u.id, u.email, u.premium_until, u.email_verified_at, u.premium_source, u.auth_version,
            u.is_banned,
            exists(select 1 from revoked_sessions r where r.session_id=$2) as revoked
     from users u where u.id=$1`,
    [p.uid, sid],
  );
  const u = rows[0];
  if (!u) return null;
  // Hard ban (migration 067): the session is dead immediately — no data
  // leaks, no actions run, one request after the ban lands.
  if (u.is_banned) return null;
  if (Number(p.av ?? -1) !== u.auth_version) return null;
  if (u.revoked) return null;
  // Refresh only after the database-backed revocation check succeeds.
  if (la && nowSec - la > REFRESH_AFTER) {
    try { await setSession(u.id, u.email, sa || nowSec, u.auth_version, sid || undefined); } catch {}
  }
  const premium = !!u.premium_until && new Date(u.premium_until) > new Date();
  return { id: u.id, email: u.email, premium, premiumUntil: u.premium_until, emailVerified: !!u.email_verified_at, premiumSource: u.premium_source };
}

// Stable, non-reversible binding for short-lived delegated OAuth transactions.
// The opaque session cookie itself never leaves this module or enters the DB.
export async function currentSessionBinding(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !(await verifyToken(token))?.uid) return null;
  return createHmac("sha256", SECRET).update("rolesharp-mail-session-v1\0").update(token).digest("hex");
}

export async function setDeletionReauth(userId: string) {
  (await cookies()).set(DELETE_REAUTH_COOKIE, await signToken({ purpose: "account_delete", uid: userId }, 10 * 60), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 10 * 60,
    secure: process.env.NODE_ENV === "production" && (process.env.SITE_URL ?? "").startsWith("https"),
  });
}

export async function consumeDeletionReauth(userId: string): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(DELETE_REAUTH_COOKIE)?.value;
  jar.delete(DELETE_REAUTH_COOKIE);
  if (!value) return false;
  const payload = await verifyToken(value);
  return payload?.purpose === "account_delete" && payload.uid === userId;
}
