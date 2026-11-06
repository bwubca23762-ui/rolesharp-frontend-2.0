import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { q, withTransaction } from "./db";
import { env } from "./env";
import { siteCookieDomain } from "./cookies";

const STAFF_COOKIE = "rai_staff";
const STAFF_OAUTH_BINDING_COOKIE = "rai_staff_oauth_binding";
const STAFF_OAUTH_CALLBACK_PATH = "/api/admin/auth/google/callback";
const STAFF_IDLE_SECONDS = env.adminIdleMinutes * 60;
const STAFF_ABSOLUTE_SECONDS = 8 * 60 * 60;
const STAFF_OAUTH_SECONDS = 10 * 60;

export const STAFF_PERMISSION_KEYS = [
  "admin.access", "analytics.read", "analytics.export", "users.read", "users.manage",
  "staff.read", "staff.manage", "access.read", "access.manage", "legal.read", "legal.edit",
  "legal.publish", "offers.read", "offers.edit", "offers.publish", "notifications.read",
  "notifications.edit", "notifications.publish", "communications.read", "communications.edit",
  "communications.publish", "payments.read", "payments.manage", "support.read", "support.manage",
  "content.read", "content.edit", "content.publish", "jobs.read", "jobs.manage", "mail.read",
  "mail.manage",
  "system.read", "system.manage", "security.read", "security.manage", "flags.manage",
  "break_glass.manage",
] as const;

export type StaffPermission = (typeof STAFF_PERMISSION_KEYS)[number];
export type StaffAuthenticationMethod = "google" | "break_glass";

export type StaffPrincipal = Readonly<{
  staffAccountId: string | null;
  sessionId: string | null;
  email: string | null;
  displayName: string | null;
  roles: readonly string[];
  permissions: ReadonlySet<string>;
  authenticationMethod: StaffAuthenticationMethod;
  breakGlass: boolean;
}>;

type StaffSessionRow = {
  session_id: string;
  staff_account_id: string;
  email: string;
  display_name: string | null;
  authentication_method: StaffAuthenticationMethod;
  auth_version: number;
  account_auth_version: number;
  absolute_expires_at: string;
  idle_expires_at: string;
  roles: string[] | null;
  permissions: string[] | null;
};

type StaffOAuthTransactionRow = {
  id: string;
  nonce_hash: string;
  return_path: string;
};

type GoogleStaffIdentity = Readonly<{
  subject: string;
  email: string;
  displayName: string | null;
}>;

function digestToken(token: string): string {
  return createHash("sha256").update(`rolesharp-staff-session-v1\0${token}`, "utf8").digest("hex");
}

function digestOAuthValue(purpose: "state" | "nonce" | "binding", value: string): string {
  return createHash("sha256").update(`rolesharp-staff-oauth-${purpose}-v1\0${value}`, "utf8").digest("hex");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function secureCookie(): boolean {
  return process.env.NODE_ENV === "production" && env.siteUrl.startsWith("https://");
}

export function staffGoogleRedirectUri(): string {
  return new URL(STAFF_OAUTH_CALLBACK_PATH, env.siteUrl).toString();
}

export async function beginStaffOAuth(returnPathInput: string | null | undefined): Promise<{
  state: string;
  nonce: string;
  binding: string;
}> {
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const binding = randomBytes(32).toString("base64url");
  await q(
    `insert into staff_oauth_transactions
       (state_hash,nonce_hash,browser_binding_hash,return_path,expires_at)
     values ($1,$2,$3,$4,now()+($5||' seconds')::interval)`,
    [
      digestOAuthValue("state", state),
      digestOAuthValue("nonce", nonce),
      digestOAuthValue("binding", binding),
      safeStaffReturnPath(returnPathInput),
      STAFF_OAUTH_SECONDS,
    ],
  );
  (await cookies()).set(STAFF_OAUTH_BINDING_COOKIE, binding, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: STAFF_OAUTH_CALLBACK_PATH,
    maxAge: STAFF_OAUTH_SECONDS,
  });
  return { state, nonce, binding };
}

