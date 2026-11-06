import type { ComponentType } from "react";
import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  Grid,
  LifeBuoy,
  Bell,
  Mail,
  Server,
  Settings,
  Shield,
  Sparkles,
  Target,
  Users,
} from "@/app/icons";
import {
  Briefcase as LucideBriefcase,
  Megaphone as LucideMegaphone,
  Settings as LucideSettings,
  Users as LucideUsers,
  LayoutDashboard as LucideLayoutDashboard,
} from "lucide-react";

export type AdminNavigationBadge = "support" | "reports" | "students" | "access";
export type AdminNavigationIcon = ComponentType<{
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;
export type AdminNavigationItem = {
  label: string;
  href: string;
  icon: AdminNavigationIcon;
  group: string;
  permission: string;
  additionalPermissions?: readonly string[];
  alternativePermissions?: readonly string[];
  badge?: AdminNavigationBadge;
};

export interface AdminNavigationGroup {
  label: string;
  /** Accordion header icon (Lucide). */
  icon: AdminNavigationIcon;
  links: readonly AdminNavigationItem[];
}

export const ADMIN_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  {
    label: "Dashboard",
    icon: LucideLayoutDashboard,
    links: [
      { label: "Overview", href: "/admin", icon: Grid, group: "Dashboard", permission: "analytics.read" },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3, group: "Dashboard", permission: "analytics.read" },
    ],
  },
  {
    label: "Users & Access",
    icon: LucideUsers,
    links: [
      { label: "Users", href: "/admin/users", icon: Users, group: "Users & Access", permission: "users.read" },
      { label: "Students", href: "/admin/students", icon: Sparkles, group: "Users & Access", permission: "offers.read", badge: "students" },
      { label: "Staff access", href: "/admin/staff", icon: Users, group: "Users & Access", permission: "staff.read" },
      { label: "Workflow access", href: "/admin/feature-access", icon: Shield, group: "Users & Access", permission: "access.read", badge: "access" },
    ],
  },
  {
    label: "Jobs & Ops",
    icon: LucideBriefcase,
    links: [
      { label: "Job listings", href: "/admin/jobs", icon: Activity, group: "Jobs & Ops", permission: "jobs.read" },
      { label: "Job workflows", href: "/admin/workflows", icon: Server, group: "Jobs & Ops", permission: "jobs.read" },
      { label: "Internship reports", href: "/admin/internship-reports", icon: Shield, group: "Jobs & Ops", permission: "support.read", badge: "reports" },
      { label: "Offers", href: "/admin/offers", icon: Sparkles, group: "Jobs & Ops", permission: "offers.read" },
      { label: "Resumes", href: "/admin/resumes", icon: FileText, group: "Jobs & Ops", permission: "users.read", additionalPermissions: ["analytics.read"] },
    ],
  },
  {
    label: "Marketing & Comms",
    icon: LucideMegaphone,
    links: [
      { label: "Campaigns", href: "/admin/campaigns", icon: Target, group: "Marketing & Comms", permission: "jobs.read" },
      { label: "Auto mail", href: "/admin/auto-mail", icon: Activity, group: "Marketing & Comms", permission: "jobs.read" },
      { label: "Blog", href: "/admin/blog", icon: FileText, group: "Marketing & Comms", permission: "content.read" },
      { label: "Notifications", href: "/admin/notifications", icon: Bell, group: "Marketing & Comms", permission: "notifications.read" },
      { label: "Communications", href: "/admin/communications", icon: Bell, group: "Marketing & Comms", permission: "communications.read" },
      { label: "Email log", href: "/admin/emails", icon: Activity, group: "Marketing & Comms", permission: "communications.read" },
    ],
  },
  {
    label: "Platform & Config",
    icon: LucideSettings,
    links: [
      { label: "Payments", href: "/admin/payments", icon: CreditCard, group: "Platform & Config", permission: "payments.read", additionalPermissions: ["analytics.read"] },
      { label: "Pricing", href: "/admin/pricing-config", icon: Sparkles, group: "Platform & Config", permission: "payments.read" },
      { label: "Feature flags", href: "/admin/flags", icon: Shield, group: "Platform & Config", permission: "flags.manage" },
      { label: "Audit log", href: "/admin/actions", icon: Activity, group: "Platform & Config", permission: "security.read" },
      { label: "Legal documents", href: "/admin/legal", icon: FileText, group: "Platform & Config", permission: "legal.read" },
      { label: "System health", href: "/admin/system", icon: Server, group: "Platform & Config", permission: "system.read", additionalPermissions: ["analytics.read"] },
      { label: "Settings", href: "/admin/settings", icon: Settings, group: "Platform & Config", permission: "system.read" },
      { label: "Mail connections", href: "/admin/mail-connections", icon: Mail, group: "Platform & Config", permission: "mail.read", alternativePermissions: ["communications.read", "mail.manage"] },
      { label: "Care desk", href: "/admin/customer-care", icon: LifeBuoy, group: "Platform & Config", permission: "support.read", additionalPermissions: ["users.read"] },
      { label: "Support", href: "/admin/support", icon: LifeBuoy, group: "Platform & Config", permission: "support.read", alternativePermissions: ["support.manage"], badge: "support" },
    ],
  },
];

