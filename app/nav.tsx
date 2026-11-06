"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Grid, LogOut, Menu, Sparkles, X } from "./icons";
import ThemeToggle from "./theme-toggle";
import LanguagePicker from "./language-picker";
import { getLocale } from "@/lib/locales";
import { Badge } from "@/components/ui/primitives/Badge";
import RoleSharpMark from "@/components/RoleSharpMark";
import NotificationBell from "@/components/NotificationBell";
import { useSession } from "./session-context";
import { planLabel } from "@/lib/plan-label";
import { trackProductEvent } from "./product-analytics";
import {
  FEATURED_WORKFLOW_ROUTE,
  PUBLIC_DESKTOP_ROUTES,
  findNavigationGroup,
  groupRoutes,
  isNavigationRouteActive,
  routesForAudience,
} from "./navigation-registry";
import type { NavigationGroup, NavigationGroupId, NavigationRoute } from "./navigation-registry";

type DesktopMenu = NavigationGroupId;

export default function Nav() {
  const { session: me } = useSession();
  const loggedIn = Boolean(me?.loggedIn);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<DesktopMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Partial<Record<DesktopMenu, HTMLButtonElement | null>>>({});
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const landingHeader = pathname === "/" || Boolean(getLocale(pathname.slice(1)));
  const openLanguage = () => {
    setOpen(false);
    setMenuOpen(null);
  };

  useEffect(() => {
    setOpen(false);
    setMenuOpen(null);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.dataset.mobileNavOpen = open ? "true" : "false";
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      delete document.documentElement.dataset.mobileNavOpen;
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => mobileTriggerRef.current?.focus());
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const activeTrigger = triggerRefs.current[menuOpen];
        setMenuOpen(null);
        window.requestAnimationFrame(() => activeTrigger?.focus());
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Hover-open for desktop pointers: the menus were click-only, which the
  // owner read as friction ("hazzle"). Keyboard and touch still toggle on
  // click/focus; this only adds pointer hover as a shortcut, with a small
  // close delay so diagonal mouse travel toward the panel does not slam it.
  // openVia tracks how the current panel was raised: a click on an
  // already-hover-opened trigger must KEEP it open (the pointer-down hover
  // fired first), otherwise every deliberate click would read as toggle-off.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openVia = useRef<"hover" | "click" | null>(null);
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  function openOnHover(group: NavigationGroupId) {
    if (!window.matchMedia("(hover: hover) and (min-width: 1024px)").matches) return;
    if (menuOpen && menuOpen !== group) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (menuOpen !== group) {
      setMenuOpen(group);
      openVia.current = "hover";
    }
  }
  function scheduleHoverClose() {
    if (!window.matchMedia("(hover: hover) and (min-width: 1024px)").matches) return;
    if (openVia.current !== "hover") return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => { setMenuOpen(null); openVia.current = null; }, 140);
  }
  function toggleMenu(group: NavigationGroupId) {
    const nextOpen = menuOpen === group && openVia.current === "click" ? null : group;
    openVia.current = nextOpen ? "click" : null;
    setMenuOpen(nextOpen);
    if (nextOpen) {
      trackProductEvent("nav_menu_open", {
        context: `desktop:${group}`,
        authState: analyticsAuthState,
      });
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/";
  }

  const isActive = (href: string, activePaths?: readonly string[]) => isNavigationRouteActive(pathname, href, activePaths);
  const routeActivePaths = (route: NavigationRoute) => route.activePaths;
  const analyticsAuthState = loggedIn ? "authenticated" as const : "anonymous" as const;
  const trackNavSelection = (href: string, context = "site_nav") => {
    trackProductEvent("nav_item_select", {
      context: `${context}:${href.replace(/^\//u, "").replace(/\//gu, "_") || "home"}`,
      authState: analyticsAuthState,
    });
  };

  function menuButton(group: NavigationGroup, className = "") {
    const expanded = menuOpen === group.id;
    const groupActive = groupRoutes(group).some(({ href, activePaths }) => isActive(href, activePaths));
    return (
      <button
        ref={(node) => { triggerRefs.current[group.id] = node; }}
        type="button"
        className={`rs-nav-link rs-nav-menu-trigger ${groupActive || expanded ? "is-active" : ""} ${className}`}
        onClick={() => toggleMenu(group.id)}
        onMouseEnter={() => openOnHover(group.id)}
        onFocus={() => openOnHover(group.id)}
        aria-expanded={expanded}
        aria-controls={`desktop-${group.id}-nav`}
      >
        {group.label}
        <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
    );
  }

  function routeLink({ href, label, description, icon: Icon, activePaths }: NavigationRoute) {
    const active = isActive(href, activePaths);
    const isPopular =
      href === "/checker" ||
      href === "/resume-match" ||
      href === "/salaries" ||
      href === "/auto-apply";
    const isNew =
      href === "/career-map" ||
      href === "/resume-fixer" ||
      href === "/salary-negotiation-script";

    return (
      <a
        key={href}
        href={href}
        onClick={() => trackNavSelection(href, "desktop_menu")}
        className={`rs-nav-menu-item ${active ? "is-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        <span className="rs-nav-menu-icon" aria-hidden="true">
          <Icon size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <strong>{label}</strong>
            {isPopular && (
              <span
                aria-hidden="true"
                className="rounded-full bg-[color-mix(in_oklab,var(--success)_14%,transparent)] px-1.5 py-0.5 text-[9px] font-bold leading-tight text-[var(--success)]"
              >
                HOT
              </span>
            )}
            {isNew && (
              <span
                aria-hidden="true"
                className="rounded-full bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] px-1.5 py-0.5 text-[9px] font-bold leading-tight text-[var(--primary)]"
              >
                NEW
              </span>
            )}
          </span>
          <small>{description}</small>
        </span>
      </a>
    );
  }

  function megaMenu(group: NavigationGroup, variant: "default" | "workspace" | "account" = "default") {
    if (menuOpen !== group.id) return null;
    const FeaturedIcon = FEATURED_WORKFLOW_ROUTE.icon;
    const primarySection = group.sections[0];

    return (
      <div
        id={`desktop-${group.id}-nav`}
        onMouseEnter={() => openOnHover(group.id)}
        onMouseLeave={scheduleHoverClose}
        className={`rs-nav-dropdown rs-nav-more-menu rs-nav-mega-menu rs-nav-mega-menu-${variant} animate-in fade-in slide-in-from-top-1`}
        aria-label={`${group.label} links`}
      >
        {group.id === "account" && loggedIn ? (
          <div className="rs-nav-account-summary">
            <div>
              <span className="rs-nav-menu-kicker">Signed in as</span>
              <strong>{me?.email || "RoleSharp member"}</strong>
            </div>
            <Badge variant={me?.premium ? "premium" : "default"}>{planLabel(me)}</Badge>
            <div className="rs-nav-account-usage">
              <span>
                <b>{me?.remaining ?? 0}</b> of {me?.limit ?? 0} resumes left
              </span>
              {!me?.premium && <a href="/pricing">Upgrade</a>}
            </div>
          </div>
        ) : (
          <div className="rs-nav-menu-kicker">{group.kicker}</div>
        )}

        <div className="rs-nav-section-grid">
          {group.id === "products" && primarySection ? (
            <>
              {/* Left Column: Build & improve (6 items) */}
              <div className="rs-nav-column">
                <section
                  key={primarySection.id}
                  className="rs-nav-menu-section"
                  aria-labelledby={`desktop-${group.id}-${primarySection.id}`}
                >
                  <h2 id={`desktop-${group.id}-${primarySection.id}`} className="rs-nav-section-label">
                    {primarySection.label}
                  </h2>
                  <div className="rs-nav-menu-list">
                    {routesForAudience(primarySection.routes, loggedIn).map(routeLink)}
                  </div>
                </section>
              </div>
              {/* Right Column: Apply & organize (3 items) + Salary & prep (2 items) */}
              <div className="rs-nav-column flex flex-col gap-1.5">
                {group.sections.slice(1).map((section) => (
                  <section
                    key={section.id}
                    className="rs-nav-menu-section"
                    aria-labelledby={`desktop-${group.id}-${section.id}`}
                  >
                    <h2 id={`desktop-${group.id}-${section.id}`} className="rs-nav-section-label">
                      {section.label}
                    </h2>
                    <div className="rs-nav-menu-list">
                      {routesForAudience(section.routes, loggedIn).map(routeLink)}
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : (
            group.sections.map((section) => (
              <section
                key={section.id}
                className="rs-nav-menu-section"
                aria-labelledby={`desktop-${group.id}-${section.id}`}
              >
                <h2 id={`desktop-${group.id}-${section.id}`} className="rs-nav-section-label">
                  {section.label}
                </h2>
                <div className="rs-nav-menu-list">
                  {routesForAudience(section.routes, loggedIn).map(routeLink)}
                </div>
              </section>
            ))
          )}

          {group.id === "products" && (
            <a
              href={FEATURED_WORKFLOW_ROUTE.href}
              onClick={() =>
                trackProductEvent("featured_workflow_select", {
                  context: "site_nav:auto_apply",
                  authState: analyticsAuthState,
                })
              }
              className="rs-nav-feature-card"
            >
              <span className="rs-nav-feature-icon" aria-hidden="true">
                <FeaturedIcon size={14} />
              </span>
              <span className="rs-nav-feature-kicker">Featured</span>
              <strong>{FEATURED_WORKFLOW_ROUTE.label}</strong>
              <small className="hidden sm:inline-block">{FEATURED_WORKFLOW_ROUTE.description}</small>
              <span className="rs-nav-feature-cta">
                See workflow <span aria-hidden="true">→</span>
              </span>
            </a>
          )}
        </div>
        {group.id === "tools" && (
          <a href="/tools" onClick={() => trackNavSelection("/tools", "desktop_menu")} className="rs-nav-see-all">
            Explore all 20 tools <span aria-hidden="true">→</span>
          </a>
        )}
        {group.id === "account" && loggedIn && (
          <div className="rs-nav-account-footer"><ThemeToggle compact /><button type="button" onClick={logout}><LogOut size={16} /> Log out</button></div>
        )}
      </div>
    );
  }

  const productsGroup = findNavigationGroup("products");
  const toolsGroup = findNavigationGroup("tools");
  const jobsGroup = findNavigationGroup("jobs");
  const resourcesGroup = findNavigationGroup("resources");
  const publicGroups = [productsGroup, toolsGroup, jobsGroup, resourcesGroup];
  const accountGroup = findNavigationGroup("account");
  // The workspace group is member-only surface; the mobile drawer needs the
  // routes the public groups do not already carry (Email Connection,
  // Campaign Settings, Account settings) because the workspace tab bar does
  // not exist on marketing and account pages. Rendering the whole group
  // would duplicate Dashboard/Daily Matches/Queue/Tracker/Auto Apply, which
  // the drawer already shows via the standalone Dashboard link, the Jobs
  // group, and the Products group — an e2e pins those as reachable exactly
  // once.
  const workspaceGroupRaw = findNavigationGroup("workspace");
  const publicHrefs = new Set<string>(["/dashboard"]);
  for (const group of publicGroups) {
    for (const section of group.sections) {
      for (const route of routesForAudience(section.routes, loggedIn)) publicHrefs.add(route.href);
    }
  }
  const workspaceGroup = workspaceGroupRaw
    ? {
        ...workspaceGroupRaw,
        sections: workspaceGroupRaw.sections
          .map((section) => ({
            ...section,
            routes: section.routes.filter((route) => !publicHrefs.has(route.href)),
          }))
          .filter((section) => section.routes.length > 0),
      }
    : workspaceGroupRaw;

  return (
    <nav className="rs-site-nav sticky top-0 z-50" aria-label="Main navigation">
      <div className="rs-nav-container max-w-[var(--maxw)] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rs-nav-shell" ref={menuRef}>
          <a href={loggedIn ? "/dashboard" : "/"} className="rs-nav-brand" aria-label={loggedIn ? "RoleSharp dashboard" : "RoleSharp home"}><span className="rs-nav-brand-mark" aria-hidden="true"><RoleSharpMark size={30} /></span><span>Role<span>Sharp</span></span></a>

          <div className="rs-nav-links hidden lg:flex items-center gap-1">
            {/* Section 1: AI Tools */}
            <div className="flex items-center gap-0.5">
              <div className="rs-nav-menu-root" onMouseEnter={() => openOnHover("products")} onMouseLeave={scheduleHoverClose}>{menuButton(productsGroup)}{megaMenu(productsGroup)}</div>
              <div className="rs-nav-menu-root" onMouseEnter={() => openOnHover("tools")} onMouseLeave={scheduleHoverClose}>{menuButton(toolsGroup)}{megaMenu(toolsGroup)}</div>
            </div>

            <span className="h-4 w-px bg-[var(--hairline)] mx-1" aria-hidden="true" />

            {/* Section 2: Live Interview & Jobs */}
            <div className="flex items-center gap-0.5">
              <a
                href="/interview-prep"
                onClick={() => trackNavSelection("/interview-prep", "desktop_direct")}
                className={`rs-nav-link rs-nav-link-highlight flex items-center gap-1.5 ${isActive("/interview-prep") ? "is-active" : ""}`}
                aria-current={isActive("/interview-prep") ? "page" : undefined}
              >
                <span>Interview Practice</span>
              </a>
              <div className="rs-nav-menu-root" onMouseEnter={() => openOnHover("jobs")} onMouseLeave={scheduleHoverClose}>{menuButton(jobsGroup)}{megaMenu(jobsGroup)}</div>
            </div>

            <span className="h-4 w-px bg-[var(--hairline)] mx-1" aria-hidden="true" />

            {/* Section 3: Templates, Resources & Pricing */}
            <div className="flex items-center gap-0.5">
              <a
                href="/resume-templates"
                onClick={() => trackNavSelection("/resume-templates", "desktop_direct")}
                className={`rs-nav-link ${isActive("/resume-templates") ? "is-active" : ""}`}
                aria-current={isActive("/resume-templates") ? "page" : undefined}
              >
                Templates
              </a>
              <div className="rs-nav-menu-root" onMouseEnter={() => openOnHover("resources")} onMouseLeave={scheduleHoverClose}>{menuButton(resourcesGroup)}{megaMenu(resourcesGroup)}</div>
              <a
                href="/pricing"
                onClick={() => trackNavSelection("/pricing", "desktop_direct")}
                className={`rs-nav-link ${isActive("/pricing") ? "is-active" : ""}`}
                aria-current={isActive("/pricing") ? "page" : undefined}
              >
                Pricing
              </a>
            </div>
          </div>

          <div className="rs-nav-actions hidden lg:flex">
            {landingHeader && loggedIn && <ThemeToggle compact />}
            {loggedIn ? (
              <div className="rs-nav-member-actions">
                {/* Persistent, not inside a dropdown: the way back to your own
                    workspace should never need a click to find. */}
                <a href="/dashboard" onClick={() => trackNavSelection("/dashboard", "desktop_direct")} className={`rs-nav-link ${isActive("/dashboard") ? "is-active" : ""}`} aria-current={isActive("/dashboard") ? "page" : undefined}>Dashboard</a>
                <NotificationBell />
                <div className="rs-nav-menu-root rs-nav-account-root" onMouseEnter={() => openOnHover("account")} onMouseLeave={scheduleHoverClose}>{menuButton(accountGroup, "rs-nav-member-trigger")}{megaMenu(accountGroup, "account")}</div>
              </div>
            ) : (
              <><ThemeToggle /><a href="/login" className="rs-nav-login">Log in</a><a href="/build" className="rs-nav-cta">Start free <span aria-hidden="true">→</span></a></>
            )}
            {landingHeader && <LanguagePicker pathname={pathname} onOpen={openLanguage} />}
          </div>

          <div className={`flex items-center gap-2 lg:hidden${landingHeader ? " rs-landing-controls" : ""}`}>
            <a
              href="/interview-prep"
              onClick={() => trackNavSelection("/interview-prep", "mobile_header")}
              className={`${landingHeader ? "hidden min-[520px]:flex" : "flex"} items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 shadow-2xs`}
            >
              <Sparkles size={12} className="text-amber-500" aria-hidden="true" />
              <span>Interview Practice</span>
            </a>
            {landingHeader && <ThemeToggle compact />}
            <button
              ref={mobileTriggerRef}
              type="button"
              className="p-2.5 rounded-lg text-[var(--color-text)] hover:bg-[var(--color-surface-2)] dark:text-[var(--color-dark-text)] dark:hover:bg-[var(--color-dark-surface-2)] transition-colors"
              onClick={() => setOpen((value) => {
                const nextOpen = !value;
                if (nextOpen) {
                  trackProductEvent("nav_menu_open", {
                    context: "mobile:main",
                    authState: analyticsAuthState,
                  });
                }
                return nextOpen;
              })}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
            {landingHeader && <LanguagePicker pathname={pathname} onOpen={openLanguage} />}
          </div>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="lg:hidden max-h-[calc(100dvh-64px)] overflow-y-auto overscroll-contain border-t border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-4 py-5 shadow-2xl">
          {/* Quick action bar: the three highest-intent tools, one tap before
              any group opens. */}
          <div className="mb-5 grid grid-cols-3 gap-2">
            <a href="/checker" onClick={() => trackNavSelection("/checker", "mobile_quick")} className="flex items-center justify-center gap-1 rounded-xl border border-[color-mix(in_oklab,var(--success)_30%,transparent)] bg-[color-mix(in_oklab,var(--success)_10%,transparent)] px-2 py-2 text-[11px] font-bold text-[var(--success)]">
              ATS Checker
            </a>
            <a href="/interview-prep" onClick={() => trackNavSelection("/interview-prep", "mobile_quick")} className="flex items-center justify-center gap-1 rounded-xl border border-[color-mix(in_oklab,var(--color-brand-amber-ink)_30%,transparent)] bg-amber-500/10 px-2 py-2 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              Interview Practice
            </a>
            <a href="/resume-match" onClick={() => trackNavSelection("/resume-match", "mobile_quick")} className="flex items-center justify-center gap-1 rounded-xl border border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-2 py-2 text-[11px] font-bold text-[var(--primary)]">
              Resume Match
            </a>
          </div>
          <div className="grid gap-3">
            {publicGroups.map((group) => (
              <details key={group.id} className="rs-mobile-nav-group" open={group.id === "tools"}>
                {/* The kicker stays a leaf element with its exact text: the e2e
                    suite opens groups by clicking the kicker string. */}
                <summary className="rs-mobile-nav-summary"><span>{group.label}<small>{group.kicker}</small></span><ChevronDown size={18} /></summary>
                <div className="mt-2 grid gap-4">
                  {/* No signed-in filter here. Tracker and Auto Apply used to be
                      dropped for members because the drawer's workspace group
                      listed them again; that group is gone, so dropping them
                      left members with no drawer route to either — strictly
                      worse off than a logged-out visitor. */}
                  {group.sections.map((section) => (
                    <div key={section.id}><div className="rs-mobile-nav-heading">{section.label}</div><div className="grid gap-1">{routesForAudience(section.routes, loggedIn).map(({ href, label, icon: Icon, activePaths }) => {
                      const active = isActive(href, activePaths);
                      return <a key={href} href={href} onClick={() => trackNavSelection(href, "mobile_menu")} className={`rs-mobile-nav-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={18} /> {label}</a>;
                    })}</div></div>
                  ))}
                </div>
              </details>
            ))}
            <div className="rs-mobile-nav-direct">
              {PUBLIC_DESKTOP_ROUTES.map((route) => <a key={route.href} href={route.href} onClick={() => trackNavSelection(route.href, "mobile_direct")} className={isActive(route.href, routeActivePaths(route)) ? "is-active" : ""}>{route.label}</a>)}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--color-border)] dark:border-[var(--color-dark-border)] grid gap-3">
            {loggedIn ? (
              <>
                <div className="rs-mobile-account-summary"><span><strong>{me?.email || "RoleSharp member"}</strong><small>{me?.remaining ?? 0} of {me?.limit ?? 0} resumes left</small></span><Badge variant={me?.premium ? "premium" : "default"}>{planLabel(me)}</Badge></div>
                <a href="/dashboard" onClick={() => trackNavSelection("/dashboard", "mobile_direct")} className={`rs-mobile-nav-link ${isActive("/dashboard") ? "is-active" : ""}`} aria-current={isActive("/dashboard") ? "page" : undefined}><Grid size={18} /> Dashboard</a>
                {/* Workspace + account groups in the drawer. The workspace
                    group is filtered to the routes the public groups above do
                    not already carry (Email Connection, Campaign Settings,
                    Account settings) — rendering the whole group duplicated
                    Tracker/Auto Apply, which the drawer shows via Products. */}
                {[workspaceGroup, accountGroup].map((group) => (
                  <details key={group.id} className="rs-mobile-nav-group" open={group.id === "workspace"}>
                    <summary className="rs-mobile-nav-summary"><span>{group.label}<small>{group.kicker}</small></span><ChevronDown size={18} /></summary>
                    <div className="mt-2 grid gap-4">{group.sections.map((section) => <div key={section.id}><div className="rs-mobile-nav-heading">{section.label}</div><div className="grid gap-1">{section.routes.map((route) => {
                      const { href, label, icon: Icon } = route;
                      const mobileLabel = href === "/auto-apply" ? ((route as NavigationRoute).shortLabel ?? label) : label;
                      const active = isActive(href, routeActivePaths(route));
                      return <a key={href} href={href} onClick={() => trackNavSelection(href, "mobile_workspace")} className={`rs-mobile-nav-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={18} /> {mobileLabel}</a>;
                    })}</div></div>)}</div>
                  </details>
                ))}
                <div className="rs-mobile-theme-row"><span><strong>Appearance</strong><small>Light or dark interface</small></span><ThemeToggle compact /></div>
                <button onClick={logout} className="flex w-full items-center gap-3 px-3 py-3 rounded-lg text-base font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"><LogOut size={18} /> Log out</button>
              </>
            ) : (
              <><div className="rs-mobile-theme-row"><span><strong>Appearance</strong><small>Light or dark interface</small></span><ThemeToggle compact /></div><div className="grid gap-2"><a href="/login" className="flex items-center justify-center px-4 py-3 rounded-lg text-base font-semibold border border-[var(--color-border)] dark:border-[var(--color-dark-border)]">Log in</a><a href="/build" className="flex items-center justify-center px-4 py-3 rounded-lg text-base font-semibold bg-[var(--color-primary-solid)] text-white hover:bg-[var(--color-primary-hover)]">Start free</a></div></>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
