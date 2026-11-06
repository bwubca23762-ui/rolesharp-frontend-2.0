"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/primitives";
import AdminSidebar from "./sidebar";
import AdminLogin from "./login";
import AdminWorkspaceBar from "./workspace-bar";
import { AdminProviders } from "./query-client";
import { adminNavigationItemsForPermissions, requiredAdminNavigationPermissions } from "./navigation";
import { AdminCommandPalette, defaultPaletteActions } from "./command-palette";
import { toast } from "sonner";
import Skeleton from "@/components/ui/Skeleton";

// Same shape as the table/card views being loaded: eight rows of the same
// height the real table renders, so the swap causes no layout shift.
function ViewSkeleton() {
  return (
    <div className="grid gap-2 p-1" aria-busy="true">
      <Skeleton variant="heading" width="12rem" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => <Skeleton key={row} variant="table-row" />)}
    </div>
  );
}

import type { AdminSessionStatus, AdminStats as S } from "./admin-types";

import Overview from "./views/overview-view";
import SystemView from "./views/system-view";
import SettingsView from "./views/settings-view";
import PricingView from "./views/pricing-view";

const InternshipReportsAdmin = dynamic(
  () => import("./internship-reports/reports-admin"),
  { loading: () => <ViewSkeleton /> },
);
const AnalyticsView = dynamic(
  () => import("./views/analytics-view"),
  { loading: () => <ViewSkeleton /> },
);
const StaffView = dynamic(
  () => import("./views/staff-view"),
  { loading: () => <ViewSkeleton /> },
);
const FeatureAccessView = dynamic(
  () => import("./views/feature-access-view"),
  { loading: () => <ViewSkeleton /> },
);
const LegalView = dynamic(
  () => import("./views/legal-view"),
  { loading: () => <ViewSkeleton /> },
);
const OffersView = dynamic(
  () => import("./views/offers-view"),
  { loading: () => <ViewSkeleton /> },
);
const NotificationsView = dynamic(
  () => import("./views/notifications-view"),
  { loading: () => <ViewSkeleton /> },
);
const CommunicationsView = dynamic(
  () => import("./views/communications-view"),
  { loading: () => <ViewSkeleton /> },
);
const EmailsView = dynamic(
  () => import("./views/emails-view"),
  { loading: () => <ViewSkeleton /> },
);
const FeatureFlagView = dynamic(
  () => import("./views/feature-flag-view"),
  { loading: () => <ViewSkeleton /> },
);
const StudentsView = dynamic(
  () => import("./views/students-view"),
  { loading: () => <ViewSkeleton /> },
);
const JobsAdminView = dynamic(
  () => import("./views/jobs-admin-view"),
  { loading: () => <ViewSkeleton /> },
);
const ActionsView = dynamic(
  () => import("./views/actions-view"),
  { loading: () => <ViewSkeleton /> },
);
const SupportView = dynamic(
  () => import("./views/support-view"),
  { loading: () => <ViewSkeleton /> },
);
const BlogView = dynamic(
  () => import("./views/blog-view"),
  { loading: () => <ViewSkeleton /> },
);
const UsersView = dynamic(
  () => import("./views/users-view"),
  { loading: () => <ViewSkeleton /> },
);
const ResumesView = dynamic(
  () => import("./views/resumes-view"),
  { loading: () => <ViewSkeleton /> },
);
const PaymentsView = dynamic(
  () => import("./views/payments-view"),
  { loading: () => <ViewSkeleton /> },
);
const WorkflowsView = dynamic(
  () => import("./views/workflows-view"),
  { loading: () => <ViewSkeleton /> },
);
const CampaignsView = dynamic(
  () => import("./views/campaigns-view"),
  { loading: () => <ViewSkeleton /> },
);
const MailConnectionsView = dynamic(
  () => import("./views/mail-connections-view"),
  { loading: () => <ViewSkeleton /> },
);
const AutoMailView = dynamic(
  () => import("./views/auto-mail-view"),
  { loading: () => <ViewSkeleton /> },
);
const CustomerCareView = dynamic(
  () => import("./views/customer-care-view"),
  { loading: () => <ViewSkeleton /> },
);

/* ═══════════════ SHARED HOOK ═══════════════ */

