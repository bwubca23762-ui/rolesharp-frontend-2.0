import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("customer care requests and consumes the admin API response contracts", () => {
  const view = source("app/admin/views/customer-care-view.tsx");
  const usersApi = source("app/api/admin/users/route.ts");
  const paymentsApi = source("app/api/admin/payments/route.ts");

  assert.match(view, /\/api\/admin\/users\?list=1&page=1&pageSize=8/);
  assert.match(view, /\/api\/admin\/payments\?page=1&pageSize=6/);
  assert.match(view, /u\.value\?\.rows/);
  assert.match(view, /p\.value\?\.rows/);
  assert.match(usersApi, /return NextResponse\.json\(\{ rows, total, page, pageSize \}\)/);
  assert.match(paymentsApi, /return NextResponse\.json\(\{ rows, total, page, pageSize, statuses:/);
  assert.match(view, /premium_until && new Date\(u\.premium_until\)/);
  // support staff hold users.read but never payments.read — demanding it here
  // locked the whole support role out of the care desk.
  assert.match(source("app/admin/navigation.ts"), /href: "\/admin\/customer-care"[^\n]*additionalPermissions: \["users\.read"\]/);
});

test("admin mutation controls are hidden from read-only workspace users", () => {
  const panel = source("app/admin/admin-panel.tsx");
  assert.match(panel, /<UsersView onRefresh=\{reload\} canManage=\{session\.principal\.permissions\.includes\("users\.manage"\)\}/);
  assert.match(panel, /<StudentsView canManage=\{session\.principal\.permissions\.includes\("offers\.edit"\)\}/);
  assert.match(panel, /<JobsAdminView canManage=\{session\.principal\.permissions\.includes\("jobs\.manage"\)\}/);
  assert.match(panel, /<SupportView canManage=\{session\.principal\.permissions\.includes\("support\.manage"\)\}/);
  assert.match(panel, /<CampaignsView canManage=\{session\.principal\.permissions\.includes\("jobs\.manage"\)\}/);
  assert.match(panel, /<MailConnectionsView canEdit=\{session\.principal\.permissions\.includes\("mail\.manage"\)\}/);
  assert.match(panel, /<ResumesView s=\{s\} onRefresh=\{reload\} canManage=\{session\.principal\.permissions\.includes\("users\.manage"\)\}/);
  assert.match(panel, /<BlogView canEdit=\{session\.principal\.permissions\.includes\("content\.edit"\)\}/);
  assert.match(panel, /<InternshipReportsAdmin canManage=\{session\.principal\.permissions\.includes\("support\.manage"\)\}/);
  assert.match(source("app/admin/views/users-view.tsx"), /rowActions=\{canManage \?/);
  assert.match(source("app/admin/views/students-view.tsx"), /rowActions=\{canManage \?/);
  assert.match(source("app/admin/views/support-view.tsx"), /canManage && selected\.status !== "resolved"/);
  assert.match(source("app/admin/views/campaigns-view.tsx"), /rowActions=\{canManage \?/);
  assert.match(source("app/admin/views/mail-connections-view.tsx"), /rowActions=\{canEdit \?/);
  assert.match(source("app/admin/views/blog-view.tsx"), /canEdit && <div className="admin-chart-card"/);
  assert.match(source("app/admin/internship-reports/reports-admin.tsx"), /canManage && <div className="row"/);
  assert.match(source("app/admin/views/overview-view.tsx"), /canManageSystem && <Button/);
  assert.match(source("app/admin/views/system-view.tsx"), /canManage && <div className="row"/);
});

test("users, resumes, and dashboard activity refresh from current server data", () => {
  const panel = source("app/admin/admin-panel.tsx");
  const users = source("app/admin/views/users-view.tsx");
  const resumes = source("app/admin/views/resumes-view.tsx");
  const query = source("app/admin/query-client.tsx");

  assert.match(panel, /setInterval\(load, 60 \* 1000\)/);
  assert.match(users, /cache: "no-store"/);
  assert.match(users, /refetchInterval: 60_000/);
  assert.match(users, /onRefresh=\{\(\) => \{ void refetch\(\); onRefresh\(\); \}\}/);
  assert.match(resumes, /refetchInterval: 60_000/);
  assert.match(resumes, /onRefresh=\{\(\) => \{ void refetch\(\); onRefresh\(\); \}\}/);
  assert.match(query, /refetchIntervalInBackground: false/);
});

// ---- 2026-10-21 admin batch (ADMIN-01..10) ----

test("admin views resolve to real kebab-case routes, including customer care", () => {
  const panel = source("app/admin/admin-panel.tsx");
  // ADMIN-01: the camelCase join produced /admin/customerCare, which no route
  // matches — the Customer Care view was URL-unreachable.
  assert.match(panel, /if \(view === "customerCare"\) return "\/admin\/customer-care";/);
  assert.match(panel, /if \(view === "featureAccess"\) return "\/admin\/feature-access";/);
  assert.match(panel, /if \(view === "mailConnections"\) return "\/admin\/mail-connections";/);
});

test("staff return paths cover every admin view", () => {
  const rules = source("lib/staff-auth.ts");
  for (const path of ["/admin/customer-care", "/admin/feature-access", "/admin/campaigns",
    "/admin/auto-mail", "/admin/offers", "/admin/notifications", "/admin/communications",
    "/admin/mail-connections", "/admin/legal"]) {
    assert.ok(rules.includes(`path: "${path}"`), `STAFF_RETURN_PATH_RULES missing ${path}`);
  }
});

test("feature access expiration is reflected in the status filter", () => {
  const route = source("app/api/admin/feature-access/route.ts");
  assert.match(route, /g\.state='approved' and g\.expires_at is not null and g\.expires_at<=now\(\)/);
  assert.match(route, /effective_state as state/);
  assert.match(route, /where \(\$1::text is null or effective_state=\$1\)/);
  assert.match(route, /count\(\*\)::int count from feature_access_grants/);
  assert.match(route, /limit \$2 offset \$3/);
  const view = source("app/admin/views/feature-access-view.tsx");
  assert.match(view, /grant\.state === "suspended" \|\| grant\.state === "expired"/);
  assert.match(view, /minReasonLength=\{3\}/);
  assert.match(view, /<code className="admin-data-row-detail min-w-0 break-all font-mono select-all">\{grant\.user_id\}<\/code>/);
  assert.match(view, /navigator\.clipboard\.writeText\(userId\)/);
});

test("notifications CTA URLs are app-relative on both client and API sides", () => {
  const view = source("app/admin/views/notifications-view.tsx");
  const api = source("app/api/admin/notifications/route.ts");
  // Both sides must accept app-relative paths (/pricing) and reject absolute
  // http(s) URLs and bare "//host" protocol-relative forms.
  assert.match(view, /app-relative paths starting with a single slash/u);
  assert.match(api, /regex\(\/\^\\\/\[\^\/\]\//u);
});
test("bulk user selection has a checkbox column and admin credit grants hit the ledger", () => {
  const view = source("app/admin/views/users-view.tsx");
  assert.match(view, /aria-label="Select all users on this page"/);
  assert.match(view, /type="checkbox"/);
  const route = source("app/api/admin/users/route.ts");
  assert.match(route, /insert into credit_events \(user_id, kind, delta, details\)/);
  assert.match(route, /admin_adjustment/);
});

test("rate-limit panel reads scanned, offers default to clean_pdf, indexnow accepts either admin scope", () => {
  assert.match(source("app/admin/panels/rate-limit-panel.tsx"), /data\.scanned \?\? 0/);
  assert.match(source("app/admin/views/offers-view.tsx"), /clean_pdf_export/);
  assert.doesNotMatch(source("app/admin/views/offers-view.tsx"), /docx_export/);
  const indexnow = source("app/api/admin/indexnow/route.ts");
  assert.match(indexnow, /hasAdminPermission\("content.publish"\)/);
  assert.match(indexnow, /hasAdminPermission\("system.manage"\)/);
});

test("backup and logs run in the root ops-helper, not the web process", () => {
  assert.match(source("app/api/admin/backup/route.ts"), /opsRequest\(\{ action: "backup" \}\)/);
  const logs = source("app/api/admin/logs/route.ts");
  assert.match(logs, /opsRequest\(\{ action: "logs"/);
  assert.doesNotMatch(logs, /execFile/);
  const helper = source("scripts/ops-helper.mjs");
  assert.match(helper, /"logs"/);
});

test("every admin mutation route records an audit action", () => {
  for (const route of ["flags", "premium", "queue", "users", "verify-email",
    "mail-connections", "students", "internship-reports", "job-listings", "cache"]) {
    const src = source(`app/api/admin/${route}/route.ts`);
    assert.ok(src.includes("recordAdminAction") || /insert into admin_actions\s*\([^)]*staff_account_id[^)]*authentication_method/.test(src), `app/api/admin/${route}/route.ts does not audit its mutations`);
  }
  // Audit rows expose the acting staff member.
  const audit = source("app/api/admin/audit/route.ts");
  assert.match(audit, /actor_email/);
  assert.match(audit, /left join staff_accounts/);
  const view = source("app/admin/views/actions-view.tsx");
  assert.match(view, /actor_email/);
});
