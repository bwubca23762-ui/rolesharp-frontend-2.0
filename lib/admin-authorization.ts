import { isAdmin } from "./auth";
import {
  currentStaff,
  STAFF_PERMISSION_KEYS,
  StaffAuthorizationError,
  type StaffPermission,
  type StaffPrincipal,
} from "./staff-auth";

const BREAK_GLASS_PERMISSIONS = new Set<string>(STAFF_PERMISSION_KEYS);
const BREAK_GLASS_PRINCIPAL: StaffPrincipal = Object.freeze({
  staffAccountId: null,
  sessionId: null,
  email: null,
  displayName: "Break-glass administrator",
  roles: Object.freeze(["owner"]),
  permissions: BREAK_GLASS_PERMISSIONS,
  authenticationMethod: "break_glass",
  breakGlass: true,
});

export async function currentAdminPrincipal(): Promise<StaffPrincipal | null> {
  const staff = await currentStaff();
  if (staff) return staff;
  if (await isAdmin()) return BREAK_GLASS_PRINCIPAL;
  return null;
}

export async function hasAdminPermission(permission: StaffPermission): Promise<boolean> {
  const principal = await currentAdminPrincipal();
  return principal?.permissions.has(permission) === true;
}

export async function requireAdminPermission(permission: StaffPermission): Promise<StaffPrincipal> {
  const principal = await currentAdminPrincipal();
  if (!principal || !principal.permissions.has(permission)) throw new StaffAuthorizationError(permission);
  return principal;
}
