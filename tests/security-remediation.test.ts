import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { csvCell } from "../lib/csv";
import { trustedClientIp } from "../lib/request-ip";
import { ResumeContent } from "../lib/types";
import { localRateLimit } from "../lib/rate-limit";
import { digestOneTimeToken } from "../lib/security-tokens";
import { validateResumeFile } from "../lib/upload-security";
import { now, paymentMatchesInvoice, verifyIpn } from "../lib/nowpay";
import { signatureFor, verifies } from "../scripts/ipn-recover";
import { boundedPageSize, containsLikePattern } from "../lib/sql-search";
import { loadEnvironment } from "../lib/env";
import { parseAnalyticsRange } from "../lib/analytics-range";
import { publicRequestHost, publicRequestOrigin, sameOriginRequest } from "../lib/request-origin";
import { DEFAULT_AUTH_DESTINATION, safeInternalPath } from "../lib/auth-redirect";
import {
  deviceClassForWidth,
  isProductEventName,
  normalizeAnalyticsPath,
  pageFamilyForPath,
  sanitizeAnalyticsContext,
} from "../lib/product-analytics";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("staff OAuth and RBAC remain isolated and fail closed", () => {
  const environment = source("lib/env.ts");
  const staffAuth = source("lib/staff-auth.ts");
  const adminAuthorization = source("lib/admin-authorization.ts");
  const startRoute = source("app/api/admin/auth/google/start/route.ts");
  const callbackRoute = source("app/api/admin/auth/google/callback/route.ts");
  const migration = source("db/migrations/045_staff_rbac_feature_access.sql");
  const navigation = source("app/admin/navigation.ts");
  const adminShell = source("app/admin/admin-panel.tsx");
  const staffView = source("app/admin/views/staff-view.tsx");
  const envExample = source(".env.example");

  assert.match(environment, /STAFF_GOOGLE_CLIENT_ID/);
  assert.match(environment, /STAFF_GOOGLE_CLIENT_SECRET/);
  assert.match(environment, /STAFF_OWNER_EMAIL/);
  assert.match(environment, /staffGoogleEnabled/);
  assert.match(envExample, /only account that may bootstrap the first active\s*(?:#\s*)?owner/);
  assert.match(startRoute, /beginStaffOAuth/);
  assert.match(startRoute, /openid email profile/);
  assert.match(callbackRoute, /jwtVerify/);
  assert.match(callbackRoute, /email_verified !== true/);
  assert.match(staffAuth, /browser_binding_hash/);
  assert.match(staffAuth, /status='consumed',consumed_at=now\(\)/);
  assert.match(staffAuth, /identity\.email === env\.staffOwnerEmail/);
  assert.match(staffAuth, /staff_subject_mismatch/);
  assert.match(staffAuth, /resolveStaffReturnPath/);
  assert.match(callbackRoute, /resolveStaffReturnPath\(staffAccountId, transaction\.returnPath\)/);
  assert.match(adminAuthorization, /currentStaff\(\)/);
  assert.match(adminAuthorization, /if \(await isAdmin\(\)\) return BREAK_GLASS_PRINCIPAL/);
  assert.match(navigation, /adminNavigationGroupsForPermissions/);
  assert.match(navigation, /permission: "staff\.read"/);
  assert.match(adminShell, /missingPermissions/);
  assert.match(adminShell, /canManage=\{session\.principal\.permissions\.includes\("staff\.manage"\)\}/);
  assert.match(staffView, /owner_last_active_lockout_denied/);
  assert.match(migration, /staff_role_assignments_active_unique/);
  assert.match(migration, /feature_access_events_append_only/);
  assert.match(migration, /admin_actions_append_only/);
});

test("per-user feature approvals remain fail-closed across API, workers, OAuth, and provider boundaries", () => {
  const featureAccess = source("lib/feature-access.ts");
  const userRoute = source("app/api/feature-access/route.ts");
  const adminRoute = source("app/api/admin/feature-access/route.ts");
  const campaigns = source("lib/jobs-workflow/campaigns.ts");
  const claims = source("lib/jobs-workflow/claims.ts");
  const scheduler = source("lib/jobs-workflow/scheduler.ts");
  const connectionFlow = source("lib/mail/connection-flow.ts");
  const packages = source("lib/jobs-workflow/packages.ts");
  const dispatch = source("lib/mail/dispatch.ts");
  const providerCap = source("db/migrations/046_provider_feature_caps.sql");
  const userPanel = source("components/FeatureAccessPanel.tsx");
  const adminPanel = source("app/admin/views/feature-access-view.tsx");

  assert.match(featureAccess, /for share/);
  assert.match(featureAccess, /feature_access_named_approver_required/);
  assert.match(featureAccess, /currentStatus\.state === "unavailable" \? null : currentStatus\.state/);
  assert.match(userRoute, /mutationOriginAllowed\(req\)/);
  assert.match(adminRoute, /requireAdminPermission\("access\.manage"\)/);
  assert.match(adminRoute, /insert into admin_actions/);
  assert.match(campaigns, /activeFeatureAccessInTransaction/);
  assert.match(claims, /join feature_access_grants/);
  assert.match(scheduler, /join feature_access_grants/);
  assert.match(connectionFlow, /requireActiveFeatureAccess/);
  assert.match(packages, /activeFeatureAccessInTransaction/);
  assert.match(dispatch, /join feature_access_grants/);
  assert.match(providerCap, /before insert on application_quota_reservations/);
  assert.match(providerCap, /provider daily cap race lost/);
  assert.match(userPanel, /\/api\/feature-access/);
  assert.match(adminPanel, /\/api\/admin\/feature-access/);
});

test("legal versions and exact acceptance stay immutable and gate every high-impact boundary", () => {
  const migration = source("db/migrations/047_legal_document_versions.sql");
  const legal = source("lib/legal.ts");
  const signup = source("app/api/auth/signup/route.ts");
  const googleStart = source("app/api/auth/google/start/route.ts");
  const googleCallback = source("app/api/auth/google/callback/route.ts");
  const acceptRoute = source("app/api/legal/accept/route.ts");
  const markdown = source("components/LegalMarkdown.tsx");
  const adminRoute = source("app/api/admin/legal/route.ts");
  const navigation = source("app/admin/navigation.ts");
  const generate = source("app/api/generate/route.ts");
  const generationWorker = source("worker/index.ts");
  const checkout = source("app/api/pay/crypto/create/route.ts");
  const winback = source("app/api/student/winback/route.ts");
  const campaigns = source("lib/jobs-workflow/campaigns.ts");
  const connectionFlow = source("lib/mail/connection-flow.ts");
  const packages = source("lib/jobs-workflow/packages.ts");
  const dispatch = source("lib/mail/dispatch.ts");

  assert.match(migration, /content_digest = encode\(digest\(convert_to\(body_markdown/);
  assert.match(migration, /legal_acceptances_snapshot/);
  assert.match(migration, /legal_acceptances_append_only/);
  assert.match(migration, /published legal version content is immutable/);
  assert.match(legal, /LegalAcceptanceRequiredError/);
  assert.match(legal, /recordExactLegalAcceptances/);
  assert.match(signup, /withTransaction/);
  assert.match(signup, /recordExactLegalAcceptances/);
  assert.match(googleStart, /__Host-g_legal/);
  assert.match(googleCallback, /google_signup_acceptance_required/);
  assert.match(googleCallback, /recordExactLegalAcceptances/);
  assert.match(acceptRoute, /mutationOriginAllowed\(req\)/);
  assert.match(acceptRoute, /recordPendingLegalAcceptances/);
  assert.doesNotMatch(markdown, /dangerouslySetInnerHTML/);
  assert.match(adminRoute, /requireAdminPermission\(requiredPermission\)/);
  assert.match(adminRoute, /legal_version_immutable/);
  assert.match(adminRoute, /insert into admin_actions/);
  assert.match(navigation, /permission: "legal\.read"/);
  assert.match(generate, /requireCurrentLegalAcceptance\(user\.id\)/);
  assert.match(generationWorker, /requireCurrentLegalAcceptance\(userId\)/);
  assert.match(generationWorker, /releaseGenerationReservation/);
  assert.match(checkout, /requireCurrentLegalAcceptance\(user\.id\)/);
  assert.match(winback, /requireCurrentLegalAcceptance\(user\.id\)/);
  assert.match(campaigns, /requireCurrentLegalAcceptance\(userId, query\)/);
  assert.match(connectionFlow, /requireCurrentLegalAcceptance\(input\.userId\)/);
  assert.match(packages, /requireCurrentLegalAcceptance\(userId, query\)/);
  assert.match(dispatch, /LegalAcceptanceRequiredError/);
});

test("general runtime configuration rejects malformed operational values", () => {
  const base: NodeJS.ProcessEnv = { NODE_ENV: "test", SITE_URL: "http://localhost:3000" };
  const parsed = loadEnvironment({
    ...base,
    WORKER_CONCURRENCY: "12",
    PREMIUM_CURRENCY: "eur",
    SMTP_SECURE: "true",
  });
  assert.equal(parsed.workerConcurrency, 12);
  assert.equal(parsed.premiumCurrency, "EUR");
  assert.equal(parsed.smtpSecure, true);
  assert.throws(() => loadEnvironment({ ...base, WORKER_CONCURRENCY: "NaN" }), /WORKER_CONCURRENCY/);
  assert.throws(() => loadEnvironment({ ...base, MAX_QUEUE_DEPTH: "Infinity" }), /MAX_QUEUE_DEPTH/);
  assert.throws(() => loadEnvironment({ ...base, SMTP_PORT: "70000" }), /SMTP_PORT/);
  assert.throws(() => loadEnvironment({ ...base, SMTP_SECURE: "yes" }), /SMTP_SECURE/);
  assert.throws(() => loadEnvironment({ ...base, PREMIUM_CURRENCY: "US" }), /PREMIUM_CURRENCY/);
  assert.throws(() => loadEnvironment({ NODE_ENV: "production", SITE_URL: "https://rolesharp.com" }), /AUTH_SECRET/);
});

test("proxy-aware origin checks accept only the externally visible request host", () => {
  const proxied = new Headers({
    origin: "https://rolesharp.com",
    "x-forwarded-host": "rolesharp.com, internal-proxy:3000",
  });
  assert.equal(publicRequestHost({ headers: proxied, fallbackHost: "127.0.0.1:3000" }), "rolesharp.com");
  assert.equal(sameOriginRequest({ headers: proxied, fallbackHost: "127.0.0.1:3000" }), true);

  const preservedHost = new Headers({
    host: "rolesharp.com",
    origin: "https://rolesharp.com",
    "x-forwarded-host": "attacker.example",
  });
  assert.equal(publicRequestHost({ headers: preservedHost }), "rolesharp.com");
  assert.equal(sameOriginRequest({ headers: preservedHost }), true);

  const direct = new Headers({ host: "localhost:3000", origin: "http://localhost:3000" });
  assert.equal(sameOriginRequest({ headers: direct }), true);

  const crossOrigin = new Headers(proxied);
  crossOrigin.set("origin", "https://attacker.example");
  assert.equal(sameOriginRequest({ headers: crossOrigin, fallbackHost: "127.0.0.1:3000" }), false);

  const malformedOrigin = new Headers(proxied);
  malformedOrigin.set("origin", "not a URL");
  assert.equal(sameOriginRequest({ headers: malformedOrigin, fallbackHost: "127.0.0.1:3000" }), false);
  assert.equal(sameOriginRequest({ headers: new Headers({ host: "rolesharp.com" }) }), false);

  const malformedForwardedHost = new Headers({
    origin: "https://rolesharp.com",
    "x-forwarded-host": "rolesharp.com/path",
  });
  assert.equal(publicRequestHost({ headers: malformedForwardedHost, fallbackHost: "rolesharp.com" }), "rolesharp.com");
  assert.equal(sameOriginRequest({ headers: malformedForwardedHost, fallbackHost: "rolesharp.com" }), true);

  assert.equal(publicRequestOrigin({ headers: direct, fallbackProtocol: "http" }), "http://localhost:3000");
  assert.equal(publicRequestOrigin({ headers: proxied, fallbackProtocol: "http" }), "http://rolesharp.com");
  assert.equal(publicRequestOrigin({ headers: new Headers({ host: "rolesharp.com" }), fallbackProtocol: "https" }), "https://rolesharp.com");
});

test("admin analytics accepts only bounded complete ISO date ranges", () => {
  assert.equal(parseAnalyticsRange(null, null), null);
  assert.deepEqual(parseAnalyticsRange("2026-01-01", "2026-01-31"), {
    from: "2026-01-01",
    to: "2026-01-31",
    days: 31,
  });
  assert.throws(() => parseAnalyticsRange("2026-01-02", "2026-01-01"), /invalid_date_range/);
  assert.throws(() => parseAnalyticsRange("2026-01-01", null), /invalid_date_range/);
  assert.throws(() => parseAnalyticsRange("not-a-date", "2026-01-01"), /invalid_date_range/);
  assert.throws(() => parseAnalyticsRange("2025-01-01", "2026-01-02"), /date_range_too_large/);
});

test("admin analytics isolates section failures and uses schema-backed resume dimensions", () => {
  const analytics = source("app/api/admin/analytics/route.ts");
  const inventory = source("lib/admin-analytics.ts");
  const exportRoute = source("app/api/admin/analytics/export/route.ts");
  const view = source("app/admin/views/analytics-view.tsx");
  assert.match(analytics, /safeSection\("generation"/);
  assert.match(analytics, /warnings: sections\.flatMap/);
  assert.match(analytics, /left join roles r on r\.id = rv\.role_id/);
  assert.match(analytics, /left join companies c on c\.id = rv\.company_id/);
  assert.doesNotMatch(analytics, /coalesce\(role_title, headline/);
  assert.doesNotMatch(analytics, /coalesce\(company_name/);
  assert.match(view, /Retrying\.\.\./);
  assert.match(view, /Some sections are temporarily unavailable/);
  assert.match(inventory, /ADMIN_ANALYTICS_TIMEZONE = "UTC"/);
  assert.match(inventory, /No recurring subscription ledger exists/);
  assert.match(analytics, /generationQueue: queueStats/);
  assert.doesNotMatch(analytics, /Promise\.resolve\(\[\{ waiting: "0"/);
  assert.doesNotMatch(analytics, /mrr:|arr:/);
  assert.match(exportRoute, /analytics\.export/);
  assert.match(exportRoute, /row\.map\(csvCell\)/);
  assert.doesNotMatch(exportRoute, /email|candidate_name|target_email/);
});

test("admin metrics keep ATS, latency, and settled payment semantics distinct", () => {
  const analytics = source("app/api/admin/analytics/route.ts");
  const stats = source("app/api/admin/stats/route.ts");
  const payments = source("app/admin/views/payments-view.tsx");
  const trends = source("app/api/admin/trends/route.ts");
  const settings = source("app/settings/page.tsx");
  assert.match(analytics, /avg\(r\.ats_score\)/);
  assert.match(analytics, /avg\(r\.gen_ms\)/);
  assert.match(analytics, /avgAtsScore: Math\.round\(num\(speeds\[0\]\?\.avg_ats\)\)/);
  assert.doesNotMatch(analytics, /status in \('finished','confirmed','sending'\)/);
  assert.doesNotMatch(stats, /status in \('finished','confirmed','sending'\)/);
  assert.doesNotMatch(stats, /select u\.email, u\.premium_until/);
  assert.doesNotMatch(stats, /select r\.candidate_name/);
  assert.doesNotMatch(stats, /target_email, details/);
  assert.doesNotMatch(payments, /\["finished", "confirmed", "sending"\]/);
  assert.doesNotMatch(trends, /status in \('finished','confirmed','sending'\)/);
  assert.doesNotMatch(settings, /\["finished", "confirmed", "sending"\]/);
});

test("job pagination counts only listings with safe apply URLs", () => {
  const jobs = source("lib/jobs.ts");
  assert.match(jobs, /apply_url ~\* '\^https\?:\/\/\[\^\[:space:\]\]\+\$'/);
  assert.doesNotMatch(jobs, /rows\.filter\(\(row: \{ apply_url\?: string \}\)/);
  assert.match(jobs, /where id=\$1[\s\S]*apply_url ~\*/);
});

test("durable blog polling stops when the tracked request becomes terminal", () => {
  const blog = source("app/admin/views/blog-view.tsx");
  assert.match(blog, /generationJobId/);
  assert.match(blog, /tracked\?\.status === "completed" \|\| tracked\?\.status === "failed"/);
  // The interval handle moved from a bare local `iv` to pollRef so it can also
  // be cleared on unmount; stopPoll() is the single path that clears it.
  // Unmount cleanup itself is pinned in tests/reliability-fixes.test.ts.
  assert.match(blog, /stopPoll\(\)/);
  assert.match(blog, /window\.clearInterval\(pollRef\.current\)/);
});

test("CSV cells neutralize formulas and preserve ordinary text", () => {
  assert.equal(csvCell("=WEBSERVICE(A1)"), "'=WEBSERVICE(A1)");
  assert.equal(csvCell("+cmd"), "'+cmd");
  assert.equal(csvCell("normal@example.com"), "normal@example.com");
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
});

test("admin audit CSV uses the formula-safe cell encoder", () => {
  const source = readFileSync(new URL("../app/admin/views/actions-view.tsx", import.meta.url), "utf8");
  assert.match(source, /header\.map\(csvCell\)\.join\("\,"\)/);
  assert.match(source, /formatAuditDetails\(r\.details\), r\.created_at\]\.map\(csvCell\)/);
});

test("every admin mutation enforces same-origin requests and records an audit event", () => {
  const root = fileURLToPath(new URL("../app/api/admin", import.meta.url));
  const routeFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(path) : entry.name === "route.ts" ? [path] : [];
  });
  const mutationRoutes = routeFiles(root).map((path) => ({ path, text: readFileSync(path, "utf8") }))
    .filter(({ text }) => /export async function (?:POST|PATCH|PUT|DELETE)/u.test(text));

  assert.ok(mutationRoutes.length >= 15, "expected the complete admin mutation surface");
  for (const route of mutationRoutes) {
    assert.match(route.text, /mutationOriginAllowed\(req\)/u, `${route.path} must reject cross-origin writes`);
    assert.match(route.text, /admin_actions|recordAdminAction/u, `${route.path} must record operator activity`);
  }
});

test("Google OAuth cannot pre-hijack an unverified password account", () => {
  const source = readFileSync(new URL("../app/api/auth/google/callback/route.ts", import.meta.url), "utf8");
  assert.match(source, /password_hash/);
  assert.match(source, /password_hash && !user\.email_verified_at/);
  assert.match(source, /google_email_pending/);
});

test("authentication return paths stay on the RoleSharp origin", () => {
  // Assert against the constant, not its current value: this test guards that a
  // hostile `next` falls back to an internal path, which is a security property.
  // Where that fallback points is a product decision and moved once already.
  assert.ok(DEFAULT_AUTH_DESTINATION.startsWith("/") && !DEFAULT_AUTH_DESTINATION.startsWith("//"));
  assert.equal(safeInternalPath("/settings?tab=security#password"), "/settings?tab=security#password");
  assert.equal(safeInternalPath("//attacker.example/path"), DEFAULT_AUTH_DESTINATION);
  assert.equal(safeInternalPath("https://attacker.example/path"), DEFAULT_AUTH_DESTINATION);
  assert.equal(safeInternalPath("/\\attacker.example/path"), DEFAULT_AUTH_DESTINATION);
  assert.equal(safeInternalPath("/safe\nunsafe"), DEFAULT_AUTH_DESTINATION);

  const start = source("app/api/auth/google/start/route.ts");
  const callback = source("app/api/auth/google/callback/route.ts");
  assert.match(start, /const requestUrl = new URL\(req\.url\)/);
  assert.match(start, /safeInternalPath\(requestUrl\.searchParams\.get\("next"\)\)/);
  assert.match(start, /nextCookieName/);
  assert.match(callback, /safeInternalPath\(jar\.get\(nextCookieName\)\?\.value\)/);
  assert.match(callback, /NextResponse\.redirect\(new URL\(nextPath, env\.siteUrl\)\)/);
});

test("client IP ignores forgeable CF-Connecting-IP", () => {
  const headers = new Headers({
    "cf-connecting-ip": "203.0.113.7",
    "x-real-ip": "198.51.100.9",
    "x-forwarded-for": "203.0.113.7, 198.51.100.9",
  });
  assert.equal(trustedClientIp(headers), "198.51.100.9");
});

test("Redis outages retain a bounded local rate-limit boundary", () => {
  const key = `security-test-${Date.now()}`;
  assert.deepEqual(localRateLimit(key, 2, 1_000, 10_000), { ok: true, retryAfter: 0 });
  assert.deepEqual(localRateLimit(key, 2, 1_000, 10_100), { ok: true, retryAfter: 0 });
  assert.deepEqual(localRateLimit(key, 2, 1_000, 10_200), { ok: false, retryAfter: 1 });
  assert.deepEqual(localRateLimit(key, 2, 1_000, 11_001), { ok: true, retryAfter: 0 });
});

// The test above proved the fallback was correct. It could not prove it was
// reachable, and it was not: ioredis with maxRetriesPerRequest: null queues a
// command until reconnect rather than rejecting, so the await never settled and
// the catch that calls localRateLimit never ran. Routes hung past 90s instead.
test("request-path Redis calls are bounded, so that fallback can actually run", async () => {
  const { redisDeadline } = await import("../lib/queue");

  // The hung command has to be releasable rather than a promise that never
  // settles: node 22's test runner treats one still pending when the event loop
  // drains as fatal and cancels the rest of the file. It is also the truer
  // model -- a real command does eventually settle once Redis reconnects, long
  // after the caller stopped waiting.
  let release: (value: number) => void = () => {};
  const hung = new Promise<number>((resolve) => { release = resolve; });
  const started = Date.now();
  await assert.rejects(() => redisDeadline(() => hung, 50, 40), /exceeded 50ms/);
  assert.ok(Date.now() - started < 2_000, "a hung Redis command must not outlive its deadline");
  release(1);
  await hung;

  // A failure opens the circuit, so the next call is refused without issuing a
  // command — that is what stops an outage costing a deadline per call, and
  // what stops commands piling up in ioredis's offline queue.
  let issued = false;
  await assert.rejects(() => redisDeadline(() => { issued = true; return Promise.resolve(1); }, 50, 40), /circuit open/);
  assert.equal(issued, false, "an open circuit must not issue the command at all");

  // ...and it closes again once the window passes, so a blip does not disable
  // the shared limiter for longer than the outage itself.
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(await redisDeadline(() => Promise.resolve(7), 50, 40), 7, "normal work still passes through");

  // Every request-path call site has to go through it, or the boundary is only
  // as good as the one file someone remembered to fix.
  assert.doesNotMatch(source("lib/rate-limit.ts"), /await connection\.(incr|expire|ttl)\(/);
  assert.doesNotMatch(source("app/api/companies/search/route.ts"), /await connection\.(get|set)\(/);
  assert.doesNotMatch(source("app/api/health/route.ts"), /await resumeQueue\.(count|getJobCounts)\(/);
  assert.match(source("lib/queue.ts"), /redisDeadline\(\(\) => resumeQueue\.count\(\)\)/);
});

test("resume schema rejects unbounded renderer input", () => {
  const base = { headline: "Engineer", summary: "Summary", skills: [], experiences: [], education: [], projects: [], certifications: [], languages: [], achievements: [] };
  assert.equal(ResumeContent.safeParse(base).success, true);
  assert.equal(ResumeContent.safeParse({ ...base, summary: "x".repeat(4001) }).success, false);
  assert.equal(ResumeContent.safeParse({ ...base, skills: Array(101).fill("x") }).success, false);
});

test("reset tokens are stored as one-way digests", () => {
  const token = "a".repeat(64);
  assert.equal(digestOneTimeToken(token), digestOneTimeToken(token));
  assert.notEqual(digestOneTimeToken(token), token);
  assert.equal(digestOneTimeToken(token).length, 64);
});

test("resume uploads require content signatures and safe text", () => {
  assert.equal(validateResumeFile("resume.pdf", "application/pdf", Buffer.from("%PDF-1.7\n")), "pdf");
  assert.equal(validateResumeFile("resume.txt", "text/plain", Buffer.from("plain text")), "txt");
  assert.throws(() => validateResumeFile("resume.pdf", "application/pdf", Buffer.from("not a pdf")));
  assert.throws(() => validateResumeFile("resume.txt", "text/plain", Buffer.from([0, 1, 2])));
  assert.throws(() => validateResumeFile("resume.pdf", "text/plain", Buffer.from("%PDF-1.7")));
});

test("crypto webhook binds paid status to the local invoice", () => {
  const expected = { orderId: "premium_user_1", priceAmount: 9.99, priceCurrency: "usd" };
  const valid = { order_id: expected.orderId, payment_status: "finished", price_amount: 9.99, price_currency: "USD" };
  assert.equal(paymentMatchesInvoice(valid, expected), true);
  assert.equal(paymentMatchesInvoice({ ...valid, price_amount: 1 }, expected), false);
  assert.equal(paymentMatchesInvoice({ ...valid, order_id: "other" }, expected), false);
  assert.equal(paymentMatchesInvoice({ ...valid, payment_status: "waiting" }, expected), false);
  assert.equal(paymentMatchesInvoice({ ...valid, payment_status: "sending" }, expected), false);
});

test("a rejected IPN is recorded, and never leaks the signature or the body", () => {
  // Production rejected a genuine NOWPayments callback (UA "NOWPayments v1.0")
  // on 2026-08-06 with a 400 and wrote nothing anywhere, so there is no way to
  // know whether a paid invoice was dropped. Silence on this path is the bug.
  const webhook = source("app/api/pay/crypto/webhook/route.ts");
  assert.match(webhook, /console\.error\("\[pay:ipn\] rejected"/,
    "a rejected callback must leave a log line");
  assert.match(webhook, /orderId/, "the log must carry the order id or reconciliation is impossible");
  assert.doesNotMatch(webhook, /console\.error\([^)]*\braw\b(?!\.length)/u,
    "never log the raw body: it carries payout addresses (raw.length is fine)");
  assert.doesNotMatch(webhook, /console\.error\([^)]*\bsig\b(?!\.length)/u,
    "never log the signature itself, only whether one was present");
});

test("a wrong IPN secret is recoverable: callbacks are quarantined, and a candidate can be proven", () => {
  // The outage this exists for: a wrong NOWPAYMENTS_IPN_SECRET on the VPS makes
  // verifyIpn reject every genuine callback, the order sits at 'waiting'
  // forever, and the customer paid for nothing. Before this the only way to
  // test a secret was to spend a real payment and watch for 400 vs 200.
  const secret = "5f3a9c1e-not-a-real-secret-4b2d";
  const body = JSON.stringify({
    payment_status: "finished",
    order_id: "premium_user_1",
    price_amount: 12,
    price_currency: "usd",
    pay_currency: "btc",
  });
  const signature = signatureFor(body, secret);
  assert.ok(signature, "a JSON body must be signable");

  // The verdict `check` prints decides what the owner installs in production,
  // so the script's copy of the HMAC must agree with the route's. It is a copy
  // on purpose -- the script runs on the VPS with no Next runtime -- and this
  // is what stops the two drifting into a confident wrong answer.
  now.apiKey = "test-key-makes-now-live";
  now.ipnSecret = secret;
  assert.equal(verifyIpn(body, signature!), true, "the route must accept what the script says is valid");
  assert.equal(verifies(body, signature!, secret), true);
  assert.equal(verifies(body, signature!, `${secret}-rotated`), false, "a stale secret must not verify");
  assert.equal(verifies("not json", signature!, secret), false);

  // Signing is over key-sorted JSON, so the same payload in a different key
  // order is the same signature. A replay re-POSTs the stored bytes anyway,
  // but this is the property that lets a stored body be re-verified at all.
  const reordered = JSON.stringify({
    pay_currency: "btc",
    price_currency: "usd",
    price_amount: 12,
    order_id: "premium_user_1",
    payment_status: "finished",
  });
  assert.equal(signatureFor(reordered, secret), signature);

  const webhook = source("app/api/pay/crypto/webhook/route.ts");
  // Only callbacks naming an order this app created are stored, so probing
  // /api/pay/crypto/webhook cannot fill the table with attacker-chosen rows.
  assert.match(webhook, /insert into ipn_quarantine[\s\S]{0,400}exists \(select 1 from crypto_payments where order_id=\$1\)/);
  // Quarantining must never turn an unverified callback into an accepted one.
  const rejectionBlock = webhook.slice(webhook.indexOf("if (!verifyIpn"), webhook.indexOf("let body: any"));
  assert.match(rejectionBlock, /status: 400/);
  assert.doesNotMatch(rejectionBlock, /grantPremium|premium_until/);
  assert.match(source("db/migrations/053_ipn_quarantine.sql"), /create table if not exists ipn_quarantine/);

  // The candidate secret must never be reachable from `ps`.
  const recover = source("scripts/ipn-recover.ts");
  assert.match(recover, /process\.env\.IPN_SECRET_CANDIDATE/);
  assert.doesNotMatch(recover, /argv[\s\S]{0,40}CANDIDATE|CANDIDATE[\s\S]{0,40}argv/u);
});

test("account deletion is transactional and clears all user-owned operational rows", () => {
  const database = source("lib/db.ts");
  const lifecycle = source("lib/account-deletion.ts");
  const migration = source("db/migrations/038_resume_package_deletion.sql");
  assert.match(database, /withTransaction/);
  assert.match(database, /delete from support_tickets where user_id_text=\$1/);
  assert.match(database, /delete from generation_reservations where user_id=\$1/);
  assert.match(database, /update users set referred_by=null where referred_by=\$1/);
  assert.match(lifecycle, /beginAccountWorkflowDeletion/);
  assert.match(lifecycle, /cancelUserGenerationJobs/);
  assert.match(lifecycle, /cancelUserWorkflowQueueJobs/);
  assert.match(lifecycle, /bestEffortAccountRevocations/);
  assert.match(migration, /references resumes\(id, user_id\)[\s\S]*on delete cascade/);
  assert.match(migration, /references application_packages[\s\S]*on delete cascade/);
});

test("development lint tooling pins the patched YAML parser", () => {
  const packageJson = JSON.parse(source("package.json")) as {
    overrides?: Record<string, string>;
  };
  const packageLock = JSON.parse(source("package-lock.json")) as {
    packages?: Record<string, { version?: string }>;
  };
  // 4.3.0 was the patched pin until GHSA-5p4m-2wfm-xmqj, whose fix was not
  // backported to 3.x or 4.x. @eslint/eslintrc still declares js-yaml ^4.3.0,
  // 5.5.0 also fixes the empty-source merge CPU issue in GHSA-r3ph-w7gj-g6xm.
  // The override moves legacy lint consumers onto the repaired parser.
  assert.equal(packageJson.overrides?.["js-yaml"], "5.5.0");
  assert.equal(packageLock.packages?.["node_modules/js-yaml"]?.version, "5.5.0");
});

// The development fallback for AUTH_SECRET was written out in three files.
// lib/env.ts owns it and is what refuses to boot in production without a real
// one; a second copy drifting would silently invalidate every unsubscribe link
// signed against the other.
test("the auth secret fallback exists in exactly one place", () => {
  for (const path of ["lib/student.ts", "lib/jobs-workflow/digests.ts"]) {
    const text = source(path);
    assert.doesNotMatch(text, /dev-insecure-secret-change-me/, `${path} duplicates the fallback secret`);
    assert.doesNotMatch(text, /process\.env\.AUTH_SECRET/, `${path} should read env.authSecret`);
  }
  assert.match(source("lib/env.ts"), /dev-insecure-secret-change-me/);
});

test("id generation pins non-looping nanoid on both major lines", () => {
  const packageLock = JSON.parse(source("package-lock.json")) as {
    packages?: Record<string, { version?: string }>;
  };
  // GHSA-28wg-ghj8-5hjv / GHSA-2v37-7h3g-55p8: generators loop forever on a
  // negative or zero size. Two majors are in the tree — docx needs the 5.x ESM
  // API, everything else resolves 3.x — so both need a patched floor.
  const v3 = packageLock.packages?.["node_modules/nanoid"]?.version ?? "";
  const v5 = packageLock.packages?.["node_modules/docx/node_modules/nanoid"]?.version ?? "";
  assert.ok(/^3\.3\.(1[7-9]|[2-9]\d)/.test(v3), `expected nanoid >=3.3.17, got ${v3}`);
  assert.ok(/^5\.(1\.(1[6-9]|[2-9]\d)|[2-9])/.test(v5), `expected nanoid >=5.1.16, got ${v5}`);
});

test("auth routes enforce bounded modern password inputs", () => {
  const signup = readFileSync(new URL("../app/api/auth/signup/route.ts", import.meta.url), "utf8");
  const change = readFileSync(new URL("../app/api/account/password/route.ts", import.meta.url), "utf8");
  const reset = readFileSync(new URL("../app/api/auth/reset-password/route.ts", import.meta.url), "utf8");
  assert.match(signup, /password\.length < 10/);
  assert.match(signup, /password\.length > 256/);
  assert.match(change, /next: z\.string\(\)\.min\(10\)\.max\(256\)/);
  assert.match(reset, /password\.length < 10/);
  assert.match(reset, /password\.length > 256/);
});

test("Google OAuth binds the callback to a signed nonce claim", () => {
  const start = readFileSync(new URL("../app/api/auth/google/start/route.ts", import.meta.url), "utf8");
  const callback = readFileSync(new URL("../app/api/auth/google/callback/route.ts", import.meta.url), "utf8");
  assert.match(start, /searchParams\.set\("nonce", nonce\)/);
  assert.match(callback, /createRemoteJWKSet/);
  assert.match(callback, /payload\.nonce !== savedNonce/);
});

test("student token consumption is an atomic one-time update", () => {
  const source = readFileSync(new URL("../lib/student.ts", import.meta.url), "utf8");
  assert.match(source, /update student_verification_tokens[\s\S]*set used_at=now\(\)[\s\S]*where id = \([\s\S]*token_hash=\$1[\s\S]*used_at is null[\s\S]*for update skip locked[\s\S]*returning id, user_id, student_email/);
  assert.doesNotMatch(source, /select id, user_id, student_email[\s\S]*from student_verification_tokens/);
});

test("student offers pin immutable exact versions through tokens, claims, and grants", () => {
  const migration = source("db/migrations/048_immutable_offer_versions.sql");
  const offers = source("lib/offers.ts");
  const student = source("lib/student.ts");
  const admin = source("app/api/admin/offers/route.ts");
  const navigation = source("app/admin/navigation.ts");

  assert.match(migration, /create table if not exists offer_versions/);
  assert.match(migration, /published offer versions are immutable/);
  assert.match(migration, /alter table student_verification_tokens[\s\S]*offer_version_id/);
  assert.match(migration, /alter table student_claims[\s\S]*offer_version_id/);
  assert.match(migration, /create table if not exists student_grants/);
  assert.match(migration, /student_grants_append_only/);
  assert.match(student, /insert into student_verification_tokens[\s\S]*offer_version_id/);
  assert.match(student, /insert into student_claims[\s\S]*offer_version_id/);
  assert.match(student, /insert into student_grants[\s\S]*offer_content_digest_snapshot/);
  assert.match(offers, /effectiveOfferVersion/);
  assert.match(admin, /mutationOriginAllowed/);
  assert.match(admin, /requireAdminPermission\(requiredPermission\)/);
  assert.match(admin, /confirmation: z\.literal\("PUBLISH OFFER"\)/);
  assert.match(admin, /insert into admin_actions/);
  assert.match(navigation, /Offers[\s\S]*offers\.read/);
});

test("support writes are transactional", () => {
  const support = source("lib/db/support.ts");
  assert.match(support, /withTransaction/);
  assert.doesNotMatch(support, /support_messages[\s\S]*\.catch\(\(\) => \{\}\)/);
});

test("action credits require a stable idempotency receipt", () => {
  const improve = source("app/api/improve/route.ts");
  const migration = source("db/migrations/039_transaction_idempotency.sql");
  assert.match(improve, /idempotencyKey: z\.string\(\)\.uuid/);
  assert.match(improve, /idempotency_key_required/);
  assert.match(improve, /request_hash/);
  assert.match(improve, /replayed: true/);
  assert.match(migration, /primary key \(user_id, action_kind, idempotency_key\)/);
});

test("student and account verification admission is atomic and delivery is journaled", () => {
  const studentRoute = source("app/api/student/send/route.ts");
  const student = source("lib/student.ts");
  const accountEmail = source("app/api/account/email/route.ts");
  const signup = source("app/api/auth/signup/route.ts");
  const verification = source("lib/email-verification.ts");
  const migration = source("db/migrations/040_delivery_and_invoice_recovery.sql");

  assert.match(studentRoute, /withTransaction/);
  assert.match(studentRoute, /pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
  assert.match(studentRoute, /student-account:/);
  assert.match(studentRoute, /student-domain:/);
  assert.match(studentRoute, /createStudentToken\(user\.id, claimKey, query, ip\)/);
  assert.match(student, /delivery_status='failed'/);
  assert.match(accountEmail, /prepareUserVerification\(user\.id, cleanEmail, query\)/);
  assert.match(signup, /withTransaction/);
  assert.match(signup, /ensureInviteCode\(id, query\)/);
  assert.match(signup, /prepareUserVerification\(id, cleanEmail, query\)/);
  assert.match(verification, /delivery_status='sent'/);
  assert.match(verification, /delivery_status='failed'/);
  assert.match(migration, /email_verification_tokens[\s\S]*delivery_status/);
  assert.match(migration, /student_verification_tokens[\s\S]*delivery_status/);
});

test("crypto checkout persists local recovery state before provider invoice creation", () => {
  const payments = source("lib/crypto-payments.ts");
  const normalCreate = source("app/api/pay/crypto/create/route.ts");
  const winback = source("app/api/student/winback/route.ts");
  const migration = source("db/migrations/040_delivery_and_invoice_recovery.sql");
  const localInsert = payments.indexOf("insert into crypto_payments");
  const providerCall = payments.indexOf("await createInvoice");

  assert.ok(localInsert >= 0 && providerCall > localInsert);
  assert.match(payments, /status in \('invoice_pending', 'invoice_unknown', 'waiting'\)/);
  assert.match(payments, /invoice_unknown/);
  assert.match(payments, /invoice_failed/);
  assert.match(normalCreate, /createRecoverableInvoice/);
  assert.match(winback, /createRecoverableInvoice/);
  assert.doesNotMatch(winback, /await createInvoice/);
  assert.match(migration, /provider_invoice_id/);
  assert.match(migration, /invoice_recovery_idx/);
});

test("anonymous analytics, pool errors, uploads, and Redis inspection are bounded", () => {
  const analytics = source("app/api/analytics/route.ts");
  const middleware = source("middleware.ts");
  const database = source("lib/db/core.ts");
  const upload = source("app/api/check-resume/upload/route.ts");
  const rateLimits = source("app/api/admin/rate-limits/route.ts");

  assert.match(analytics, /MAX_ANALYTICS_BODY_BYTES/);
  assert.match(analytics, /sessionId: z\.string\(\)\.uuid\(\)/);
  assert.match(analytics, /rateLimit\(req, "analytics"/);
  assert.doesNotMatch(middleware, /"\/api\/analytics"/);
  assert.match(database, /pool\?\.on\("error"/);
  assert.ok(upload.indexOf("content-length") < upload.indexOf("req.formData()"));
  assert.doesNotMatch(rateLimits, /\.keys\(/);
  assert.match(rateLimits, /connection\.scan/);
  assert.match(rateLimits, /connection\.pipeline/);
});

test("product analytics accepts only bounded, non-sensitive dimensions", () => {
  assert.equal(isProductEventName("tool_meaningful_start"), true);
  assert.equal(isProductEventName("resume_text_captured"), false);
  assert.equal(normalizeAnalyticsPath("/build"), "/build");
  assert.equal(normalizeAnalyticsPath("/build//preview"), "/build/preview");
  assert.equal(normalizeAnalyticsPath("/build?email=user@example.com"), null);
  assert.equal(normalizeAnalyticsPath("https://attacker.example/build"), null);
  assert.equal(sanitizeAnalyticsContext("builder:generate"), "builder:generate");
  assert.equal(sanitizeAnalyticsContext("user@example.com"), undefined);
  assert.equal(sanitizeAnalyticsContext("free text with spaces"), undefined);
  assert.equal(sanitizeAnalyticsContext("x".repeat(81)), undefined);
  assert.equal(pageFamilyForPath("/resume-maker"), "tool");
  assert.equal(pageFamilyForPath("/settings"), "workspace");
  assert.equal(deviceClassForWidth(375), "mobile");
  assert.equal(deviceClassForWidth(768), "tablet");
  assert.equal(deviceClassForWidth(1280), "desktop");

  const analytics = source("app/api/analytics/route.ts");
  const migration = source("db/migrations/044_privacy_safe_product_events.sql");
  assert.match(analytics, /event: z\.enum\(PRODUCT_EVENT_NAMES\)/);
  assert.match(analytics, /const pageFamily = pageFamilyForPath\(path\)/);
  assert.match(analytics, /values \(\$1, null, \$2, \$3, \$4, null\)/);
  assert.doesNotMatch(analytics, /req\.headers\.get\("referer"\)/);
  assert.match(migration, /product_events_path_check/);
  assert.match(migration, /product_events_context_check/);
  assert.doesNotMatch(migration, /resume_text|job_description|email_address|application_notes/u);
});

test("every list search treats SQL wildcards literally and bounds ordinary pages", () => {
  assert.equal(containsLikePattern("100%_done\\later"), "%100\\%\\_done\\\\later%");
  assert.equal(boundedPageSize("1000"), 100);
  assert.equal(boundedPageSize("1000", 20, 1_000), 1_000);

  const routes = [
    "app/api/admin/users/route.ts",
    "app/api/admin/resumes/route.ts",
    "app/api/admin/students/route.ts",
    "app/api/admin/payments/route.ts",
    "app/api/admin/job-listings/route.ts",
    "app/api/admin/emails/route.ts",
    "app/api/admin/audit/route.ts",
    "app/api/admin/internship-reports/route.ts",
    // The admin routes were escaped while the public paths on the same tables
    // were not, so `50%` or `C_A` matched everything for logged-out users.
    // These three are the whole public surface; lib/jobs.ts escapes inline.
    "app/api/internship-reports/route.ts",
    "lib/db/companies.ts",
    "lib/db/roles.ts",
  ];
  for (const route of routes) {
    const text = source(route);
    assert.match(text, /containsLikePattern/);
    assert.match(text, /escape '\\\\'/);
    assert.doesNotMatch(text, /`%\$\{/);
  }
  const users = source("app/api/admin/users/route.ts");
  const usersView = source("app/admin/views/users-view.tsx");
  assert.match(users, /exportMode \? ADMIN_EXPORT_PAGE_SIZE_MAX : undefined/);
  assert.match(usersView, /export=csv/);
  assert.doesNotMatch(source("app/api/admin/resumes/route.ts"), /Math\.min\(1000/);
  assert.doesNotMatch(source("app/api/admin/payments/route.ts"), /Math\.min\(1000/);
  assert.doesNotMatch(source("app/api/admin/emails/route.ts"), /Math\.min\(1000/);
});

test("admin blog generation is durable and recoverable", () => {
  const route = source("app/api/admin/blog/route.ts");
  const jobs = source("lib/blog-jobs.ts");
  const queues = source("lib/jobs-workflow/queues.ts");
  const scheduler = source("lib/jobs-workflow/scheduler.ts");
  const worker = source("worker/blog-generation.ts");
  const migration = source("db/migrations/041_blog_generation_jobs.sql");

  assert.doesNotMatch(route, /new Set<string>/);
  assert.doesNotMatch(route, /\(async \(\) =>/);
  assert.match(route, /createBlogGenerationJob/);
  assert.match(route, /enqueueBlogGeneration/);
  assert.match(jobs, /pg_advisory_xact_lock/);
  assert.match(jobs, /status='running'/);
  assert.match(jobs, /lease_expires_at/);
  assert.match(queues, /BlogGenerationQueueMessage/);
  assert.match(queues, /jobId: `blog-generation-\$\{data\.generationJobId\}-v\$\{data\.version\}`/);
  assert.match(scheduler, /blog_generation_jobs/);
  assert.match(worker, /processBlogGenerationJob/);
  assert.match(migration, /create table if not exists blog_generation_jobs/);
});

test("LLM and mailbox provider requests have default deadlines", () => {
  const llm = source("lib/llm.ts");
  const providers = source("lib/mail/providers.ts");
  const dispatch = source("lib/mail/dispatch.ts");
  const connectionFlow = source("lib/mail/connection-flow.ts");
  const deadline = source("lib/request-deadline.ts");

  assert.match(deadline, /PROVIDER_REQUEST_TIMEOUT_MS = 15_000/);
  assert.match(deadline, /LLM_REQUEST_TIMEOUT_MS = 90_000/);
  assert.match(deadline, /AbortSignal\.any/);
  assert.equal((llm.match(/deadlineSignal\(LLM_REQUEST_TIMEOUT_MS/g) ?? []).length, 3);
  assert.equal((providers.match(/deadlineSignal\(PROVIDER_REQUEST_TIMEOUT_MS/g) ?? []).length, 3);
  assert.equal((dispatch.match(/deadlineSignal\(PROVIDER_REQUEST_TIMEOUT_MS/g) ?? []).length, 3);
  assert.match(connectionFlow, /deadlineSignal\(PROVIDER_REQUEST_TIMEOUT_MS\)/);
});

test("mail, unsubscribe, role search, and dev storage fail safely", () => {
  const email = source("lib/email.ts");
  const unsubscribe = source("app/api/student/unsubscribe/route.ts");
  const roles = source("app/api/roles/route.ts");
  const devStore = source("lib/dev-store.ts");
  const localDevStore = source("lib/local-dev-store.ts");

  assert.match(email, /AbortSignal\.timeout\(10_000\)/);
  assert.match(email, /connectionTimeout: 10_000/);
  assert.match(email, /greetingTimeout: 10_000/);
  assert.match(email, /socketTimeout: 20_000/);
  assert.match(unsubscribe, /timingSafeEqual/);
  assert.match(roles, /rateLimit\(req, "role-search"/);
  assert.match(roles, /query\.length > 100/);
  assert.match(roles, /search_unavailable/);
  assert.match(devStore, /dev-store must not be imported in production/);
  assert.match(devStore, /mutationChain/);
  assert.match(devStore, /rename\(temporary, FILE\)/);
  assert.match(localDevStore, /process\.env\.LOCAL_DEV_MODE !== "true"/);
  assert.match(localDevStore, /import\("\.\/dev-store"\)/);
  assert.doesNotMatch(source("lib/auth.ts"), /from "\.\/dev-store"/);

  const oauth = source("app/api/auth/google/callback/route.ts");
  const deletionOauth = source("app/api/account/delete/google/callback/route.ts");
  const indexNow = source("lib/indexnow.ts");
  assert.equal((oauth.match(/AbortSignal\.timeout\(10_000\)/g) ?? []).length, 2);
  assert.match(deletionOauth, /AbortSignal\.timeout\(10_000\)/);
  assert.match(indexNow, /AbortSignal\.timeout\(10_000\)/);
});

test("health keeps public liveness separate from authenticated dependency readiness", () => {
  const health = source("app/api/health/route.ts");
  assert.match(health, /if \(!admin\)[\s\S]*\{ ok: true, ts: Date\.now\(\) \}/);
  assert.match(health, /searchParams\.get\("readiness"\) === "1"/);
  assert.match(health, /await q\("select 1"\)/);
  assert.match(health, /status: readiness && !ready \? 503 : 200/);
  assert.match(health, /Cache-Control/);
});

test("configuration and migration hygiene remain enforced", () => {
  const environment = source("lib/env.ts");
  const playwright = source("playwright.config.ts");
  const concurrentMigration = source("db/migrations/028_role_search_index.sql");
  const validationMigration = source("db/migrations/042_schema_validation.sql");

  assert.doesNotMatch(environment, /Number\(process\.env\./);
  assert.match(environment, /Number\.isSafeInteger/);
  assert.match(playwright, /--port \$\{jobsQaPort\}/);
  assert.match(concurrentMigration, /NON_TRANSACTIONAL/);
  assert.match(validationMigration, /validate constraint applications_job_id_fk/);
  assert.match(validationMigration, /pending_timezone/);

  // The marker is what both deploy.sh and the integrity harness branch on, so a
  // CONCURRENTLY migration that omits it runs inside a transaction and fails at
  // deploy time. Assert the rule over every migration rather than over the one
  // file that happened to need it first.
  const unmarked = readdirSync(new URL("../db/migrations", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => {
      const body = source(`db/migrations/${name}`);
      return /index concurrently/i.test(body) && !body.includes("NON_TRANSACTIONAL");
    });
  assert.deepEqual(unmarked, [], `CREATE INDEX CONCURRENTLY needs a NON_TRANSACTIONAL marker: ${unmarked.join(", ")}`);
});

test("Telegram binding and generation quota controls remain installed", () => {
  const migration = readFileSync(new URL("../db/migrations/023_security_remediation.sql", import.meta.url), "utf8");
  assert.match(migration, /users_telegram_user_id_unique/);
  assert.match(migration, /student_claims_user_id_unique/);
  assert.match(migration, /create table if not exists generation_reservations/);

  const entitlements = readFileSync(new URL("../lib/entitlements.ts", import.meta.url), "utf8");
  assert.match(entitlements, /pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
  assert.match(entitlements, /insert into generation_reservations/);
});

test("generation credits are charged by the worker only after enqueue", () => {
  const generate = source("app/api/generate/route.ts");
  const worker = source("worker/index.ts");
  const credits = source("lib/credits.ts");
  const migration = source("db/migrations/029_generation_payment_integrity.sql");

  const productionQueuePath = generate.slice(generate.indexOf("const reserved"));
  assert.doesNotMatch(productionQueuePath, /spendCredit/);
  assert.match(generate, /if \(env\.localDevMode\)[\s\S]*await spendCredit/);
  assert.match(generate, /useCredit,\s*creditEventId: null/);
  assert.match(generate, /releaseGenerationReservation/);
  assert.match(worker, /spendCredit\(userId, resumeId\)/);
  assert.match(worker, /if \(!creditEventId\) throw new CreditUnavailableError/);
  assert.doesNotMatch(worker, /job\.data\._result/);
  assert.match(credits, /with existing as[\s\S]*premium_resume_spend[\s\S]*on conflict do nothing/);
  assert.match(migration, /credit_events_premium_resume_spend_once/);
});

test("generation failure refunds are atomic and queue records do not retain resume PII", () => {
  const worker = source("worker/index.ts");
  const credits = source("lib/credits.ts");
  const generate = source("app/api/generate/route.ts");

  assert.match(worker, /refundGenerationCredit/);
  assert.match(
    credits,
    /with original_spend as[\s\S]*insert into credit_events[\s\S]*refund_failed_generation[\s\S]*update users[\s\S]*from inserted/,
  );
  assert.match(generate, /removeOnComplete: true/);
  assert.match(generate, /removeOnFail: true/);
});

test("account deletion serializes against workers and cancels queued PII", () => {
  const accountRoute = source("app/api/account/delete/route.ts");
  const adminRoute = source("app/api/admin/users/route.ts");
  const lifecycle = source("lib/account-deletion.ts");
  const database = source("lib/db.ts");
  const resumes = source("lib/db/resumes.ts");
  const queue = source("lib/queue.ts");

  assert.match(accountRoute, /deleteAccountLifecycle\(user\.id\)/);
  assert.match(adminRoute, /deleteAccountLifecycle\(user\.id/);
  assert.match(lifecycle, /cancelUserGenerationJobs\(userId\)/);
  assert.match(database, /select id from users where id=\$1 for update/);
  assert.match(resumes, /withTransaction/);
  assert.match(resumes, /select id from users where id=\$1 for key share/);
  assert.doesNotMatch(resumes, /user_id=excluded\.user_id/);
  assert.match(resumes, /resumes\.user_id is not distinct from excluded\.user_id/);
  assert.match(queue, /getJobs\(\["waiting", "delayed", "paused", "active"\]/);
  assert.match(queue, /accountDeleted: true/);
});

test("student activation and payment identity changes are atomic", () => {
  const student = source("lib/student.ts");
  const confirmation = source("app/api/student/confirm/route.ts");
  const paymentCreate = source("app/api/pay/crypto/create/route.ts");
  const migration = source("db/migrations/029_generation_payment_integrity.sql");

  assert.match(student, /activateStudentOffer/);
  assert.match(student, /withTransaction/);
  assert.match(student, /insert into student_claims[\s\S]*update users set[\s\S]*premium_until/);
  assert.match(confirmation, /activateStudentOffer\(token\)/);
  assert.doesNotMatch(confirmation, /grantPremium/);
  assert.match(paymentCreate, /createRecoverableInvoice/);
  assert.match(source("lib/crypto-payments.ts"), /randomUUID\(\)/);
  assert.match(migration, /unique index if not exists crypto_pay_order_unique/);
});

test("deploy excludes credentials and validates all production auth secrets", () => {
  const deploy = source("deploy.sh");
  const scheduler = source("worker/jobs-scheduler.ts");
  const envExample = source(".env.example");
  const gitignore = source(".gitignore");
  const releaseVerifier = source("scripts/verify-jobs-release.sh");
  const jobIngestor = source("scripts/job_ingestor.py");

  assert.match(deploy, /rolesharp_vps_20260729/);
  assert.match(deploy, /--exclude '\.ssh'/);
  assert.match(deploy, /--exclude '\*private\*key\*'/);
  assert.match(deploy, /--exclude '\.next\*'/);
  assert.match(deploy, /--exclude '\.workbuddy-ai'/);
  assert.match(deploy, /--exclude 'outputs'/);
  assert.match(deploy, /sourceManifestDigest/);
  assert.doesNotMatch(deploy, /\"sourceSha\"/);
  assert.match(deploy, /AUTH_SECRET/);
  assert.match(deploy, /npm ci --include=dev/);
  assert.match(deploy, /releases\/\$RELEASE_ID/);
  assert.match(deploy, /mv -Tf '\$REMOTE\/current\.next' '\$REMOTE\/current'/);
  assert.match(deploy, /activation failed; restoring previous release/);
  assert.match(deploy, /systemctl disable --now rolesharp-match-worker\.service rolesharp-mail-worker\.service/);
  assert.match(deploy, /rolesharp-recommendation-agent\.service/);
  assert.match(deploy, /rolesharp-auto-apply-agent\.service/);
  assert.match(deploy, /systemctl is-active rolesharp-recommendation-agent/);
  assert.match(deploy, /systemctl is-active rolesharp-auto-apply-agent/);
  assert.match(deploy, /rolesharp-blog-worker\.service/);
  assert.match(deploy, /systemctl is-active rolesharp-blog-worker/);
  assert.doesNotMatch(scheduler, /setInterval\(tick, 60_000\)\.unref\(\)/);
  assert.ok(
    deploy.indexOf("npm run build") < deploy.indexOf("run DB migrations"),
    "the isolated build must pass before migrations run",
  );
  assert.match(envExample, /AUTH_SECRET=/);
  assert.match(gitignore, /\.ssh\//);
  assert.match(gitignore, /\*private\*key\*/);
  assert.match(releaseVerifier, /recorded_source_manifest_digest/);
  assert.match(releaseVerifier, /source manifest digest does not match the release record/);
  assert.match(jobIngestor, /def interruptible_sleep\(seconds: int\) -> None:/);
  assert.doesNotMatch(jobIngestor, /time\.sleep\(POLL_SECONDS\)/);

  for (const unit of [
    "deploy/resume-web.service",
    "deploy/resume-worker.service",
    "deploy/rolesharp-jobs.service",
    "deploy/rolesharp-recommendation-agent.service",
    "deploy/rolesharp-auto-apply-agent.service",
  ]) {
    const service = source(unit);
    assert.match(service, /\/opt\/resume-ai\/current/);
    if (unit === "deploy/rolesharp-jobs.service") {
      assert.match(service, /TimeoutStopSec=45/);
    }
    if (unit.includes("agent")) {
      assert.match(service, /TimeoutStopSec=90/);
      assert.match(service, /NoNewPrivileges=true/);
      assert.match(service, /ProtectSystem=strict/);
    }
  }
});

test("the two VPS agents own disjoint workflow queues and drain within systemd timeout", () => {
  const recommendation = source("worker/recommendation-agent.ts");
  const autoApply = source("worker/auto-apply-agent.ts");
  const smoke = source("scripts/run-jobs-smoke.sh");

  for (const queue of ["jobs-match", "jobs-digest", "notification-outbox"]) {
    assert.match(recommendation, new RegExp(`new Worker\\(\\"${queue}\\"`));
    assert.doesNotMatch(autoApply, new RegExp(`new Worker\\(\\"${queue}\\"`));
  }
  for (const queue of ["application-package", "mailbox-dispatch"]) {
    assert.match(autoApply, new RegExp(`new Worker\\(\\"${queue}\\"`));
    assert.doesNotMatch(recommendation, new RegExp(`new Worker\\(\\"${queue}\\"`));
  }
  assert.match(recommendation, /tickInFlight/);
  assert.match(recommendation, /75_000/);
  assert.match(autoApply, /75_000/);
  assert.match(smoke, /worker:recommendation-agent -- --once/);
  assert.match(smoke, /worker:auto-apply-agent -- --once/);
  assert.match(smoke, /MICROSOFT_CONNECTION_REDIRECT_URI=https:\/\/smoke\.invalid\/api\/mail-connections\/microsoft\/callback/);
});

test("jobs QA uses a bounded isolated build directory and starts portably", () => {
  const nextConfig = source("next.config.ts");
  const qaRunner = source("scripts/qa-jobs-workflows.mjs");
  const eslintConfig = source("eslint.config.mjs");

  assert.match(nextConfig, /\.next-qa-build/);
  assert.match(nextConfig, /new Set\(\["\.next", "\.next-playwright", "\.next-qa-build"\]\)/);
  assert.match(qaRunner, /JOBS_QA_DIST_DIR: "\.next-qa-build"/);
  assert.match(qaRunner, /JOBS_QA_TSCONFIG: "tsconfig\.jobs-qa\.json"/);
  assert.match(qaRunner, /await copyFile\("tsconfig\.json", qaTsconfig\)/);
  assert.match(qaRunner, /await restoreStableTypeInputs\(\)/);
  assert.match(nextConfig, /typescript: \{ tsconfigPath: process\.env\.JOBS_QA_TSCONFIG \}/);
  assert.match(qaRunner, /shell: windows/);
  assert.match(eslintConfig, /"\.next-qa-build\/\*\*"/);
  assert.match(eslintConfig, /"\.local\/\*\*"/);
  assert.match(source(".gitignore"), /tsconfig\.jobs-qa\.json/);
  assert.doesNotMatch(source("tsconfig.json"), /\.next-qa-build\/types/);
  assert.doesNotMatch(source("next-env.d.ts"), /\.next-qa-build\/types/);
});

test("role-apply campaign updates enforce the five-per-day service boundary", () => {
  const campaigns = source("lib/jobs-workflow/campaigns.ts");
  const migration = source("db/migrations/043_application_daily_hard_cap.sql");

  assert.match(campaigns, /current\.mode === "role_apply" && input\.dailyLimit !== undefined && input\.dailyLimit > 5/);
  assert.match(campaigns, /application_daily_limit_exceeded/);
  assert.match(migration, /job_campaigns_role_apply_daily_limit_check/);
  assert.match(migration, /mode <> 'role_apply' or daily_limit between 1 and 5/);
  assert.match(migration, /least\(policy_row\.effective_cap, 5\)/);
  assert.match(migration, /count < least\(effective_cap_snapshot, 5\)/);
});

test("auto-apply cannot bypass daily approval or source-backed recipient safety", () => {
  const packages = source("lib/jobs-workflow/packages.ts");
  const dispatch = source("lib/mail/dispatch.ts");
  const databaseTest = source("scripts/verify-db-integrity.ts");

  assert.doesNotMatch(packages, /authorization_mode === "campaign_policy"/);
  assert.doesNotMatch(packages, /actor,\s*campaign_id,campaign_consent_version/);
  assert.doesNotMatch(packages, /immediate enqueue failed/);
  assert.match(packages, /row\.authorization_mode !== "review_each"/);
  assert.match(packages, /extractedRecipient\.disposition !== "auto_eligible"/);
  assert.match(packages, /candidate\.warnings\.length === 0/);
  assert.doesNotMatch(packages, /\["auto_eligible", "review_required"\]\.includes/);
  assert.match(packages, /row\.recipient_record\?\.disposition !== "auto_eligible"/);
  assert.match(packages, /typeof employerDomain !== "string"/);
  assert.match(packages, /row\.existing_package_id === row\.id/);
  assert.match(packages, /row\.status === "review_required" && row\.existing_attempt_id/);
  assert.match(packages, /if \(!attempt\) throw new Error\("package_not_approvable"\)/);
  assert.doesNotMatch(packages, /if \(attempt\) ids\.push\(attempt\.id\)/);
  assert.match(dispatch, /c\.authorization_mode='review_each'/);
  assert.match(dispatch, /p\.recipient_record->>'disposition'='auto_eligible'/);
  assert.match(dispatch, /nullif\(p\.recipient_record->>'employerDomainRelationship',''\) is not null/);
  assert.match(dispatch, /jsonb_array_length\(candidate->'warnings'\)=0/);
  const migration = source("db/migrations/043_application_daily_hard_cap.sql");
  assert.match(migration, /authorization_mode = 'review_each'/);
  assert.match(migration, /approval\.authorization_mode = 'review_each' and approval\.actor = 'user'/);
  assert.match(migration, /recipient_record->>'disposition' <> 'auto_eligible'/);
  assert.match(migration, /nullif\(package_row\.recipient_record->>'employerDomainRelationship', ''\) is null/);
  assert.match(migration, /jsonb_array_length\(candidate->'warnings'\) = 0/);
  // The integrity fixture builds the recipient record from the snapshot it is
  // pinned to, so the source-backed shape is asserted against that construction
  // rather than against a hand-written JSON literal.
  assert.match(databaseTest, /'disposition', 'auto_eligible'/);
  assert.match(databaseTest, /'employerDomainRelationship', 'example\.test'/);
  assert.match(databaseTest, /'candidates', jsonb_build_array\(jsonb_build_object\('email','jobs@example\.test','warnings',jsonb_build_array\(\)\)\)/);
  assert.match(databaseTest, /'recipient', 'source_backed'/);
  assert.match(databaseTest, /'emailInstruction', 'explicit'/);
});

test("durable workflow rows are reconciled after immediate enqueue failures", () => {
  const scheduler = source("lib/jobs-workflow/scheduler.ts");
  const packages = source("lib/jobs-workflow/packages.ts");
  const digests = source("lib/jobs-workflow/digests.ts");
  const mailboxWorker = source("worker/mailbox-dispatch.ts");
  const notificationWorker = source("worker/notification-outbox.ts");

  assert.match(scheduler, /a\.status='queued'/);
  assert.match(scheduler, /a\.status='retryable'/);
  assert.match(scheduler, /o\.status='pending'/);
  assert.match(scheduler, /o\.status='claimed'/);
  assert.match(scheduler, /enqueueNotification/);
  assert.match(packages, /approval enqueue failed; scheduler will reconcile/);
  assert.match(digests, /scheduler will reconcile/);
  assert.match(mailboxWorker, /process\.exit\(1\)/);
  assert.match(notificationWorker, /process\.exit\(1\)/);
});

test("in-app notifications use immutable publications, bounded lazy fan-out, and private state", () => {
  const migration = source("db/migrations/049_in_app_notifications.sql");
  const domain = source("lib/notifications.ts");
  const userApi = source("app/api/notifications/route.ts");
  const preferencesApi = source("app/api/notifications/preferences/route.ts");
  const adminApi = source("app/api/admin/notifications/route.ts");
  const deletion = source("lib/db.ts");

  assert.match(migration, /notification_publication_versions/);
  assert.match(migration, /published notification versions are immutable/);
  assert.match(migration, /notification state is monotonic/);
  assert.match(migration, /primary key \(user_id, publication_version_id\)/);
  assert.match(domain, /NOTIFICATION_PAGE_SIZE_MAX = 50/);
  assert.match(domain, /on conflict \(user_id,publication_version_id\) do nothing/);
  assert.match(domain, /preference_category='essential'/);
  assert.match(userApi, /currentUser\(\)/);
  assert.match(userApi, /sameOriginRequest/);
  assert.match(preferencesApi, /sameOriginRequest/);
  assert.match(adminApi, /requireAdminPermission\(permission\)/);
  assert.match(adminApi, /mutationOriginAllowed/);
  assert.match(adminApi, /notification_publication_changed/);
  assert.match(deletion, /delete from notification_user_states where user_id=\$1/);
  assert.match(deletion, /delete from notification_preferences where user_id=\$1/);
});

test("communications use a separate consent-aware outbox with an irreversible provider boundary", () => {
  const migration = source("db/migrations/050_compliant_communications_outbox.sql");
  const domain = source("lib/communications.ts");
  const worker = source("worker/communications-outbox.ts");
  const adminApi = source("app/api/admin/communications/route.ts");
  const preferencesApi = source("app/api/communications/preferences/route.ts");
  const unsubscribeApi = source("app/api/communications/unsubscribe/route.ts");
  const deletion = source("lib/account-deletion.ts");

  assert.match(migration, /does not\s+-- reuse the Jobs notification_outbox|does not reuse the Jobs notification_outbox/);
  assert.match(migration, /communication_campaign_versions/);
  assert.match(migration, /communication_suppressions/);
  assert.match(migration, /communication_attempts/);
  assert.match(migration, /ordinal integer not null default 1 check \(ordinal=1\)/);
  assert.match(migration, /transport_mode text not null default 'disabled'/);
  assert.match(migration, /globally_paused boolean not null default true/);
  assert.match(domain, /product_updates_enabled boolean|product_updates_enabled/);
  assert.match(domain, /on conflict \(campaign_version_id,email_fingerprint\) do nothing/);
  assert.match(domain, /startCommunicationAttempt/);
  assert.match(domain, /withTransaction\(reserve\)/);
  assert.match(domain, /set user_id=null,recipient_email=null where user_id=\$1/);
  assert.match(migration, /recipient_email text check \(recipient_email is null/);
  assert.match(domain, /outcome: "provider_accepted" \| "failed" \| "unknown"/);
  assert.match(worker, /reserveCommunicationThrottle/);
  assert.match(worker, /outcome:"unknown"/);
  assert.match(worker, /createCommunicationUnsubscribeToken/);
  assert.match(adminApi, /requireAdminPermission\(permission\)/);
  assert.match(adminApi, /mutationOriginAllowed/);
  assert.match(adminApi, /communication_campaign_changed/);
  assert.match(adminApi, /@example\\\.test\$/);
  assert.match(preferencesApi, /mutationOriginAllowed/);
  assert.match(unsubscribeApi, /unsubscribeCommunication/);
  assert.match(deletion, /cancelUserCommunications/);
});

test("CI runs the complete quality gate on every change", () => {
  const workflow = source(".github/workflows/ci.yml");
  const packageJson = JSON.parse(source("package.json")) as {
    scripts?: Record<string, string>;
  };
  const databaseTest = source("scripts/verify-db-integrity.ts");

  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /ROUTE_AUDIT_MUTATIONS=true npm run audit:routes/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /pgvector\/pgvector:pg16/);
  assert.match(workflow, /npm run test:db/);
  assert.doesNotMatch(packageJson.scripts?.["test:seo"] ?? "", /^SITE_URL=/);
  assert.equal(packageJson.scripts?.["test:db"], "tsx scripts/verify-db-integrity.ts");
  assert.match(databaseTest, /spendCredit/);
  assert.match(databaseTest, /refundGenerationCredit/);
  assert.match(databaseTest, /activateStudentOffer/);
  assert.match(databaseTest, /deleteUserAccountData/);
  assert.match(databaseTest, /saveResume/);
});

// systemd's Restart=always only reacts to the process exiting. The outage this
// repo actually had was the opposite shape: process alive, every request
// hanging, systemd perfectly happy. Nothing restarted it.
test("a hung web process gets restarted, not only a crashed one", () => {
  const watchdog = source("scripts/watchdog.sh");
  const unit = source("deploy/rolesharp-watchdog.service");
  const timer = source("deploy/rolesharp-watchdog.timer");
  const deploy = source("deploy.sh");

  assert.match(watchdog, /curl -fsS -m "\$TIMEOUT"/);
  assert.match(watchdog, /systemctl restart "\$UNIT"/);
  // Without a cooldown a service that cannot start becomes a restart loop that
  // destroys the evidence of why it could not start.
  assert.match(watchdog, /COOLDOWN:-600/);
  assert.match(watchdog, /now - last.*-lt "\$COOLDOWN"/);
  assert.match(unit, /ExecStart=\/opt\/resume-ai\/current\/scripts\/watchdog\.sh/);
  assert.match(timer, /OnUnitActiveSec=2min/);

  // Shipped is not installed: the deploy has to place both units, make the
  // script executable, and start the timer.
  assert.match(deploy, /rolesharp-watchdog\.service \/etc\/systemd\/system/);
  assert.match(deploy, /rolesharp-watchdog\.timer \/etc\/systemd\/system/);
  assert.match(deploy, /chmod 0755 '\$RELEASE'\/scripts\/watchdog\.sh/);
  assert.match(deploy, /systemctl enable --now rolesharp-watchdog\.timer/);
});

// The VPS runs node 22.22.2 and CI pins 22, but this machine built and tested
// on 24.18.1 all session. Nothing caught that, so pin it somewhere a version
// manager reads and assert the two never drift apart again.
test("the node version is pinned to what CI and the VPS actually run", () => {
  const pinned = source(".nvmrc").trim();
  const workflow = source(".github/workflows/ci.yml");
  assert.match(pinned, /^\d+$/);
  const inCi = [...workflow.matchAll(/node-version:\s*['"]?(\d+)/g)].map((m) => m[1]);
  assert.ok(inCi.length > 0, "CI must pin a node version");
  for (const version of inCi) {
    assert.equal(version, pinned, `.nvmrc says ${pinned} but CI runs ${version}`);
  }
});

// Company autocomplete scanned all 113,113 rows on every keystroke because
// pg_trgm's indexes cannot serve similarity(a, b) > x -- only the % operator.
test("company search keeps its trigram prefilters and cannot leak the threshold", () => {
  const companies = source("lib/db/companies.ts");
  const core = source("lib/db/core.ts");

  // Every fuzzy branch is % (indexable) AND the exact test (authoritative).
  assert.match(companies, /name % \$2 and similarity\(name, \$2\)/);
  assert.match(companies, /regexp_replace\(slug, '\^\[a-z\]\{2\}-', ''\) % \$[45]\s*\n?\s*and similarity/);
  assert.doesNotMatch(companies, /or similarity\(name, \$\d\) >/);

  // The threshold % compares against must be the lowest the search uses, or the
  // prefilter stops being a superset and silently drops real matches.
  assert.match(companies, /Math\.min\(nameThreshold, slugThreshold\)/);
  // set_config(..., true) is transaction-local: a pooled connection must not
  // hand the next borrower a threshold this search chose.
  assert.match(companies, /set_config\('pg_trgm\.similarity_threshold', \$1, true\)/);
  assert.match(companies, /withTransaction/);
  assert.match(core, /pg_trgm\.similarity_threshold=0\.16/);
});

test("production refuses to boot on the published fallback AUTH_SECRET", () => {
  // LOCAL_DEV_MODE used to excuse a missing AUTH_SECRET in production, and the
  // fallback is the literal string "dev-insecure-secret-change-me" in lib/env.ts
  // — which derives the JWE key, so it would let anyone mint a session cookie
  // for any account. One misplaced flag on the box was the whole distance
  // between "encrypted sessions" and "no sessions at all".
  const base = { NODE_ENV: "production", SITE_URL: "https://rolesharp.com" } as const;
  assert.throws(() => loadEnvironment({ ...base, LOCAL_DEV_MODE: "true" }), /AUTH_SECRET/);
  assert.throws(() => loadEnvironment({ ...base, LOCAL_DEV_MODE: "false" }), /AUTH_SECRET/);
  assert.throws(() => loadEnvironment({ ...base }), /AUTH_SECRET/);
  // A real secret still boots, with or without the flag set.
  assert.equal(loadEnvironment({ ...base, DISABLE_DB: "true", AUTH_SECRET: "x".repeat(48) }).authSecret, "x".repeat(48));
  assert.throws(() => loadEnvironment({ ...base, AUTH_SECRET: "x".repeat(48) }), /DATABASE_URL/);
  // Non-production keeps the convenience fallback.
  assert.equal(loadEnvironment({ NODE_ENV: "development" as const }).authSecret, "dev-insecure-secret-change-me");
});

test("logout revokes the session server-side, not just in the browser", () => {
  const auth = source("lib/auth.ts");
  // A sid is minted per login and must be threaded through the sliding refresh.
  // If setSession minted a fresh sid on every refresh, a token captured before
  // a refresh would carry a sid that logout never revokes and would outlive the
  // logout entirely — which is the bug this closes, reintroduced.
  assert.match(auth, /const sid = sessionId \?\? randomBytes\(16\)/);
  assert.match(auth, /setSession\(u\.id, u\.email, sa \|\| nowSec, u\.auth_version, sid \|\| undefined\)/);
  // clearSession records the sid rather than only expiring the cookie.
  assert.match(auth, /insert into revoked_sessions \(session_id, expires_at\)/);
  // currentUser refuses a revoked sid, and does so in the query it already ran
  // rather than adding a second round trip to every authenticated request.
  assert.match(auth, /exists\(select 1 from revoked_sessions r where r\.session_id=\$2\) as revoked/);
  assert.match(auth, /if \(u\.revoked\) return null;/);
  // The revocation write must not be able to fail the logout: a database blip
  // that threw here would leave the user still logged in.
  assert.match(auth, /session revocation failed/);
});

test("scrypt cost parameters are pinned, and old hashes still verify", async () => {
  const { hashPassword, verifyPassword } = await import("../lib/auth");
  const { scryptSync } = await import("node:crypto");
  // Pinning must not have changed the derivation: every password hash and the
  // JWE key in production were produced under Node's defaults. A hash built the
  // old way has to keep verifying, or pinning silently locks every user out.
  const salt = "a".repeat(32);
  const legacy = `${salt}:${scryptSync("correct horse", salt, 64).toString("hex")}`;
  assert.equal(verifyPassword("correct horse", legacy), true);
  assert.equal(verifyPassword("wrong horse", legacy), false);
  assert.equal(verifyPassword("correct horse", hashPassword("correct horse")), true);
  assert.match(source("lib/auth.ts"), /const SCRYPT = \{ N: 16384, r: 8, p: 1/);
});

test("the rate-limit counter can never exist without its expiry", () => {
  const limiter = source("lib/rate-limit.ts");
  // INCR then EXPIRE as two round trips leaves a permanent counter behind if
  // anything interrupts between them — that IP is then locked out of that
  // action forever, with no TTL to recover from. One script, one atomic step.
  assert.match(limiter, /connection\.eval\(/);
  assert.match(limiter, /local n = redis\.call\('INCR', KEYS\[1\]\)/);
  assert.doesNotMatch(limiter, /connection\.incr\(/);
  assert.doesNotMatch(limiter, /connection\.expire\(/);
});

test("retention purge covers every window the product promises in writing", () => {
  const purge = source("scripts/retention-purge.ts");
  // Each of these was already stated as fact — in a migration comment or, for
  // the outbox, in the privacy policy users are shown — and none of them
  // deleted a row until this script existed.
  for (const [table, window] of [
    ["page_views", "90 days"],
    ["product_events", "60 days"],
    ["email_log", "90 days"],
    ["ipn_quarantine", "180 days"],
  ] as const) {
    assert.match(purge, new RegExp(`"${table}", "${table}", "[^"]*${window}`));
  }
  // Both outbox tables carry purge_after; only one was named in the audit.
  assert.match(purge, /"notification_outbox", "notification_outbox", "purge_after is not null and purge_after < now\(\)"/);
  assert.match(purge, /"communication_recipients", "communication_recipients", "purge_after is not null and purge_after < now\(\)"/);
  // Unbounded DELETEs over months of analytics rows hold one long transaction
  // and block autovacuum; batching keeps each step short and resumable.
  assert.match(purge, /limit \$\{BATCH\}/);
  // A script nobody schedules is how the previous promises went unkept.
  assert.match(source("deploy.sh"), /retention-purge/);
});

test("an owed credit refund outlives a database outage", () => {
  const workerSource = source("worker/index.ts");
  const queueSource = source("lib/queue.ts");

  // The failed-handler used to retry the refund inline three times over ~3
  // seconds and then log and give up. The generation job carries
  // removeOnFail: true, so giving up erased the only record that a credit was
  // owed — a Postgres restart longer than three seconds destroyed paid credits
  // with nothing left to reconcile from. The debt now goes to Redis, which the
  // worker cannot be running without.
  assert.doesNotMatch(workerSource, /refundWithRetry/);
  assert.match(workerSource, /creditRefundQueue\s*\n?\s*\.add\("refund"/);
  assert.match(queueSource, /new Queue\("credit-refund"/);

  // Redelivery must collapse onto one refund, not queue a second.
  assert.match(workerSource, /jobId: `refund:\$\{resumeId\}`/);

  // A refund that exhausts every attempt has to remain as evidence. This is the
  // exact flag whose `true` on the generation queue caused the original loss.
  assert.match(queueSource, /CREDIT_REFUND_JOB_OPTS[\s\S]{0,400}?removeOnFail: false/);
  assert.match(queueSource, /CREDIT_REFUND_JOB_OPTS[\s\S]{0,400}?attempts: 12/);

  // The refund worker must throw on failure — that is what makes BullMQ retry
  // on the backoff schedule rather than marking the job complete.
  assert.match(workerSource, /new Worker<\{ userId: string; resumeId: string \}>\(\s*\n?\s*"credit-refund"/);
  assert.doesNotMatch(workerSource, /refundGenerationCredit\([^)]*\)\.catch/);

  // A restart must drain the refund worker too, or SIGTERM reintroduces the
  // same loss through the shutdown path instead of the outage path.
  assert.match(workerSource, /await refundWorker\.close\(\)/);
  assert.match(workerSource, /void refundWorker\.disconnect\(\)/);
});

test("both mail transports carry Reply-To, so support answers the sender", () => {
  const mail = source("lib/email.ts");
  // The Cloudflare REST body used to be to/from/subject/text/html only. Contact
  // replies (app/api/contact/route.ts) and campaigns (lib/communications.ts)
  // both set replyTo, so switching transports silently redirected every reply
  // to SMTP_FROM. REST spells it reply_to; the camelCase Workers spelling is
  // rejected as an invalid request schema.
  assert.match(mail, /\.\.\.\(mail\.replyTo \? \{ reply_to: mail\.replyTo \} : \{\}\)/);
  assert.doesNotMatch(mail, /replyTo: mail\.replyTo,\s*\n\s*subject/);
  // The SMTP path already had it; both must keep it.
  assert.match(mail, /replyTo: mail\.replyTo,/);
});

test("the data export is scoped to the caller and carries no credentials", () => {
  const exporter = source("lib/account-export.ts");
  const route = source("app/api/account/export/route.ts");

  // Every read is scoped by the caller's own id, and no id is accepted from the
  // request — there is no reference to make an insecure direct object one.
  assert.doesNotMatch(route, /searchParams\.get|params\./);
  assert.match(route, /const user = await currentUser\(\);/);
  assert.match(route, /if \(!user\) return NextResponse\.json\(\{ error: "login_required" \}/);

  // `select *` would hand the user their own password_hash, auth_version, and
  // any secret a future migration adds. Columns stay explicit. Checked against
  // the SQL only — the doc comment above it necessarily names the things it is
  // explaining the absence of.
  const sql = exporter.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(sql, /select \*/iu);
  for (const secret of ["password_hash", "auth_version", "refresh", "token"]) {
    assert.doesNotMatch(sql, new RegExp(secret, "iu"), `export must not select ${secret}`);
  }

  // An account export is the most expensive read an authenticated user can ask
  // for, and must never sit in a shared cache.
  assert.match(route, /rateLimit\(req, "account-export"/);
  assert.match(route, /"Cache-Control": "private, no-store"/);

  // An endpoint nobody can find does not satisfy a portability promise.
  assert.match(source("app/settings/panels/security.tsx"), /href="\/api\/account\/export"/);
});

test("a worker that dies mid-send leaves a row that can still be resolved", () => {
  const recovery = source("lib/jobs-workflow/stuck-send-recovery.ts");
  const scheduler = source("lib/jobs-workflow/scheduler.ts");

  // The scheduler selects 'pending' and lease-expired 'claimed' and never
  // 'sending', so a row stranded there was invisible to it forever. For
  // communications it was worse than a stall: communication_attempts is unique
  // per recipient and inserted `on conflict do nothing`, so a stuck attempt
  // permanently blocked that recipient from ever being sent to again.
  assert.match(scheduler, /await recoverStuckSends\(\)/);
  for (const table of ["notification_outbox", "communication_recipients", "communication_attempts"]) {
    assert.match(recovery, new RegExp(`update ${table}`), `${table} needs a recovery path`);
  }

  // Resolved to terminal 'unknown', never retried: the provider call may have
  // succeeded before the process died, so a resend risks double-sending a real
  // email. This codebase already treats provider success as acceptance rather
  // than delivery and offers no resend for an unknown outcome.
  assert.match(recovery, /status='unknown'/);
  assert.doesNotMatch(recovery, /status='pending'|status='retryable'|status='queued'/);

  // Terminal rows must satisfy the tables' own checks, which demand terminal_at
  // and purge_after = terminal_at + 30 days, and classification = status.
  assert.match(recovery, /terminal_at=now\(\), purge_after=now\(\) \+ interval '30 days'/);
  assert.match(recovery, /classification='unknown'/);
  // communication_attempts requires finished_at exactly when it leaves 'sending'.
  assert.match(recovery, /status='unknown', finished_at=now\(\)/);
});

test("admin list sorting is an allowlist, and happens in SQL", () => {
  const route = source("app/api/admin/users/route.ts");
  // `sort` comes from the query string straight into an ORDER BY, where no
  // amount of parameterisation helps. It must be looked up in a fixed map and
  // fall back, never concatenated.
  assert.match(route, /const SORTABLE: Record<string, string> = \{/);
  assert.match(route, /SORTABLE\[sp\.get\("sort"\) \?\? ""\] \?\? "u\.created_at"/);
  assert.match(route, /sp\.get\("dir"\) === "asc" \? "asc" : "desc"/);
  assert.doesNotMatch(route, /order by \$\{sp\.get/);
  // Equal values must not let a row appear on two pages while another appears
  // on none.
  assert.match(route, /nulls last, u\.id desc/);

  // Sorting a server-paginated list on the client would order the 20 rows on
  // screen and look right while being wrong, so the UI has to send it up.
  const view = source("app/admin/views/users-view.tsx");
  assert.match(view, /&sort=\$\{sort\.column\}&dir=\$\{sort\.dir\}/);
  assert.match(view, /\}, \[query, plan, sort\]\);/);
  // aria-sort belongs on the th, and the control must be a real button.
  const header = source("app/admin/sortable-header.tsx");
  assert.match(header, /aria-sort=\{active \?/);
  assert.match(header, /<button/);
});

test("admin views confirm a save, not just a failure", () => {
  // All six reported errors and stayed silent on success, so an operator could
  // not tell a save from a no-op.
  for (const name of ["staff", "feature-access", "offers", "notifications", "communications", "legal"]) {
    const view = source(`app/admin/views/${name}-view.tsx`);
    assert.match(view, /const \[saved, setSaved\] = useState\(""\);/, `${name} has no success state`);
    assert.match(view, /setSaved\("Change saved\."\)/, `${name} never announces success`);
    assert.match(view, /saved && !error/, `${name} does not render the confirmation`);
  }
});

// ---- F-02: promo discount floor + invoice price-mismatch (2026-10 audit) ----

test("promo discounts can never mint a zero-dollar invoice", async () => {
  const { applyDiscount } = await import("../lib/promo-codes");
  const floor = 100; // $1.00
  assert.equal(applyDiscount(1200, { valid: true, amountOffCents: 1200 } as never), floor);
  assert.equal(applyDiscount(1200, { valid: true, percentageOff: 100 } as never), floor);
  assert.equal(applyDiscount(1200, { valid: true, percentageOff: 50 } as never), 600);
  assert.equal(applyDiscount(50, { valid: true } as never), floor, "sub-dollar price floors too");
});

test("recoverable invoices refuse to reuse a row priced differently than the request", () => {
  const src = source("lib/crypto-payments.ts");
  // The reuse branch must read the stored price and compare it to the plan's
  // current cents, voiding on mismatch — otherwise a promo applied between
  // visits makes the user pay the stale, undiscounted amount.
  assert.match(src, /price_amount/);
  assert.match(src, /Number\(existing\.price_amount/);
  assert.match(src, /status='cancelled'/);
});

// ---- F-03: verify-email cannot silently replace another account's session ----

test("email verification guards against cross-account session overwrite", () => {
  const src = source("app/api/auth/verify-email/route.ts");
  // HEAD preflight mutates nothing (link checkers send HEAD first).
  assert.match(src, /req\.method === "HEAD"/);
  // A verification link clicked while signed in as a DIFFERENT user must not
  // overwrite that session (login CSRF on shared machines).
  assert.match(src, /existing\.id !== verified\.user_id/);
  assert.match(src, /verified=conflict/);
});

// ---- F-06: the GDPR export covers every table the account owns ----

test("account export includes all owner-facing data stores", () => {
  const src = source("lib/account-export.ts");
  // 2026-10 audit: personal_sites, job_alerts, tool_runs, user_job_preferences,
  // social_reward_claims, promo_redemptions, legal_acceptances, and the
  // support thread bodies were all missing from the export.
  for (const table of ["personal_sites", "job_alerts", "tool_runs", "user_job_preferences", "social_reward_claims", "promo_redemptions", "legal_acceptances", "support_messages"]) {
    assert.ok(src.includes(`from ${table}`), `export is missing ${table}`);
  }
  // Capability credentials never travel in the export file.
  assert.doesNotMatch(src, /select id, role_keyword[^"]*unsubscribe_token/);
  assert.match(src, /exportFormat: "rolesharp\.account-export\.v2"/);
});

// ---- F-08: interview state in Redis dies with the account ----

test("account deletion purges interview-practice Redis keys", () => {
  const src = source("lib/account-deletion.ts");
  // Sessions (7d TTL), burn markers and monthly counters (40d TTL) live only
  // in Redis — Postgres deletion cannot reach them.
  assert.match(src, /ivw:\$\{userId\}:\*/);
  assert.match(src, /interview_redis_cleanup/);
});

// ---- F-10: the OG score card is rate-limited and CDN-cacheable ----

test("score card endpoint is rate-limited and cacheable", () => {
  const src = source("app/score-card/route.tsx");
  assert.match(src, /rateLimit\(req, "score-card"/);
  assert.match(src, /Cache-Control.*public, max-age=86400/);
});

// ---- F-05: hero/topbar links resolve and the closed student program hides ----

test("landing promotional links resolve to real surfaces", () => {
  const hero = source("components/marketing/ModernHeroAndMethod.tsx");
  const topbar = source("components/marketing/SmartTopBar.tsx");
  // The referral pill pointed at /settings/credits, which has never been a
  // route — the credits tab is /settings?tab=credits.
  assert.match(hero, /href="\/settings\?tab=credits"/);
  assert.doesNotMatch(hero, /\/settings\/credits/);
  // The social CTA must land on the page that hosts the claim modal.
  assert.match(topbar, /href: "\/social-rewards"/);
  // The student pill renders only while the program is open.
  assert.match(hero, /studentOfferEnabled/);
  assert.match(source("app/page.tsx"), /<ModernHeroAndMethod studentOfferEnabled=\{env\.studentOfferEnabled\} \/>/);
});

// ---- F-01: student copy and the DOCX contradiction ----

test("student plan copy no longer claims editable Word export", () => {
  const src = source("app/students/page.tsx");
  assert.match(src, /except editable Word export/);
  const docxClaims = src.match(/every Premium feature(?!\s+except)/g) ?? [];
  assert.equal(docxClaims.length, 0, "unqualified 'every Premium feature' claim remains");
});

// ---- Deploy-2 batch: backup streaming, RBAC, unsubscribe hygiene ----

test("database backups stream via the root helper, not the web process", () => {
  const route = source("app/api/admin/backup/route.ts");
  // The 512MB maxBuffer pg_dump ran inside the shared web service — an OOM
  // lever on every user request. The dump now belongs to the root daemon.
  assert.doesNotMatch(route, /maxBuffer/);
  assert.doesNotMatch(route, /pg_dump/);
  assert.match(route, /opsRequest\(\{ action: "backup" \}\)/);

  const helper = source("scripts/ops-helper.mjs");
  // The privileged socket daemon delegates archive bytes and the encryption
  // secret to a root-only backup executable. Its only contract is bounded
  // execution and a strict JSON result.
  assert.match(helper, /"backup"/);
  assert.match(helper, /rolesharp-postgres-backup/);
  assert.match(helper, /BACKUP_TIMEOUT_MS/);
  assert.doesNotMatch(helper, /createWriteStream/);

  const backup = source("scripts/backup-postgres.sh");
  assert.match(backup, /--symmetric/);
  assert.match(backup, /pg_restore -l/);
  assert.match(backup, /chmod 0600/);
});

test("analytics and health internals require scoped permissions, not the blanket admin cookie", () => {
  assert.match(source("app/api/analytics/route.ts"), /hasAdminPermission\("analytics\.read"\)/);
  assert.match(source("app/api/health/route.ts"), /hasAdminPermission\("system\.read"\)/);
  const health = source("app/api/health/route.ts");
  assert.doesNotMatch(health, /from "@\/lib\/auth";\s*\n.*isAdmin/u);
});

test("job-alerts unsubscribe keeps GET for humans, adds RFC 8058 POST, and never trusts the Host header", () => {
  const route = source("app/api/job-alerts/unsubscribe/route.ts");
  // Redirect base is the configured site URL — a forged Host header must not
  // steer an unsubscribed user off-domain.
  assert.match(route, /env\.siteUrl/);
  assert.doesNotMatch(route, /req\.nextUrl\.origin/);
  // RFC 8058 one-click (mail clients POST); the human GET link survives.
  assert.match(route, /export async function POST/);
  // Scanner-prefetch defense: both verbs are rate-limited.
  assert.match(route, /rateLimit/);

  const sender = source("lib/job-alerts.ts");
  assert.match(sender, /List-Unsubscribe-Post/);
  // The bulk transport must carry the headers; nodemailer emits them as SMTP.
  assert.match(source("lib/bulk-mail.ts"), /headers: mail\.headers/);
});

test("the smart topbar dismissal is known before first paint", () => {
  // The pre-paint script sets the attribute; CSS hides the bar before React
  // hydrates, so a dismissed visitor never sees it flash.
  assert.match(source("app/layout.tsx"), /rs-smart-topbar-dismissed/);
  assert.match(source("app/layout.tsx"), /smartTopbarOff/);
  assert.match(source("app/globals.css"), /data-smarttopbar-off\] aside\[aria-label="Announcements and special offers"\]/);
});

// ---- F-02: the origin IP must never live in tracked files ----

test("no tracked documentation or deploy file leaks the origin IP", () => {
  // deploy.sh deliberately withholds the origin address from the repo: the
  // origin sits behind Cloudflare and ufw admits Cloudflare ranges only, so
  // the IP is the one piece of info the hardening is built to withhold.
  // 2026-10-21 audit found it in 22 tracked lines (runbook, handoff,
  // progress history, incident README, archive audit).
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(md|ts|tsx|sh|sql|json|mjs|conf|service)$/.test(entry.name)) {
        if (readFileSync(full, "utf8").includes("107.182.130.75")) offenders.push(full);
      }
    }
  };
  for (const dir of ["deploy", "docs", "db", "scripts"]) walk(dir);
  for (const file of ["ROLESHARP-PROGRESS.md", "deploy.sh"]) {
    if (readFileSync(join(process.cwd(), file), "utf8").includes("107.182.130.75")) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `origin IP leaked in tracked files:\n${offenders.join("\n")}`);
});