export async function consumeStaffOAuth(state: string, nonce: string): Promise<{
  transactionId: string;
  returnPath: string;
}> {
  const jar = await cookies();
  const binding = jar.get(STAFF_OAUTH_BINDING_COOKIE)?.value ?? "";
  jar.delete({ name: STAFF_OAUTH_BINDING_COOKIE, path: STAFF_OAUTH_CALLBACK_PATH });
  if (!state || !nonce || !binding) throw new Error("staff_oauth_transaction_invalid");
  return withTransaction(async (query) => {
    const row = (await query<StaffOAuthTransactionRow>(
      `select id,nonce_hash,return_path from staff_oauth_transactions
       where state_hash=$1 and browser_binding_hash=$2 and status='pending'
         and expires_at>now()
       for update`,
      [digestOAuthValue("state", state), digestOAuthValue("binding", binding)],
    ))[0];
    if (!row || !constantTimeStringEqual(row.nonce_hash, digestOAuthValue("nonce", nonce))) {
      throw new Error("staff_oauth_transaction_invalid");
    }
    const consumed = await query<{ id: string }>(
      `update staff_oauth_transactions set status='consumed',consumed_at=now()
       where id=$1 and status='pending' returning id`,
      [row.id],
    );
    if (!consumed[0]) throw new Error("staff_oauth_transaction_replayed");
    return { transactionId: row.id, returnPath: safeStaffReturnPath(row.return_path) };
  });
}

export async function activateGoogleStaff(identityInput: GoogleStaffIdentity): Promise<string> {
  const identity = {
    subject: identityInput.subject.trim(),
    email: normalizeEmail(identityInput.email),
    displayName: identityInput.displayName?.trim().slice(0, 160) || null,
  };
  if (!identity.subject || !identity.email) throw new Error("staff_identity_invalid");
  if (env.staffAllowedDomain && identity.email.split("@")[1] !== env.staffAllowedDomain) {
    await recordStaffLoginEvent(identity.email, "denied", "staff_domain_denied");
    throw new Error("staff_access_denied");
  }
  return withTransaction(async (query) => {
    let account = (await query<{ id: string; status: string; google_subject: string | null }>(
      "select id,status,google_subject from staff_accounts where email=$1 for update",
      [identity.email],
    ))[0];
    if (!account && identity.email === env.staffOwnerEmail) {
      account = (await query<{ id: string; status: string; google_subject: string | null }>(
        `insert into staff_accounts
           (email,google_subject,display_name,status,activated_at)
         values ($1,$2,$3,'active',now()) returning id,status,google_subject`,
        [identity.email, identity.subject, identity.displayName],
      ))[0];
      if (!account) throw new Error("staff_owner_bootstrap_failed");
      await query(
        `insert into staff_role_assignments (staff_account_id,role_key,assigned_by,reason)
         values ($1,'owner',$1,'configured_owner_bootstrap') on conflict do nothing`,
        [account.id],
      );
    }
    if (!account) throw new Error("staff_not_preapproved");
    if (account.status === "suspended" || account.status === "revoked") {
      throw new Error(`staff_${account.status}`);
    }
    if (account.google_subject && !constantTimeStringEqual(account.google_subject, identity.subject)) {
      throw new Error("staff_subject_mismatch");
    }
    const activated = (await query<{ id: string }>(
      `update staff_accounts set
         google_subject=coalesce(google_subject,$2),display_name=coalesce($3,display_name),
         status='active',activated_at=coalesce(activated_at,now()),updated_at=now()
       where id=$1 and status in ('invited','active') returning id`,
      [account.id, identity.subject, identity.displayName],
    ))[0];
    if (!activated) throw new Error("staff_access_denied");
    return activated.id;
  });
}

export async function recordStaffLoginEvent(
  email: string | null,
  outcome: "denied" | "failed" | "revoked",
  reasonCode: string,
): Promise<void> {
  await q(
    `insert into staff_login_events
       (normalized_email,authentication_method,outcome,reason_code)
     values ($1,'google',$2,$3)`,
    [email ? normalizeEmail(email) : null, outcome, reasonCode],
  ).catch(() => {});
}

