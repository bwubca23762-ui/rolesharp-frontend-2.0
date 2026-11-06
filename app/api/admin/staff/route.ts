import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-authorization";
import { q, withTransaction } from "@/lib/db";
import { env } from "@/lib/env";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ROLE_KEYS = new Set([
  "owner", "admin", "operations", "support", "finance", "content", "analyst", "security_auditor",
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/u;

type StaffCommand =
  | { action: "invite"; email: string; displayName?: string; role: string }
  | { action: "assign_role" | "revoke_role"; staffAccountId: string; role: string; reason?: string }
  | { action: "suspend" | "revoke" | "reactivate" | "revoke_sessions"; staffAccountId: string; reason?: string };

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "staff_management_failed";
  if (code === "staff_permission_required") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (code.endsWith("_not_found")) return NextResponse.json({ error: code }, { status: 404 });
  if (code.startsWith("invalid_") || code.startsWith("owner_")) {
    return NextResponse.json({ error: code }, { status: 400 });
  }
  console.error("staff_management_failed", { error: code });
  return NextResponse.json({ error: "staff_management_failed" }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdminPermission("staff.read");
    const [staff, roles] = await Promise.all([
      q<{
        id: string; email: string; display_name: string | null; status: string; last_login_at: string | null;
        created_at: string; roles: string[]; active_sessions: number;
      }>(`select a.id,a.email,a.display_name,a.status,a.last_login_at,a.created_at,
          coalesce(array_agg(distinct ra.role_key) filter (where ra.role_key is not null),'{}') roles,
          count(distinct s.id)::int active_sessions
        from staff_accounts a
        left join staff_role_assignments ra on ra.staff_account_id=a.id and ra.revoked_at is null
        left join staff_sessions s on s.staff_account_id=a.id and s.revoked_at is null
          and s.auth_version=a.auth_version and s.idle_expires_at>now() and s.absolute_expires_at>now()
        group by a.id order by a.created_at,a.email`),
      q<{ role_key: string; label: string; description: string; owner_only: boolean; permissions: string[] }>(
        `select r.role_key,r.label,r.description,r.owner_only,
          array(select p.permission_key from staff_role_permissions p where p.role_key=r.role_key order by p.permission_key) permissions
         from staff_roles r order by r.owner_only desc,r.label`,
      ),
    ]);
    return NextResponse.json({ staff, roles }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-staff", 30);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }
  try {
    const actor = await requireAdminPermission("staff.manage");
    if (!actor.staffAccountId) throw new Error("owner_staff_session_required");
    const command = await req.json().catch(() => null) as StaffCommand | null;
    if (!command || typeof command.action !== "string") throw new Error("invalid_command");

    const result = await withTransaction(async (query) => {
      if (command.action === "invite") {
        const email = String(command.email ?? "").trim().toLowerCase();
        const displayName = String(command.displayName ?? "").trim().slice(0, 160) || null;
        const role = String(command.role ?? "");
        if (!EMAIL_PATTERN.test(email)) throw new Error("invalid_email");
        if (!ROLE_KEYS.has(role) || role === "owner") throw new Error("invalid_role");
        if (env.staffAllowedDomain && email.split("@")[1] !== env.staffAllowedDomain) {
          throw new Error("invalid_staff_domain");
        }
        const account = (await query<{ id: string }>(
          `insert into staff_accounts (email,display_name,status,invited_by)
           values ($1,$2,'invited',$3)
           on conflict (email) do update set
             display_name=coalesce(excluded.display_name,staff_accounts.display_name),updated_at=now()
           where staff_accounts.status='invited'
           returning id`,
          [email, displayName, actor.staffAccountId],
        ))[0];
        if (!account) throw new Error("staff_invite_conflict");
        await query(
          `insert into staff_role_assignments (staff_account_id,role_key,assigned_by,reason)
           values ($1,$2,$3,'staff_invite') on conflict do nothing`,
          [account.id, role, actor.staffAccountId],
        );
        await query(
          `insert into admin_actions
             (action,target_email,details,staff_account_id,authentication_method)
           values ('staff_invite',$1,$2,$3,$4)`,
          [email, JSON.stringify({ role }), actor.staffAccountId, actor.authenticationMethod],
        );
        return { staffAccountId: account.id };
      }

      const targetId = String(command.staffAccountId ?? "");
      const target = (await query<{ id: string; email: string; status: string }>(
        "select id,email,status from staff_accounts where id=$1 for update",
        [targetId],
      ))[0];
      if (!target) throw new Error("staff_account_not_found");
      if (target.id === actor.staffAccountId && ["suspend", "revoke"].includes(command.action)) {
        throw new Error("owner_self_lockout_denied");
      }
      if (["suspend", "revoke"].includes(command.action)) {
        const owner = (await query<{ is_owner: boolean }>(
          `select exists (select 1 from staff_role_assignments
             where staff_account_id=$1 and role_key='owner' and revoked_at is null) is_owner`,
          [target.id],
        ))[0]?.is_owner === true;
        if (owner) {
          const remaining = (await query<{ count: number }>(
            `select count(distinct a.id)::int count from staff_accounts a
             join staff_role_assignments ra on ra.staff_account_id=a.id
             where a.status='active' and ra.role_key='owner' and ra.revoked_at is null and a.id<>$1`,
            [target.id],
          ))[0]?.count ?? 0;
          if (remaining < 1) throw new Error("owner_last_active_lockout_denied");
        }
      }
      const reason = "reason" in command ? String(command.reason ?? "").trim().slice(0, 500) || null : null;

      if (command.action === "assign_role") {
        if (!ROLE_KEYS.has(command.role) || command.role === "owner") throw new Error("invalid_role");
        await query(
          `insert into staff_role_assignments (staff_account_id,role_key,assigned_by,reason)
           values ($1,$2,$3,$4) on conflict do nothing`,
          [target.id, command.role, actor.staffAccountId, reason],
        );
      } else if (command.action === "revoke_role") {
        if (!ROLE_KEYS.has(command.role) || command.role === "owner") throw new Error("invalid_role");
        const revoked = await query<{ role_key: string }>(
          `update staff_role_assignments set revoked_at=now(),revoked_by=$3,reason=coalesce($4,reason)
           where staff_account_id=$1 and role_key=$2 and revoked_at is null returning role_key`,
          [target.id, command.role, actor.staffAccountId, reason],
        );
        if (!revoked[0]) throw new Error("staff_role_not_found");
      } else if (command.action === "suspend") {
        if (target.status !== "active") throw new Error("invalid_staff_state");
        await query(
          `update staff_accounts set status='suspended',suspended_at=now(),auth_version=auth_version+1,updated_at=now()
           where id=$1`,
          [target.id],
        );
      } else if (command.action === "revoke") {
        if (target.status === "revoked") throw new Error("invalid_staff_state");
        await query(
          `update staff_accounts set status='revoked',revoked_at=now(),suspended_at=null,
             auth_version=auth_version+1,updated_at=now() where id=$1`,
          [target.id],
        );
      } else if (command.action === "reactivate") {
        if (target.status !== "suspended") throw new Error("invalid_staff_state");
        await query(
          `update staff_accounts set status='active',suspended_at=null,updated_at=now() where id=$1`,
          [target.id],
        );
      } else if (command.action === "revoke_sessions") {
        await query(
          `update staff_sessions set revoked_at=now(),revoked_by=$2,
             revocation_reason=coalesce($3,'staff_session_revoked')
           where staff_account_id=$1 and revoked_at is null`,
          [target.id, actor.staffAccountId, reason],
        );
      } else {
        throw new Error("invalid_command");
      }

      if (["suspend", "revoke"].includes(command.action)) {
        await query(
          `update staff_sessions set revoked_at=now(),revoked_by=$2,
             revocation_reason=$3 where staff_account_id=$1 and revoked_at is null`,
          [target.id, actor.staffAccountId, `staff_account_${command.action}`],
        );
      }
      await query(
        `insert into admin_actions
           (action,target_email,details,staff_account_id,authentication_method)
         values ($1,$2,$3,$4,$5)`,
        [
          `staff_${command.action}`,
          target.email,
          JSON.stringify({ targetStaffAccountId: target.id, role: "role" in command ? command.role : null, reason }),
          actor.staffAccountId,
          actor.authenticationMethod,
        ],
      );
      return { staffAccountId: target.id };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
