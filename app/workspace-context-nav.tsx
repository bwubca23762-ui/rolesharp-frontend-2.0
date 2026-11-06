"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  Briefcase,
  CreditCard,
  FileText,
  Globe,
  Grid,
  LifeBuoy,
  Linkedin,
  Shield,
  Sparkles,
  Target,
  User,
} from "./icons";
import RoleSharpMark from "@/components/RoleSharpMark";
import { isNavigationRouteActive, isOperationalWorkspacePath, WORKSPACE_CONTEXT_ROUTES } from "./navigation-registry";
import { useSession } from "./session-context";
import { planLabel } from "@/lib/plan-label";
import { toolWorkspaceForPath } from "@/lib/tool-workspaces";

const RAIL_ICONS: Record<string, (props: { size?: number }) => React.JSX.Element> = {
  "/dashboard": Grid,
  "/daily-matches": Sparkles,
  "/application-queue": FileText,
  "/tracker": Target,
  "/auto-apply": Activity,
  "/email-connection": Shield,
  "/campaign-settings": Target,
  "/settings": User,
  "/billing": CreditCard,
  "/support": LifeBuoy,
};

const STUDIO_TOOL_LINKS = [
  { href: "/build", label: "Resume Studio", icon: Sparkles },
  { href: "/resume-match", label: "Jobs & Fit", icon: Target },
  { href: "/linkedin-checker", label: "LinkedIn", icon: Linkedin },
  { href: "/cover-letter-generator", label: "Letters", icon: FileText },
  { href: "/interview-prep", label: "Interview Practice", icon: Sparkles },
  { href: "/salaries", label: "Salary & Offers", icon: Briefcase },
  // The rail is a working set, not a site map. Less-used diagnostics remain
  // one click away in the tools hub (and are linked from the shared footer),
  // leaving enough vertical room for the signed-in account status.
  { href: "/tools", label: "All career tools", icon: Globe },
] as const;

export default function WorkspaceContextNav() {
  const pathname = usePathname();
  const { session } = useSession();
  const railVisible = Boolean(session?.loggedIn && isOperationalWorkspacePath(pathname));

  useEffect(() => {
    if (railVisible) {
      document.documentElement.dataset.wsRail = "true";
      return () => {
        delete document.documentElement.dataset.wsRail;
      };
    }
  }, [railVisible]);

  if (!railVisible) return null;

  const remaining = session?.remaining ?? 0;
  const limit = session?.limit ?? 1;
  const credits = session?.credits ?? 0;

  return (
    <nav
      aria-label="RoleSharp workspace"
      className="rs-ws-rail hidden lg:flex fixed left-0 top-0 z-40 h-dvh w-[248px] flex-col justify-between overflow-y-auto border-r border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)]/95 backdrop-blur-2xl px-3 py-4"
    >
      <div className="space-y-4">
        {/* Top Brand & Primary Quick-Launch Actions */}
        <div className="px-1">
          <a
            href="/dashboard"
            className="flex items-center justify-between rounded-xl px-2 py-1.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <span className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-extrabold tracking-tight text-[var(--fg)]">
              <RoleSharpMark size={26} />
              <span>
                Role<span className="text-[#0066CC] dark:text-[#5AC8FA]">Sharp</span>
              </span>
            </span>
            <span className="rounded-full border border-[#0071E3]/25 bg-[#0071E3]/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-wider text-[#0066CC] dark:text-[#5AC8FA]">
              Workspace
            </span>
          </a>

          <div className="mt-3 grid gap-1.5">
            <a
              href="/build"
              className="desk-button w-full justify-center text-sm"
            >
              New tailored resume
            </a>
          </div>
        </div>

        {/* Section 1: Workspace Operations */}
        <div>
          <p className="px-2.5 pb-1.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-fg)]">
            Workspace &amp; Pipeline
          </p>
          <div className="space-y-0.5">
            {WORKSPACE_CONTEXT_ROUTES.map((route) => {
              const active = isNavigationRouteActive(pathname, route.href, "activePaths" in route ? route.activePaths : undefined);
              const Icon = RAIL_ICONS[route.href] ?? Grid;
              return (
                <a
                  key={route.href}
                  href={route.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-9 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all ${
                    active
                      ? "bg-[#0071E3]/12 text-[#0066CC] dark:bg-[#0A84FF]/20 dark:text-[#5AC8FA] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                      : "text-[var(--muted-fg)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-[var(--fg)]"
                  }`}
                >
                  <Icon size={16} />
                  <span className="truncate">{"shortLabel" in route ? route.shortLabel : route.label}</span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Section 2: AI Career Studio & Free Tools */}
        <div className="border-t border-[var(--hairline)] pt-3">
          <p className="px-2.5 pb-1.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-fg)]">
            AI Studio &amp; Career Tools
          </p>
          <div className="space-y-0.5">
            {STUDIO_TOOL_LINKS.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/tools" ? pathname === "/tools" : toolWorkspaceForPath(pathname)?.href === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-8 items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-medium transition-all ${
                    active
                      ? "bg-[#0071E3]/12 font-semibold text-[#0066CC] dark:bg-[#0A84FF]/20 dark:text-[#5AC8FA]"
                      : "text-[var(--muted-fg)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-[var(--fg)]"
                  }`}
                >
                  <span className="inline-flex min-w-0 items-center gap-2.5 truncate">
                    <Icon size={15} />
                    <span className="truncate">{item.label}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pinned Account Status & Allowance Card at Bottom of Sidebar */}
      <div className="mt-4 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface-2)] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-bold text-[var(--fg)]">
            {session ? planLabel(session) : "Member"}
          </span>
          <a
            href="/settings?tab=billing"
            className="rounded-full bg-[#0071E3]/12 px-2 py-0.5 text-[10px] font-bold text-[#0066CC] dark:text-[#5AC8FA] hover:underline"
          >
            {session?.premium ? "Manage" : "Upgrade →"}
          </a>
        </div>
        {session?.email && (
          <p className="mt-0.5 truncate text-[11px] text-[var(--muted-fg)]">{session.email}</p>
        )}
        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted-fg)]">
          <span>Builds: <strong className="text-[var(--fg)]">{remaining}/{limit}</strong></span>
          <span>Credits: <strong className="text-[var(--fg)]">{credits}</strong></span>
        </div>
      </div>
    </nav>
  );
}