export const ADMIN_NAVIGATION_ITEMS = ADMIN_NAVIGATION_GROUPS.flatMap((group) => group.links);

export function adminNavigationGroupsForPermissions(permissions: readonly string[]): AdminNavigationGroup[] {
  const allowed = new Set(permissions);
  return ADMIN_NAVIGATION_GROUPS
    .map((group) => ({
      ...group,
      links: group.links.filter((link) =>
        (allowed.has(link.permission) || (link.alternativePermissions ?? []).some((permission) => allowed.has(permission))) && (link.additionalPermissions ?? []).every((permission) => allowed.has(permission)),
      ),
    }))
    .filter((group) => group.links.length > 0);
}

export function adminNavigationItemsForPermissions(permissions: readonly string[]) {
  return adminNavigationGroupsForPermissions(permissions).flatMap((group) => group.links);
}

/**
 * Permissions a workspace demands, or null when the path is not a registered
 * admin route. Callers must treat null as "deny": returning an empty list here
 * would make an unregistered route readable by every authenticated operator.
 */
export function requiredAdminNavigationPermissions(href: string, granted: readonly string[] = []): readonly string[] | null {
  const item = ADMIN_NAVIGATION_ITEMS.find((candidate) => candidate.href === href);
  if (item?.alternativePermissions?.some((permission) => granted.includes(permission))) return item.additionalPermissions ?? [];
  return item ? [item.permission, ...(item.additionalPermissions ?? [])] : null;
}

export function isAdminNavigationActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

/** The navigation item whose route matches `pathname` (longest prefix wins). */
export function findAdminNavigationItem(pathname: string): AdminNavigationItem | undefined {
  const exact = ADMIN_NAVIGATION_ITEMS.find((candidate) => candidate.href === pathname);
  if (exact) return exact;
  const prefix = ADMIN_NAVIGATION_ITEMS.filter((candidate) => candidate.href !== "/admin" && pathname.startsWith(candidate.href))
    .sort((a, b) => b.href.length - a.href.length);
  return prefix[0];
}

/** The group that contains the item matching `pathname`, if any. */
export function adminGroupForPath(pathname: string): AdminNavigationGroup | undefined {
  const item = findAdminNavigationItem(pathname);
  if (!item) return undefined;
  return ADMIN_NAVIGATION_GROUPS.find((group) => group.links.some((link) => link.href === item.href));
}

/** Breadcrumb trail for a pathname: [Admin, Group?, Item]. */
export function adminBreadcrumbForPath(pathname: string): { group: string | null; label: string } {
  const item = findAdminNavigationItem(pathname);
  if (!item) return { group: null, label: "Admin" };
  const group = adminGroupForPath(pathname);
  return { group: group?.label ?? null, label: item.label };
}
