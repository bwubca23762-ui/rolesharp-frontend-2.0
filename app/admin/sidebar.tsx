"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/ui/primitives";
import { ArrowUpRight, ChevronDown, Star } from "lucide-react";
import {
  ChevronRight,
  LogOut,
  Menu,
  Shield,
  X,
} from "@/app/icons";
import { adminNavigationGroupsForPermissions, isAdminNavigationActive } from "./navigation";

export type AdminSidebarStatus = {
  environmentLabel: string;
  isProduction: boolean;
  monitored: boolean;
};

export default function AdminSidebar({
  openTickets = 0,
  pendingReports = 0,
  pendingStudents = 0,
  pendingAccessRequests = 0,
  status = { environmentLabel: "Unknown environment", isProduction: false, monitored: false },
  permissions = [],
  principal,
}: {
  openTickets?: number;
  pendingReports?: number;
  pendingStudents?: number;
  pendingAccessRequests?: number;
  status?: AdminSidebarStatus;
  permissions?: readonly string[];
  principal?: {
    email: string | null;
    displayName: string | null;
    roles: readonly string[];
    breakGlass: boolean;
  };
}) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  // Icon-rail mode (76px) — persisted. The documentElement flag lets the
  // layout grid react without prop drilling through admin-panel.
  const [railPreference, setRailPreference] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const rail = desktop && railPreference;
  const menuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = matchMedia("(min-width: 981px)");
    const update = () => {
      setDesktop(media.matches);
      if (media.matches) setMobileOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    try {
      if (localStorage.getItem("rs-admin-sidebar-rail") === "1") setRailPreference(true);
    } catch { /* storage unavailable — defaults hold */ }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.adminRail = rail ? "1" : "0";
    return () => { delete document.documentElement.dataset.adminRail; };
  }, [rail]);
  function toggleRail() {
    setRailPreference((value) => {
      try { localStorage.setItem("rs-admin-sidebar-rail", value ? "0" : "1"); } catch { /* storage unavailable — defaults hold */ }
      return !value;
    });
  }
  // Quick-filter: filters every group's links by name or route.
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  // Pinned favorites: up to 4 daily views, persisted.
  const [pinned, setPinned] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("rs-admin-pinned-v1") || "[]") as string[];
      if (Array.isArray(saved)) setPinned(saved.filter((x) => typeof x === "string").slice(0, 4));
    } catch { /* storage unavailable — defaults hold */ }
  }, []);
  function togglePin(href: string) {
    setPinned((prev) => {
      const next = prev.includes(href) ? prev.filter((x) => x !== href) : [...prev, href].slice(0, 4);
      try { localStorage.setItem("rs-admin-pinned-v1", JSON.stringify(next)); } catch { /* storage unavailable — defaults hold */ }
      return next;
    });
  }
  // Accordion state: a group is open unless explicitly collapsed, so on first
  // paint every section (and every badge) is visible. Collapsing is opt-in.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const navigationGroups = adminNavigationGroupsForPermissions(permissions);
  const homeHref = navigationGroups[0]?.links[0]?.href ?? "/admin";
  const canReadSystem = permissions.includes("system.read");

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const items = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input") ?? [])
        .filter((item) => item.getClientRects().length);
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const trigger = menuRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [mobileOpen]);

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Sign out failed. Try again.");
      window.location.href = "/admin";
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Sign out failed. Try again.");
      setLoggingOut(false);
    }
  }

  const current = navigationGroups.flatMap((group) => group.links).find((link) => isAdminNavigationActive(pathname, link.href));
  const toggleGroup = (label: string, isOpen: boolean) => setCollapsed((prev) => ({ ...prev, [label]: isOpen }));

  return (
    <>
      <header className="admin-mobile-topbar lg:hidden">
        <button type="button" ref={menuRef} className="admin-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open admin navigation" aria-expanded={mobileOpen} aria-controls="admin-navigation">
          <Menu size={21} />
        </button>
        <div className="admin-mobile-title">
          <span>RoleSharp Admin</span>
          <small>{current?.label || "Overview"}</small>
        </div>
        <span className="admin-mobile-environment">{status.environmentLabel}</span>
      </header>

      {mobileOpen && <div className="admin-sidebar-backdrop" aria-hidden onClick={() => setMobileOpen(false)} />}

      <aside ref={drawerRef} id="admin-navigation" className={`admin-pro-sidebar${mobileOpen ? " is-open" : ""}${rail ? " is-rail" : ""}`} aria-label="Admin navigation" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined}>
        <div className="admin-sidebar-brand-row">
          <Link href={homeHref} className="admin-pro-brand">
            <span className="admin-pro-brandmark"><Shield size={19} aria-hidden /></span>
            <span><b>RoleSharp</b><small>Admin console</small></span>
          </Link>
          <button type="button" className="admin-sidebar-collapse" onClick={toggleRail} aria-label={rail ? "Expand sidebar" : "Collapse to icon rail"} title={rail ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronRight size={16} className={rail ? "" : "rotate-180"} />
          </button>
          <button type="button" ref={closeRef} className="admin-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close admin navigation"><X size={20} /></button>
        </div>

        {!rail && (
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter workspaces…"
            aria-label="Filter admin workspaces"
            className="admin-sidebar-filter mx-3 mb-2 w-[calc(100%-24px)] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        )}

        {!rail && pinned.length > 0 && (
          <div className="admin-pinned-strip mx-3 mb-2 rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
            <p className="admin-pinned-label">Pinned</p>
            <div className="flex flex-col gap-0.5">
              {pinned.map((href) => {
                const link = navigationGroups.flatMap((g) => g.links).find((l) => l.href === href);
                if (!link) return null;
                const Icon = link.icon;
                const active = isAdminNavigationActive(pathname, href);
                return (
                  <Link key={href} href={href} className={`admin-pro-navlink${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
                    <Icon size={16} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="admin-environment-card">
          <span className={`admin-live-dot${status.monitored ? "" : " is-warning"}`} aria-hidden />
          <span>
            <b>{status.environmentLabel}</b>
            <small>{status.monitored ? "Navigation signals available" : "Monitoring is partially unavailable"}</small>
          </span>
          {canReadSystem && <Link href="/admin/system" aria-label="View system health"><ChevronRight size={16} /></Link>}
        </div>

        <nav className="admin-pro-nav" aria-label="Workspaces">
          {q && !navigationGroups.some((group) => group.links.some((link) => link.label.toLowerCase().includes(q) || link.href.toLowerCase().includes(q))) && (
            <p className="admin-sidebar-empty" role="status">No workspaces match this filter.</p>
          )}
          {navigationGroups.map((group) => {
            const groupLinks = group.links.filter((link) => !q || link.label.toLowerCase().includes(q) || link.href.toLowerCase().includes(q));
            if (q && groupLinks.length === 0) return null;
            const isOpen = q ? true : !collapsed[group.label];
            const groupId = `admin-group-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            const GroupIcon = group.icon;
            return (
              <div className="admin-nav-group" key={group.label}>
                <button
                  type="button"
                  className="admin-group-trigger"
                  aria-label={group.label}
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? groupId : undefined}
                  onClick={() => toggleGroup(group.label, isOpen)}
                >
                  <GroupIcon size={15} aria-hidden className="shrink-0" />
                  <span className="truncate">{group.label}</span>
                  <ChevronDown
                    size={14}
                    aria-hidden
                    className={cn("ml-auto shrink-0 transition-transform duration-200", isOpen ? "rotate-0" : "-rotate-90")}
                  />
                </button>
                {isOpen && (
                  <ul id={groupId} className="admin-group-links">
                    {groupLinks.map((link) => {
                      const Icon = link.icon;
                      const active = isAdminNavigationActive(pathname, link.href);
                      return (
                        <li key={link.href} className="admin-nav-entry">
                          <Link href={link.href} className={`admin-pro-navlink${active ? " active" : ""}`} aria-current={active ? "page" : undefined} aria-label={rail ? link.label : undefined} title={rail ? link.label : undefined}>
                            <Icon size={17} aria-hidden />
                            <span>{link.label}</span>
                            {link.badge === "support" && openTickets > 0 && <strong>{openTickets > 99 ? "99+" : openTickets}</strong>}
                            {link.badge === "reports" && pendingReports > 0 && <strong>{pendingReports > 99 ? "99+" : pendingReports}</strong>}
                            {link.badge === "students" && pendingStudents > 0 && <strong>{pendingStudents > 99 ? "99+" : pendingStudents}</strong>}
                            {link.badge === "access" && pendingAccessRequests > 0 && <strong>{pendingAccessRequests > 99 ? "99+" : pendingAccessRequests}</strong>}
                          </Link>
                          {!rail && (
                            <button
                              type="button"
                              className="admin-pin-btn"
                              aria-label={pinned.includes(link.href) ? `Unpin ${link.label}` : `Pin ${link.label}`}
                              aria-pressed={pinned.includes(link.href)}
                              onClick={() => togglePin(link.href)}
                              disabled={pinned.length >= 4 && !pinned.includes(link.href)}
                            >
                              <Star size={15} aria-hidden />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="admin-pro-footer">
          <div className="admin-operator">
            <span>{(principal?.displayName || principal?.email || "S").slice(0, 1).toUpperCase()}</span>
            <div>
              <b>{principal?.displayName || principal?.email || "Staff operator"}</b>
              <small>{principal?.breakGlass ? "Break-glass recovery access" : principal?.roles.join(", ") || "Permission-scoped access"}</small>
            </div>
          </div>
          <button type="button" className="admin-pro-signout" onClick={logout} disabled={loggingOut}>
            <LogOut size={16} /> {loggingOut ? "Signing out..." : "Sign out"}
          </button>
          {logoutError && <Notice variant="danger" role="alert">{logoutError}</Notice>}
          <a href="/" className="admin-back-site">Open public website <ArrowUpRight size={14} aria-hidden /></a>
        </div>
      </aside>
    </>
  );
}