export async function createStaffSession(
  staffAccountId: string,
  authenticationMethod: StaffAuthenticationMethod = "google",
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = digestToken(token);
  const row = await withTransaction(async (query) => {
    const account = (await query<{ auth_version: number; email: string }>(
      "select auth_version,email from staff_accounts where id=$1 and status='active' for update",
      [staffAccountId],
    ))[0];
    if (!account) throw new Error("staff_account_unavailable");
    const session = (await query<{ id: string }>(
      `insert into staff_sessions
         (staff_account_id,token_hash,auth_version,authentication_method,idle_expires_at,absolute_expires_at)
       values ($1,$2,$3,$4,now()+($5||' seconds')::interval,now()+($6||' seconds')::interval)
       returning id`,
      [staffAccountId, tokenHash, account.auth_version, authenticationMethod, STAFF_IDLE_SECONDS, STAFF_ABSOLUTE_SECONDS],
    ))[0];
    await query("update staff_accounts set last_login_at=now(),updated_at=now() where id=$1", [staffAccountId]);
    await query(
      `insert into staff_login_events
         (staff_account_id,normalized_email,authentication_method,outcome,reason_code)
       values ($1,$2,$3,'succeeded','login_succeeded')`,
      [staffAccountId, account.email, authenticationMethod],
    );
    return session;
  });
  if (!row) throw new Error("staff_session_not_created");
  (await cookies()).set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: STAFF_ABSOLUTE_SECONDS,
    domain: siteCookieDomain(),
  });
}

async function staffSessionFromCookie(): Promise<StaffPrincipal | null> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const rows = await q<StaffSessionRow>(
    `select s.id session_id,s.staff_account_id,a.email,a.display_name,s.authentication_method,
       s.auth_version,a.auth_version account_auth_version,s.absolute_expires_at,s.idle_expires_at,
       coalesce(array_agg(distinct ra.role_key) filter (where ra.role_key is not null),'{}') roles,
       coalesce(array_agg(distinct rp.permission_key) filter (where rp.permission_key is not null),'{}') permissions
     from staff_sessions s
     join staff_accounts a on a.id=s.staff_account_id
     left join staff_role_assignments ra on ra.staff_account_id=a.id and ra.revoked_at is null
     left join staff_role_permissions rp on rp.role_key=ra.role_key
     where s.token_hash=$1 and s.revoked_at is null and a.status='active'
       and s.idle_expires_at>now() and s.absolute_expires_at>now()
     group by s.id,s.staff_account_id,a.email,a.display_name,s.authentication_method,
       s.auth_version,a.auth_version,s.absolute_expires_at,s.idle_expires_at`,
    [digestToken(token)],
  );
  const row = rows[0];
  if (!row || row.auth_version !== row.account_auth_version) return null;
  await q(
    `update staff_sessions set last_seen_at=now(),idle_expires_at=least(
       absolute_expires_at,now()+($2||' seconds')::interval
     ) where id=$1 and last_seen_at<now()-interval '5 minutes'`,
    [row.session_id, STAFF_IDLE_SECONDS],
  ).catch(() => {});
  return {
    staffAccountId: row.staff_account_id,
    sessionId: row.session_id,
    email: row.email,
    displayName: row.display_name,
    roles: row.roles ?? [],
    permissions: new Set(row.permissions ?? []),
    authenticationMethod: row.authentication_method,
    breakGlass: row.authentication_method === "break_glass",
  };
}

