import { q } from "./db";
import { currentAdminPrincipal } from "./admin-authorization";
import type { StaffPrincipal } from "./staff-auth";

type AdminAuditEntry = {
  targetUserId?: string | null;
  targetEmail?: string | null;
  details?: Record<string, unknown> | null;
  actor?: StaffPrincipal | null;
};

/**
 * Best-effort audit recording for operator actions that cannot share a database
 * transaction (for example, Cloudflare, IndexNow, or a filesystem backup).
 * Never include credentials, message bodies, tokens, or other secrets here.
 */
export async function recordAdminAction(action: string, entry: AdminAuditEntry = {}): Promise<boolean> {
  try {
    const actor = entry.actor === undefined ? await currentAdminPrincipal() : entry.actor;
    const details = {
      ...(entry.details ?? {}),
      ...(actor ? {
        actorAuthenticationMethod: actor.authenticationMethod,
        actorStaffAccountId: actor.staffAccountId,
      } : {}),
    };
    await q(
      `insert into admin_actions
         (action, target_user_id, target_email, details, staff_account_id, authentication_method)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        action,
        entry.targetUserId ?? null,
        entry.targetEmail ?? null,
        Object.keys(details).length ? JSON.stringify(details) : null,
        actor?.staffAccountId ?? null,
        actor?.authenticationMethod ?? null,
      ],
    );
    return true;
  } catch (error) {
    console.error("admin audit record failed", {
      action,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return false;
  }
}