// Session cache in module scope: each /admin/* route renders its own
// <AdminPanel>, so navigating between sections used to remount the shell and
// refetch /api/admin/session (+stats) on every click — several network round
// trips of "Loading admin..." per navigation even though the server answers
// in ~10ms. Module scope survives client-side route changes but is dropped
// by any hard reload (logout, sign-in redirect), so staleness cannot outlive
// a real session boundary. Fresh entries render instantly; stale ones render
// immediately and revalidate in the background.
const SESSION_TTL_MS = 60_000;
type SessionCacheEntry = { session: S extends never ? never : AdminSessionStatus; stats: S | null; at: number };
let sessionCache: SessionCacheEntry | null = null;

function useAdminData(includeStats: boolean): { s: S | null; session: AdminSessionStatus | null; needLogin: boolean; loading: boolean; error: string; reload: (opts?: { fresh?: boolean }) => Promise<void>; setNeedLogin: (v: boolean) => void; statsStale: boolean } {
  const cached = sessionCache;
  const [s, setS] = useState<S | null>(cached ? cached.stats : null);
  const [session, setSession] = useState<AdminSessionStatus | null>(cached ? cached.session : null);
  const [needLogin, setNeedLogin] = useState(false);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");
  const [statsStale, setStatsStale] = useState(false);
  const loadedOnce = useRef(false);

  const load = useCallback(async (opts?: { fresh?: boolean }) => {
    const cacheIsFresh = sessionCache && Date.now() - sessionCache.at < SESSION_TTL_MS;
    if (!loadedOnce.current && !cacheIsFresh) setLoading(true);
    setStatsStale(false);
    try {
      const sessionResponse = await fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store" });
      loadedOnce.current = true;
      if (sessionResponse.status === 403) {
        sessionCache = null;
        setNeedLogin(true);
        setSession(null);
        setLoading(false);
        return;
      }
      setNeedLogin(false);
      if (!sessionResponse.ok) {
        setError("Could not load admin session status.");
        setLoading(false);
        return;
      }
      const sessionData = await sessionResponse.json() as AdminSessionStatus;
      setSession(sessionData);
      let statsData: S | null = null;
      if (includeStats && sessionData.principal.permissions.includes("analytics.read")) {
        // fresh=1 on every load: the manual Refresh button must never be
        // served the same 15s server cache the previous click just read.
        const statsResponse = await fetch(`/api/admin/stats${opts?.fresh ? "?fresh=1" : ""}`, { credentials: "same-origin", cache: "no-store" });
        if (!statsResponse.ok) {
          setError(statsResponse.status === 403 ? "This account cannot access dashboard statistics." : "Could not load admin dashboard.");
          setLoading(false);
          return;
        }
        statsData = await statsResponse.json() as S;
        setS(statsData);
      }
      sessionCache = { session: sessionData, stats: statsData, at: Date.now() };
      setError("");
      setLoading(false);
    } catch {
      loadedOnce.current = true;
      setLoading(false);
      // A failed refresh must not keep serving a possibly-revoked session,
      // but a cached session with dead stats must ALSO not sit in an eternal
      // skeleton: mark stats stale so the stats branch renders a Retry card.
      if (includeStats && sessionCache) {
        setStatsStale(true);
      } else if (!sessionCache) {
        setError("Could not load admin dashboard.");
      }
    }
  }, [includeStats]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Keep dashboard totals and recent signup activity current while the admin
    // is looking at an open workspace. Visibility changes still refresh at once.
    const iv = setInterval(load, 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  return { s, session, needLogin, loading, error, reload: load, setNeedLogin, statsStale };
}

/* ═══════════════ MAIN EXPORT ═══════════════ */

type AdminView = "overview" | "system" | "users" | "resumes" | "payments" | "actions" | "support" | "blog" | "analytics" | "flags" | "emails" | "pricing" | "students" | "offers" | "notifications" | "communications" | "jobs" | "workflows" | "internshipReports" | "settings" | "staff" | "featureAccess" | "legal" | "campaigns" | "mailConnections" | "autoMail" | "customerCare";

function adminViewPath(view: AdminView): string {
  if (view === "overview") return "/admin";
  // Kebab-case route: the default camelCase join produced /admin/customerCare,
  // which no middleware route matches — the Customer Care view was unreachable
  // by URL (ADMIN-01).
  if (view === "customerCare") return "/admin/customer-care";
  if (view === "internshipReports") return "/admin/internship-reports";
  if (view === "featureAccess") return "/admin/feature-access";
  if (view === "mailConnections") return "/admin/mail-connections";
  if (view === "autoMail") return "/admin/auto-mail";
  return `/admin/${view === "pricing" ? "pricing-config" : view}`;
}

export default function AdminShell({ view }: { view: AdminView }) {
  const includeStats = view === "overview" || view === "system" || view === "resumes" || view === "payments";
  const { s, session, needLogin, loading, error, reload, statsStale } = useAdminData(includeStats);

  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) toast.success(detail);
    };
    window.addEventListener("rs-admin-toast", onToast);
    return () => window.removeEventListener("rs-admin-toast", onToast);
  }, []);
  const paletteRoutes = useMemo(
    () => adminNavigationItemsForPermissions(session?.principal.permissions ?? []).map((item) => ({ label: item.label, href: item.href, group: "group" in item ? String(item.group ?? "") : "" })),
    [session?.principal.permissions],
  );
  const paletteActions = useMemo(() => {
    const perms = session?.principal.permissions ?? [];
    const actions = defaultPaletteActions().filter((action) =>
      action.id === "purge-cache" ? perms.includes("system.read") : perms.includes("flags.manage"),
    );
    return actions;
  }, [session?.principal.permissions]);

  if (loading) return (
    <main className="admin-layout admin-workspace">
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }} aria-busy="true">
        <div className="w-full max-w-3xl grid gap-3">
          <Skeleton variant="heading" width="14rem" />
          {[0, 1, 2, 3, 4, 5].map((row) => <Skeleton key={row} variant="table-row" />)}
        </div>
      </div>
    </main>
  );

  if (needLogin) return <AdminLogin onOk={reload} />;

  if (error && (!session || (includeStats && session?.principal.permissions.includes("analytics.read") && !s))) return (
    <main className="admin-layout admin-workspace">
      <div className="admin-chart-card" style={{ margin: 40, maxWidth: 420 }}>
        <h3 style={{ marginTop: 0 }}>Dashboard unavailable</h3>
        <p className="text-[var(--muted-fg)]">{error}</p>
        <Button onClick={() => { reload(); }}>Retry</Button>
      </div>
    </main>
  );

  if (!session || (includeStats && session.principal.permissions.includes("analytics.read") && !s)) {
    // Cached-session navigations land here only while stats are still in
    // flight on a stats-including view; the sidebar already rendered by then,
    // so keep the chrome up instead of blanking to a bare loading line.
    // When stats are STALE (fetch failed behind a cached session), show a
    // Retry card instead of the eternal skeleton.
    return (
      <main className="admin-layout admin-workspace">
        <section className="admin-main admin-workspace-main" style={{ alignItems: "center", justifyContent: "center", display: "flex", flex: 1, padding: 40 }} aria-busy="true">
          {statsStale && !loading ? (
            <div className="grid gap-3 text-center">
              <p className="text-[var(--muted-fg)]">The dashboard statistics could not be loaded.</p>
              <Button onClick={() => { void reload({ fresh: true }); }}>Retry</Button>
            </div>
          ) : (
            <div className="w-full max-w-3xl grid gap-3">
              <Skeleton variant="heading" width="14rem" />
              {[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} variant="table-row" />)}
            </div>
          )}
        </section>
      </main>
    );
  }

  const activePath = adminViewPath(view);
  const requiredPermissions = requiredAdminNavigationPermissions(activePath, session.principal.permissions);
  const missingPermissions = (requiredPermissions ?? []).filter((permission) => !session.principal.permissions.includes(permission));
  // A path with no navigation entry is unregistered, not unrestricted.
  const allowed = requiredPermissions !== null && missingPermissions.length === 0;
  const availableHome = adminNavigationItemsForPermissions(session.principal.permissions)[0]?.href;

  return (
    <AdminProviders>
    <main className="admin-layout admin-workspace">
      <a className="admin-skip-link" href="#admin-workspace-content">Skip to workspace content</a>
      <AdminSidebar
        openTickets={session.navigation.openTickets}
        pendingReports={session.navigation.pendingReports}
        pendingStudents={session.navigation.pendingStudents}
        pendingAccessRequests={session.navigation.pendingAccessRequests}
        status={{
          environmentLabel: session.environment.label,
          isProduction: session.environment.isProduction,
          monitored: session.navigation.monitored,
        }}
        permissions={session.principal.permissions}
        principal={session.principal}
      />
      <section id="admin-workspace-content" tabIndex={-1} className="admin-main admin-workspace-main">
        <AdminWorkspaceBar active={activePath} onTogglePalette={() => setPaletteOpen((open) => !open)} permissions={session.principal.permissions} principal={session.principal} onRefresh={reload} />
        {!allowed && (
          <div className="admin-chart-card" role="alert">
            <h1 style={{ marginTop: 0 }}>Access restricted</h1>
            <p className="text-[var(--muted-fg)]">
              {requiredPermissions === null
                ? "This workspace is not a registered admin route."
                : <>This workspace requires: {missingPermissions.map((permission) => <code key={permission}>{permission}</code>)}.</>}
            </p>
            {availableHome
              ? <Button as="a" variant="outline" href={availableHome}>Return to an available workspace</Button>
              : <p className="text-[var(--muted-fg)]">No workspace is assigned to this account. Contact an administrator.</p>}
          </div>
        )}
        {allowed && view === "overview" && s && <Overview s={s} onRefresh={reload} permissions={session.principal.permissions} />}
        {allowed && view === "analytics" && <AnalyticsView canExport={session.principal.permissions.includes("analytics.export")} />}
        {allowed && view === "system" && s && <SystemView s={s} onRefresh={reload} canManage={session.principal.permissions.includes("system.manage")} canReadJobs={session.principal.permissions.includes("jobs.read")} canReadSecurity={session.principal.permissions.includes("security.read")} />}
        {allowed && view === "users" && <UsersView onRefresh={reload} canManage={session.principal.permissions.includes("users.manage")} />}
        {allowed && view === "resumes" && s && <ResumesView s={s} onRefresh={reload} canManage={session.principal.permissions.includes("users.manage")} />}
        {allowed && view === "payments" && s && <PaymentsView s={s} />}
        {allowed && view === "actions" && <ActionsView />}
        {allowed && view === "support" && <SupportView canManage={session.principal.permissions.includes("support.manage")} />}
        {allowed && view === "customerCare" && <CustomerCareView canManageSupport={session.principal.permissions.includes("support.manage")} />}
        {allowed && view === "blog" && <BlogView canEdit={session.principal.permissions.includes("content.edit")} />}
        {allowed && view === "flags" && <FeatureFlagView />}
        {allowed && view === "pricing" && <PricingView />}
        {allowed && view === "emails" && <EmailsView />}
        {allowed && view === "students" && <StudentsView canManage={session.principal.permissions.includes("offers.edit")} />}
        {allowed && view === "offers" && <OffersView canEdit={session.principal.permissions.includes("offers.edit")} canPublish={session.principal.permissions.includes("offers.publish")} />}
        {allowed && view === "notifications" && <NotificationsView canEdit={session.principal.permissions.includes("notifications.edit")} canPublish={session.principal.permissions.includes("notifications.publish")} />}
        {allowed && view === "communications" && <CommunicationsView canEdit={session.principal.permissions.includes("communications.edit")} canPublish={session.principal.permissions.includes("communications.publish")} />}
        {allowed && view === "jobs" && <JobsAdminView canManage={session.principal.permissions.includes("jobs.manage")} />}
        {allowed && view === "workflows" && <WorkflowsView canToggleFlags={session.principal.permissions.includes("flags.manage")} canManageQueue={session.principal.permissions.includes("system.manage")} />}
        {allowed && view === "internshipReports" && <InternshipReportsAdmin canManage={session.principal.permissions.includes("support.manage")} />}
        {allowed && view === "settings" && <SettingsView canManage={session.principal.permissions.includes("system.manage")} canReadPayments={session.principal.permissions.includes("payments.read")} canManagePayments={session.principal.permissions.includes("payments.manage")} canManageFlags={session.principal.permissions.includes("flags.manage")} canReadJobs={session.principal.permissions.includes("jobs.read")} />}
        {allowed && view === "staff" && <StaffView canManage={session.principal.permissions.includes("staff.manage")} breakGlass={session.principal.breakGlass} currentStaffAccountId={session.principal.staffAccountId} />}
        {allowed && view === "featureAccess" && <FeatureAccessView canManage={session.principal.permissions.includes("access.manage")} canApprove={session.principal.permissions.includes("access.manage") && !session.principal.breakGlass} />}
        {allowed && view === "legal" && <LegalView canEdit={session.principal.permissions.includes("legal.edit")} canPublish={session.principal.permissions.includes("legal.publish")} />}
        {allowed && view === "campaigns" && <CampaignsView canManage={session.principal.permissions.includes("jobs.manage")} />}
        {allowed && view === "mailConnections" && <MailConnectionsView canEdit={session.principal.permissions.includes("mail.manage")} />}
        {allowed && view === "autoMail" && <AutoMailView />}
      </section>
      <AdminCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        routes={paletteRoutes}
        actions={paletteActions}
      />
    </main>
    </AdminProviders>
  );
}