const STAFF_RETURN_PATH_RULES: ReadonlyArray<{
  path: string;
  permissions: readonly StaffPermission[];
}> = [
  { path: "/admin/internship-reports", permissions: ["support.read"] },
  { path: "/admin/pricing-config", permissions: ["payments.read"] },
  { path: "/admin/analytics", permissions: ["analytics.read"] },
  { path: "/admin/workflows", permissions: ["jobs.read"] },
  { path: "/admin/payments", permissions: ["payments.read", "analytics.read"] },
  { path: "/admin/resumes", permissions: ["users.read", "analytics.read"] },
  { path: "/admin/students", permissions: ["offers.read"] },
  { path: "/admin/support", permissions: ["support.read"] },
  { path: "/admin/actions", permissions: ["security.read"] },
  { path: "/admin/settings", permissions: ["system.read"] },
  { path: "/admin/system", permissions: ["system.read", "analytics.read"] },
  { path: "/admin/users", permissions: ["users.read"] },
  { path: "/admin/jobs", permissions: ["jobs.read"] },
  { path: "/admin/blog", permissions: ["content.read"] },
  { path: "/admin/emails", permissions: ["communications.read"] },
  { path: "/admin/flags", permissions: ["flags.manage"] },
  { path: "/admin/staff", permissions: ["staff.read"] },
  { path: "/admin/customer-care", permissions: ["support.read"] },
  { path: "/admin/feature-access", permissions: ["access.read"] },
  { path: "/admin/campaigns", permissions: ["jobs.read"] },
  { path: "/admin/auto-mail", permissions: ["jobs.read"] },
  { path: "/admin/offers", permissions: ["offers.read"] },
  { path: "/admin/notifications", permissions: ["notifications.read"] },
  { path: "/admin/communications", permissions: ["communications.read"] },
  { path: "/admin/mail-connections", permissions: ["mail.read"] },
  { path: "/admin/legal", permissions: ["legal.read"] },
  { path: "/admin", permissions: ["analytics.read"] },
];

export async function resolveStaffReturnPath(staffAccountId: string, requestedPath: string): Promise<string> {
  const rows = await q<{ permission_key: StaffPermission }>(
    `select distinct rp.permission_key from staff_role_assignments ra
     join staff_role_permissions rp on rp.role_key=ra.role_key
     where ra.staff_account_id=$1 and ra.revoked_at is null`,
    [staffAccountId],
  );
  const permissions = new Set(rows.map((row) => row.permission_key));
  const requested = safeStaffReturnPath(requestedPath);
  const requestedRule = STAFF_RETURN_PATH_RULES.find((rule) =>
    rule.path === "/admin" ? requested === rule.path : requested === rule.path || requested.startsWith(`${rule.path}/`),
  );
  if (requestedRule?.permissions.every((permission) => permissions.has(permission))) return requested;
  return STAFF_RETURN_PATH_RULES.find((rule) => rule.permissions.every((permission) => permissions.has(permission)))?.path ?? "/admin";
}

export async function currentStaff(): Promise<StaffPrincipal | null> {
  const session = await staffSessionFromCookie();
  if (session) return session;
  return null;
}

export async function requireStaffPermission(permission: StaffPermission): Promise<StaffPrincipal> {
  const staff = await currentStaff();
  if (!staff || !staff.permissions.has(permission)) throw new StaffAuthorizationError(permission);
  return staff;
}

export async function revokeCurrentStaffSession(reason = "staff_logout"): Promise<boolean> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return false;
  const result = await q<{ id: string }>(
    `update staff_sessions set revoked_at=now(),revocation_reason=$2
     where token_hash=$1 and revoked_at is null returning id`,
    [digestToken(token), reason],
  );
  return result.length > 0;
}

export async function clearStaffCookie(): Promise<string[]> {
  const base = `${STAFF_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  const domain = siteCookieDomain();
  return domain ? [base, `${base}; Domain=${domain}`] : [base];
}

export function safeStaffReturnPath(value: string | null | undefined): string {
  if (!value || value.length > 500 || !value.startsWith("/admin") || value.startsWith("//") || /[\r\n\\]/u.test(value)) {
    return "/admin";
  }
  return value;
}

export function constantTimeStringEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class StaffAuthorizationError extends Error {
  readonly name = "StaffAuthorizationError";
  constructor(readonly permission: StaffPermission) {
    super("staff_permission_required");
  }
}
