import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { expectNoAxeViolations, expectNoHorizontalOverflow } from "../helpers/accessibility";
import { denyExternalBrowserNetwork } from "../helpers/network-deny";

const evidence = process.env.ACCOUNT_ADMIN_EVIDENCE_ROOT ?? ".omo/evidence/account-admin-workspaces";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installAccountFakes(
  page: Page,
  sessionOverrides: Record<string, unknown> = {},
) {
  await denyExternalBrowserNetwork(page);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/me") return json(route, {
      loggedIn: true,
      email: "member@example.test",
      emailVerified: true,
      hasPassword: true,
      premium: false,
      premiumUntil: null,
      limit: 3,
      used: 1,
      remaining: 2,
      credits: 2,
      plans: [{ id: "monthly", label: "Monthly", price: 12, days: 30 }, { id: "yearly", label: "Yearly", price: 79, days: 365 }],
      ...sessionOverrides,
    });
    if (path === "/api/resumes") return json(route, [{
      id: "10000000-0000-4000-8000-000000000001",
      candidate_name: "Alex Rivera",
      headline: "Product Designer",
      role_title: "Senior Product Designer",
      company_name: "Example Studio",
      created_at: "2026-08-01T01:00:00.000Z",
      ats_score: 91,
      premium_unlock: false,
    }, {
      id: "10000000-0000-4000-8000-000000000002",
      candidate_name: "Alex Rivera",
      headline: "UX Designer",
      created_at: "2026-07-30T01:00:00.000Z",
      ats_score: 84,
      premium_unlock: true,
    }]);
    if (path === "/api/applications" && request.method() === "GET") return json(route, { applications: [{
      id: "20000000-0000-4000-8000-000000000001",
      company: "Example Studio",
      role: "Product Designer",
      status: "interview",
      job_url: "https://careers.example.test/jobs/1",
      notes: "Portfolio interview",
      follow_up_at: "2026-07-31T09:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    }, {
      id: "20000000-0000-4000-8000-000000000002",
      company: "Northstar",
      role: "UX Designer",
      status: "applied",
      follow_up_at: null,
      updated_at: "2026-07-31T00:00:00.000Z",
    }], nextCursor: null });
    if (path === "/api/campaigns") return json(route, { campaigns: [{
      id: "30000000-0000-4000-8000-000000000001", mode: "daily_matches", status: "active",
    }, {
      id: "30000000-0000-4000-8000-000000000002", mode: "role_apply", status: "paused",
    }] });
    if (path === "/api/daily-matches") return json(route, { matches: [
      { id: "40000000-0000-4000-8000-000000000001", status: "eligible" },
      { id: "40000000-0000-4000-8000-000000000002", status: "eligible" },
    ] });
    if (path === "/api/application-packages") return json(route, { packages: [{
      id: "50000000-0000-4000-8000-000000000001", status: "review_required",
    }] });
    if (path === "/api/application-attempts") return json(route, { attempts: [{
      id: "60000000-0000-4000-8000-000000000001",
      package_id: "50000000-0000-4000-8000-000000000001",
      status: "unknown",
      subject: "Application for Product Designer",
      recipient_record: { email: "jobs@example.test" },
      provider: "google",
      source_url: "https://careers.example.test/jobs/1",
    }, {
      id: "60000000-0000-4000-8000-000000000002",
      package_id: "50000000-0000-4000-8000-000000000002",
      status: "provider_accepted",
      subject: "Application for UX Designer",
      recipient_record: { email: "talent@example.test" },
      provider: "google",
      source_url: "https://careers.example.test/jobs/2",
    }] });
    if (path === "/api/mail-connections") return json(route, { connections: [{
      id: "70000000-0000-4000-8000-000000000001",
      provider: "google",
      verified_sender: "member@example.test",
      status: "active",
    }] });
    if (path === "/api/support") return json(route, { tickets: [{
      id: "80000000-0000-4000-8000-000000000001",
      subject: "Export question",
      status: "open",
      last_actor: "admin",
      message_count: 2,
      created_at: "2026-07-30T00:00:00.000Z",
    }] });
    if (path === "/api/account/billing") return json(route, { payments: [] });
    return json(route, { error: `unregistered_fake:${request.method()}:${path}` }, 599);
  });
}

async function installAdminFakes(page: Page, options: { analyticsMode?: "ok" | "partial" | "error"; permissions?: string[]; breakGlass?: boolean } = {}) {
  await denyExternalBrowserNetwork(page);
  const analyticsMode = options.analyticsMode ?? "ok";
  await page.route("**/api/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/admin/session") return json(route, {
      authenticated: true,
      // Without `principal` the console throws on
      // sessionData.principal.permissions and renders its "could not finish
      // loading" boundary, which masks every view assertion below.
      principal: {
        staffAccountId: "4a000000-0000-4000-8000-000000000001",
        email: "admin@example.test",
        displayName: "QA Admin",
        roles: ["owner"],
        permissions: options.permissions ?? [
          "access.manage", "access.read", "admin.access", "analytics.export", "analytics.read",
          "break_glass.manage", "communications.edit", "communications.publish", "communications.read",
          "content.edit", "content.publish", "content.read", "flags.manage", "jobs.manage", "jobs.read",
          "legal.edit", "legal.publish", "legal.read", "mail.read", "notifications.edit",
          "notifications.publish", "notifications.read", "offers.edit", "offers.publish", "offers.read",
          "payments.manage", "payments.read", "security.manage", "security.read", "staff.manage",
          "staff.read", "support.manage", "support.read", "system.manage", "system.read",
          "users.manage", "users.read",
        ],
        authenticationMethod: "google",
        breakGlass: options.breakGlass ?? false,
      },
      environment: { label: "Local QA", nodeEnvironment: "production", isProduction: false, localDevMode: true },
      navigation: { openTickets: 4, pendingReports: 2, pendingStudents: 1, pendingAccessRequests: 3, monitored: true },
      generatedAt: "2026-08-01T02:00:00.000Z",
    });
    // Fetched immediately after the session whenever the principal holds
    // analytics.read, which the principal above does.
    if (path === "/api/admin/stats") return json(route, {
      totals: {}, system: {}, health: {}, support: {}, students: {}, internshipReports: {},
      topRoles: [], topCompanies: [], payments: {}, adminActions: [], recentSlow: [],
      recentUsers: [], recentResumes: [], recentPayments: [], perDay: [],
    });
    if (path === "/api/admin/jobs-workflows/health") return json(route, {
      operationalState: "disabled",
      safetyLock: { workflowsDisabled: true, gmailSendingDisabled: true, microsoftSendingDisabled: true },
      readiness: { namespace: "qa", tokenEncryption: true, workflowsEnabled: false, gmail: true, microsoft: true, callbackOrigins: true },
      controls: {
        workflows: { explicitlyConfigured: true, enabled: false },
        gmailSend: { explicitlyConfigured: true, enabled: false },
        microsoftSend: { explicitlyConfigured: true, enabled: false },
      },
      flags: { jobs_daily_matches: false, role_apply_prepare: false, role_apply_gmail_send: false, role_apply_microsoft_send: false },
      database: { schemaReady: true, resources: {
        workItems: { available: true, rows: [{ status: "completed", count: 12, oldest_at: "2026-07-30T00:00:00.000Z" }] },
        attempts: { available: true, rows: [{ status: "unknown", count: 1, oldest_at: "2026-08-01T00:00:00.000Z" }] },
        outbox: { available: true, rows: [] },
        connections: { available: true, rows: [{ provider: "google", status: "active", count: 3, oldest_at: "2026-07-20T00:00:00.000Z" }] },
      } },
      warnings: [{ code: "application_attempts_attention", message: "1 application attempt needs operator review. Unknown outcomes must never be resent automatically.", level: "danger" }],
      generatedAt: "2026-08-01T02:00:00.000Z",
    });
    if (path === "/api/admin/flags") return json(route, { flags: [
      { name: "jobs_daily_matches", enabled: false, description: "Show reviewed Daily Matches to eligible users.", updated_at: "2026-08-01T01:30:00.000Z" },
      { name: "role_apply_prepare", enabled: false, description: "Prepare immutable application packages for review.", updated_at: "2026-08-01T01:30:00.000Z" },
      { name: "resume_builder_v2", enabled: true, description: "Use the current guided resume builder.", updated_at: "2026-07-28T01:30:00.000Z" },
    ] });
    if (path === "/api/admin/pricing") return json(route, { envPricing: {
      freeLimit: 3, premiumLimit: 10, monthlyCents: 1200, yearlyCents: 7900, daysMonthly: 30, daysYearly: 365,
    } });
    if (path === "/api/admin/analytics") {
      if (analyticsMode === "error") return json(route, { error: "temporary" }, 503);
      return json(route, {
        traffic: analyticsMode === "partial" ? null : { today: { views: 12, visitors: 4 }, last7Days: { views: 40, visitors: 18 }, last30Days: { views: 100, visitors: 44 }, weekChange: 4, dailyTrend: [], hourly: [], topPages: [], countries: [], devices: [], referrers: [] },
        users: { total: 4, premium: 1, verified: 3, students: 0, conversionRate: "25%", verificationRate: "75%", newToday: 1, newThisWeek: 2, newThisMonth: 4, creditsEarned: 0, creditsSpent: 0, referralsRecent: 0, signupTrend: [] },
        revenue: { totalRevenue: 0, monthlyRevenue: 0, mrr: 0, arr: 0, completedPayments: 0, studentClaims: 0, revenueTrend: [], paymentMethods: [], planBreakdown: [] },
        content: { blogPostsTotal: 0, blogPostsThisMonth: 0, companiesIndexed: 0, rolesIndexed: 0, jobsListed: 0 },
        generation: { totalResumes: 0, generatedToday: 0, generatedThisMonth: 0, avgAtsScore: 0, p95AtsScore: 0, avgSpeed: "-", p95Speed: "-", freeAvgSpeed: "-", premiumAvgSpeed: "-", errors24h: 0, topRoles: [], topCompanies: [] },
        jobs: { total: 0, active: 0, byCountry: [] },
        realtime: { activeVisitors5m: 0, queueWaiting: 0, queueFailed: 0, serverTime: "2026-08-01T02:00:00.000Z" },
        availability: { traffic: { available: analyticsMode !== "partial" }, users: { available: true }, revenue: { available: true }, content: { available: true }, generation: { available: true }, jobs: { available: true }, realtime: { available: true } },
        warnings: analyticsMode === "partial" ? [{ section: "traffic", code: "temporarily_unavailable" }] : [],
        range: { kind: "default", days: 30 },
      });
    }
    if (path === "/api/admin/integrations") return json(route, {
      database: { ok: true }, redis: { ok: true, latency_ms: 4 },
      smtp: { configured: true, production_ready: true }, google_oauth: { configured: true },
      nowpayments: { mode: "live" },
      gemini_keys: { configured: true, provider_count: 2 },
    });
    if (path === "/api/admin/cache") return json(route, { configured: true });
    if (path === "/api/admin/feature-access") return json(route, { total: 1, page: 1, pageSize: 50, grants: [
      {
        id: "9a000000-0000-4000-8000-000000000001",
        user_id: "7b000000-0000-4000-8000-000000000002",
        email: "requester@example.test",
        feature_key: "daily_matches",
        state: "requested",
        daily_cap: null,
        provider_limit: null,
        reason: null,
        risk_notes: null,
        requested_at: "2026-08-01T01:45:00.000Z",
        approved_at: null,
        approved_by_email: null,
        expires_at: null,
        updated_at: "2026-08-01T01:45:00.000Z",
      },
    ] });
    return json(route, { error: `unregistered_admin_fake:${path}` }, 599);
  });
}

test.beforeAll(async () => { await mkdir(evidence, { recursive: true }); });

test("public desktop menus remain selectable and restore focus on Escape", async ({ page }) => {
  await denyExternalBrowserNetwork(page);
  await page.route("**/api/me", (route) => json(route, { loggedIn: false }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const products = page.getByRole("button", { name: "Products" });
  await products.click();
  const menu = page.locator("#desktop-products-nav");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: /Resume Fixer/u })).toBeVisible();

  const triggerBox = await products.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect((menuBox?.y ?? 0) - ((triggerBox?.y ?? 0) + (triggerBox?.height ?? 0))).toBeLessThanOrEqual(1);

  await page.mouse.move(
    (triggerBox?.x ?? 0) + (triggerBox?.width ?? 0) / 2,
    (triggerBox?.y ?? 0) + (triggerBox?.height ?? 0) / 2,
  );
  await page.mouse.move(
    (menuBox?.x ?? 0) + 40,
    (menuBox?.y ?? 0) + 40,
    { steps: 8 },
  );
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: /Resume Fixer/u })).toHaveAttribute("href", "/resume-fixer");
  await expect(menu.getByRole("link", { name: /Check → Tailor → Apply → Track/u })).toHaveAttribute("href", "/#application-journey");

  const jobs = page.getByRole("button", { name: "Jobs" });
  await jobs.click();
  const jobsMenu = page.locator("#desktop-jobs-nav");
  await expect(jobsMenu).toBeVisible();
  await expect(jobsMenu.getByRole("link", { name: /Find Jobs/u })).toHaveAttribute("href", "/jobs");
  await expect(jobsMenu.getByRole("link", { name: /Auto Mail Jobs/u })).toHaveAttribute("href", "/daily-matches");
  await expect(jobsMenu.getByRole("link", { name: /Email-Sending Jobs/u })).toHaveAttribute("href", "/application-queue");
  await expect(page.locator('nav[aria-label="Main navigation"] a[href="/jobs"]')).toHaveCount(1);
  await expect(jobsMenu.locator('a[href="/jobs"]')).toHaveCount(1);
  await jobs.focus();
  await page.keyboard.press("Escape");
  await expect(jobsMenu).toBeHidden();
  await expect(jobs).toBeFocused();

  await products.click();
  await products.focus();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(products).toBeFocused();

  await page.getByRole("button", { name: "Resources" }).click();
  await expect(page.locator("#desktop-resources-nav")).toBeVisible();
  await page.locator("main").click({ position: { x: 8, y: 8 } });
  await expect(page.locator("#desktop-resources-nav")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
});

test("signed-in navigation exposes workspace, account, plan, and support destinations", async ({ page }) => {
  await installAccountFakes(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard");

  // The Workspace dropdown was removed as a duplicate of the workspace tab
  // strip, and /dashboard now reads "Dashboard" on every surface. The strip is
  // where workspace destinations live; the navbar keeps one direct link to it.
  const mainNav = page.locator('nav[aria-label="Main navigation"]');
  // The logo also points at /dashboard when signed in (44c9815), so two
  // "Dashboard"-labelled links live inside the nav; assert the direct link by
  // its exact href match rather than relying on strict-mode uniqueness.
  await expect(mainNav.locator('a.rs-nav-link[href="/dashboard"]')).toHaveAttribute("href", "/dashboard");
  await expect(mainNav.locator("a.rs-nav-brand")).toHaveAttribute("href", "/dashboard");
  await expect(page.getByRole("button", { name: "Workspace" })).toHaveCount(0);

  const workspaceRail = page.getByRole("navigation", { name: "RoleSharp workspace" });
  // The workspace nav is a desktop-only left rail now (1440px viewport here);
  // below lg it does not render and the main navbar covers navigation.
  await expect(workspaceRail).toBeVisible();
  await expect(workspaceRail.getByRole("link", { name: /Application Queue/u })).toHaveAttribute("href", "/application-queue");
  await expect(workspaceRail.getByRole("link", { name: /Tracker/u })).toHaveAttribute("href", "/tracker");

  await page.getByRole("button", { name: "Products" }).click();
  await expect(mainNav.locator('a[href="/auto-apply"]')).toHaveCount(1);

  const account = page.getByRole("button", { name: "Account" });
  await account.click();
  const accountMenu = page.locator("#desktop-account-nav");
  await expect(accountMenu).toBeVisible();
  await expect(accountMenu.getByText("member@example.test", { exact: true })).toBeVisible();
  await expect(accountMenu.getByText("2 of 3 resumes left", { exact: true })).toBeVisible();
  await expect(accountMenu.getByRole("link", { name: "Billing & Access" })).toHaveAttribute("href", "/billing");
  await expect(accountMenu.getByRole("link", { name: /Security/u })).toHaveAttribute("href", "/security");
  await expect(accountMenu.getByRole("link", { name: /Support/u })).toHaveAttribute("href", "/support");
  await expect(accountMenu.getByRole("link", { name: "Upgrade" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
});

test("Premium and mobile navigation present the correct entitlement and complete destinations", async ({ page }) => {
  await installAccountFakes(page, {
    premium: true,
    limit: 10,
    used: 3,
    remaining: 7,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Open menu" }).click();
  const mobileNav = page.locator("#mobile-nav");
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByText("Premium", { exact: true })).toBeVisible();
  await expect(mobileNav.getByText("7 of 10 resumes left", { exact: true })).toBeVisible();
  await mobileNav.getByText("Discover roles, review matches, and manage application email", { exact: true }).click();
  await expect(mobileNav.getByRole("link", { name: /Find Jobs/u })).toHaveAttribute("href", "/jobs");
  await expect(mobileNav.getByRole("link", { name: /Auto Mail Jobs/u })).toHaveAttribute("href", "/daily-matches");
  await expect(mobileNav.getByRole("link", { name: /Email-Sending Jobs/u })).toHaveAttribute("href", "/application-queue");
  await expect(mobileNav.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("href", "/dashboard");
  await mobileNav.getByText("Account, plan, and support", { exact: true }).click();
  await expect(mobileNav.getByRole("link", { name: "Billing & Access" })).toHaveAttribute("href", "/billing");
  await expect(mobileNav.getByRole("link", { name: "Student Plan" })).toHaveAttribute("href", "/settings?tab=student");
  // Reachable exactly once, by href: the drawer's workspace group is gone, so
  // Auto Apply is only under Products, and only under its full label.
  await expect(mobileNav.locator('a[href="/auto-apply"]')).toHaveCount(1);
  await expect(mobileNav.locator('a[href="/tracker"]')).toHaveCount(1);
  await expect(mobileNav.getByRole("link", { name: "Support" })).toHaveCount(1);
  await expect(mobileNav.getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support");
  await mobileNav.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(mobileNav.getByRole("button", { name: "Log out" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
});

test("LinkedIn checker uses balanced onboarding and result layouts across breakpoints", async ({ page }) => {
  await denyExternalBrowserNetwork(page);
  await page.route("**/api/me", (route) => json(route, { loggedIn: false }));
  await page.route("**/api/check-linkedin", (route) => json(route, {
    score: 84,
    grade: "Strong",
    verdict: "Clear positioning with a few keyword gaps.",
    fixes: ["Add measurable outcomes."],
    quickWins: ["Strengthen the headline."],
    strengths: ["Experience is easy to scan."],
    missingKeywords: ["roadmap"],
    breakdown: [{ label: "Headline", score: 17, max: 20, note: "Specific and searchable." }],
    checks: [{ id: "headline", label: "Headline", status: "pass", detail: "Clear target role." }],
    detected: { hasHeadline: true },
  }));

  for (const width of [1440, 1280, 1024, 950, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/linkedin-checker");
    const grid = page.locator(".tool-workspace-grid");
    await expect(grid).toHaveClass(/is-onboarding/u);
    const onboarding = await grid.evaluate((element) => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
      rail: getComputedStyle(element.querySelector(".preview-rail") as Element).display,
    }));
    if (width <= 1024) {
      expect(onboarding.columns).toBe(1);
      expect(onboarding.rail).toBe("none");
    } else {
      expect(onboarding.columns).toBe(2);
      expect(onboarding.rail).not.toBe("none");
    }
    // ToolShell's compact h1 is clamp(1.75rem, 2.6vw, 2.1rem):
    // a 28px floor and a 33.6px ceiling. Evaluate the
    // clamp, which is what actually needs guarding here — the bare, unlayered
    // `h1 {}` rule in globals.css beats @layer utilities, so if the `!` on
    // that class is ever lost the heading silently renders at the wrong size
    // with nothing to grep for. This asserts the utility still wins, at every
    // breakpoint.
    const expectedHeading = Math.min(33.6, Math.max(28, width * 0.026));
    const headingSize = await page.getByRole("heading", { level: 1 })
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(Math.abs(headingSize - expectedHeading)).toBeLessThan(0.6);
    await expectNoHorizontalOverflow(page);

    await page.getByLabel("LinkedIn profile text").fill(
      "Product leader with ten years of experience building customer-focused software products, leading cross-functional teams, improving activation, and delivering measurable revenue outcomes across global markets. Skilled in discovery, strategy, analytics, experimentation, stakeholder alignment, and roadmap execution.",
    );
    await page.getByRole("button", { name: "Check LinkedIn profile" }).click();
    await expect(grid).toHaveClass(/has-result/u);
    if (width <= 1024) {
      await expect(page.getByRole("button", { name: "Open LinkedIn report" })).toBeVisible();
    } else {
      await expect(page.locator(".preview-rail").getByRole("heading", { name: "LinkedIn score", exact: true })).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
  }
});

test("stable account entry routes resolve to the intended settings tabs", async ({ page }) => {
  test.setTimeout(60_000);
  await installAccountFakes(page);
  for (const [entry, tab] of [["/billing", "billing"], ["/account", "account"], ["/security", "security"]] as const) {
    await page.goto(entry, { waitUntil: "commit" }).catch(() => null);
    await expect(page).toHaveURL(new RegExp(`/settings\\?tab=${tab}$`, "u"));
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  }
});

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`shared auth and academy shells remain accessible on ${viewport.name}`, async ({ page }) => {
    await denyExternalBrowserNetwork(page);
    await page.route("**/api/me", (route) => json(route, { loggedIn: false, googleEnabled: false }));
    await page.setViewportSize(viewport);

    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Log in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await page.getByRole("button", { name: "Create an account" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Create your free account." })).toBeVisible();
    await expect(page.getByLabel(/Invite code/u)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/login-${viewport.name}.png`, fullPage: true });

    await page.goto("/learn");
    await expect(page.getByRole("heading", { level: 1, name: "RoleSharp Academy" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "About the academy" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start Module 1 — Fix" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/academy-${viewport.name}.png`, fullPage: true });
  });
}

test("admin login submits a same-origin mutation to credential validation", async ({ page }) => {
  await denyExternalBrowserNetwork(page);
  await page.route("**/api/admin/session", (route) => json(route, { error: "forbidden" }, 403));
  await page.route("**/api/admin/stats", (route) => json(route, { error: "forbidden" }, 403));
  await page.route("**/api/admin/login", async (route) => {
    const requestUrl = new URL(route.request().url());
    expect(route.request().headers().origin).toBe(requestUrl.origin);
    return json(route, { error: "Invalid admin credentials" }, 401);
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "RoleSharp Admin" })).toBeVisible();
  // Password and authenticator entry is break-glass only: the fields are
  // collapsed behind this toggle, so the credential path is unreachable
  // without opening it first.
  await page.getByRole("button", { name: "Use recovery access" }).click();
  await page.getByLabel("Admin password").fill("invalid-password");
  await page.getByLabel("Authenticator code").fill("000000");
  await page.getByRole("button", { name: "Enter recovery session" }).click();
  await expect(page.getByText("Invalid admin credentials", { exact: true })).toBeVisible();
  await expect(page.getByText("invalid_origin", { exact: true })).toHaveCount(0);
});

for (const viewport of [
  { name: "mobile", width: 375, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`signed-in dashboard is complete and accessible on ${viewport.name}`, async ({ page }) => {
    await installAccountFakes(page);
    await page.setViewportSize(viewport);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "My workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your job search workspace" })).toBeVisible();
    // The "2 tracked / 1 to review / Google connected" chips went out with the
    // 11-button pseudo-nav in 436650e — those destinations are in the workspace
    // tab bar, which renders on this page. What the header must still carry is
    // the plan state and, on a free plan, the upgrade path off it; that is the
    // reason the header survived at all, so that is what this asserts now.
    // .first(): "Free plan" is both the header badge and a card title further
    // down, so an unscoped exact match is a strict-mode violation. The header
    // is first in DOM order, which is the one this test is about.
    await expect(page.getByText("Free plan", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Upgrade", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Saved resumes" })).toBeVisible();
    await page.getByText("Average diagnostic score", { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByText("Average diagnostic score", { exact: true }).locator("..").getByText("88", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Best diagnostic score", { exact: true }).locator("..").getByText("91", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/dashboard-${viewport.name}.png`, fullPage: true });
  });
}

for (const viewport of [
  { name: "mobile", width: 390, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`settings, support, and tracker expose the signed-in account essentials on ${viewport.name}`, async ({ page }) => {
    await installAccountFakes(page);
    await page.setViewportSize(viewport);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Verified", { exact: true })).toBeVisible();
    const settingsNav = page.getByRole("navigation", { name: "Settings sections" });
    const sections = ["Overview", "Billing", "Credits", "Account", "Security", "Notifications", "Application", "Job matching", "Personal website", "Student plan"];
    for (const section of sections) {
      const tab = settingsNav.getByRole("link", { name: section, exact: true });
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveAttribute("aria-current", "page");
      await expectNoHorizontalOverflow(page);
    }
    await settingsNav.getByRole("link", { name: "Billing", exact: true }).click();
    await expect(page.getByText(/Premium is a fixed-term pass paid once/u)).toBeVisible();
    await expect(page.getByRole("button", { name: /30-day pass/u })).toBeVisible();
    await expect(page.getByText(/never auto-renews/u)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/settings-${viewport.name}.png`, fullPage: true });

    await page.goto("/support");
    await expect(page.getByRole("heading", { level: 1, name: "Support for account and workflow issues" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your support tickets" })).toBeVisible();
    await expect(page.getByText("Export question", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/support-${viewport.name}.png`, fullPage: true });

    await page.goto("/tracker");
    await expect(page.getByRole("heading", { name: "Application tracker" })).toBeVisible();
    await expect(page.getByText("Example Studio", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Application email ledger" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/tracker-${viewport.name}.png`, fullPage: true });
  });
}

for (const viewport of [
  { name: "mobile", width: 390, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`admin workflow operations are truthful and accessible on ${viewport.name}`, async ({ page }) => {
    await installAdminFakes(page);
    await page.setViewportSize(viewport);
    await page.goto("/admin/workflows");
    await expect(page.getByRole("heading", { name: "Workflow operations" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Automation is deliberately disabled", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sending safety lock" })).toBeVisible();
    await expect(page.getByText(/Unknown outcomes must never be resent automatically/u)).toBeVisible();
    // Direct flag control (owner ask: control jobs_daily_matches from the
    // workflows dashboard). The QA principal holds flags.manage, so every
    // workflow flag gate exposes its own toggle; the environment gate article
    // (Workflow engine) deliberately has none.
    await expect(page.getByRole("button", { name: "Enable jobs_daily_matches" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enable role_apply_prepare" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enable role_apply_gmail_send" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enable role_apply_microsoft_send" })).toBeVisible();
    if (viewport.name === "desktop") await expect(page.getByText("Local QA", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/admin-workflows-${viewport.name}.png`, fullPage: true });
  });

  test(`admin workflow access queue shows who asked and when on ${viewport.name}`, async ({ page }) => {
    await installAdminFakes(page);
    await page.setViewportSize(viewport);
    await page.goto("/admin/feature-access");
    await expect(page.getByRole("heading", { name: "Workflow access" })).toBeVisible({ timeout: 15_000 });
    // The pending-request signal is visible before opening the queue: the
    // sidebar badge carries the session's pendingAccessRequests count.
    if (viewport.name === "desktop") {
      await expect(page.locator(".admin-pro-navlink", { hasText: "Workflow access" }).locator("strong")).toHaveText("3");
      await expect(page.locator(".admin-pro-navlink", { hasText: "Students" }).locator("strong")).toHaveText("1");
    }
    await expect(page.getByText(/1 access request waiting for review/u)).toBeVisible();
    await expect(page.getByText("requester@example.test", { exact: true })).toBeVisible();
    await expect(page.getByText("Daily Matches", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Awaiting first review", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/admin-feature-access-${viewport.name}.png`, fullPage: true });
  });

  test(`admin analytics recovery and command search work on ${viewport.name}`, async ({ page }) => {
    await installAdminFakes(page, { analyticsMode: "partial" });
    await page.setViewportSize(viewport);
    await page.goto("/admin/analytics");
    // The analytics view's h1 comes from analytics-view.tsx's `title` prop,
    // renamed from "Full Dashboard" without this expectation following it.
    await expect(page.getByRole("heading", { name: "Operational analytics" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Some sections are temporarily unavailable", { exact: false })).toBeVisible();
    const command = page.getByRole("combobox", { name: "Jump to admin section" });
    await command.fill("internship");
    await expect(page.getByRole("option", { name: /Internship reports/u })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test(`admin flags and settings are complete and accessible on ${viewport.name}`, async ({ page }) => {
    await installAdminFakes(page);
    await page.setViewportSize(viewport);

    await page.goto("/admin/flags");
    await expect(page.getByRole("heading", { name: "Feature Flags" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("jobs_daily_matches", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open workflow operations" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/admin-flags-${viewport.name}.png`, fullPage: true });

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Usage limits" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pricing", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "SEO & indexing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cloudflare cache" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/admin-settings-${viewport.name}.png`, fullPage: true });
  });
}

test("account settings expose the stable support user ID", async ({ page }) => {
  const userId = "7b000000-0000-4000-8000-000000000002";
  await installAccountFakes(page, { userId });
  await page.goto("/settings?tab=account");
  await expect(page.getByText(userId, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy user ID", exact: true })).toBeVisible();
});

test("feature access requires a useful reason and retains failed confirmation for review", async ({ page }) => {
  await installAdminFakes(page);
  const mutations: unknown[] = [];
  await page.route("**/api/admin/feature-access", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    mutations.push(route.request().postDataJSON());
    return json(route, { error: "temporary_failure" }, 503);
  });
  await page.goto("/admin/feature-access");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  const confirm = dialog.getByRole("button", { name: "Approved", exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Reason", { exact: true }).fill("ok");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Reason", { exact: true }).fill("Verified eligibility");
  await confirm.click();
  await expect(page.getByText("Could not confirm the feature access change. Refresh the records before retrying.").first()).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Reason", { exact: true })).toHaveValue("Verified eligibility");
  expect(mutations).toEqual([{
    userId: "7b000000-0000-4000-8000-000000000002", featureKey: "daily_matches",
    state: "approved", reason: "Verified eligibility", dailyCap: 5,
  }]);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});


test("read-only staff can inspect access without management controls and anonymous API calls are denied", async ({ page }) => {
  await installAdminFakes(page, { permissions: ["admin.access", "access.read"] });
  await page.goto("/admin/feature-access");
  await expect(page.getByText("requester@example.test", { exact: true })).toBeVisible();
  await expect(page.getByText("Read only", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Revoke", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Approval daily cap", { exact: true })).toHaveCount(0);
  // APIRequestContext bypasses page mocks: these exercise real anonymous guards.
  expect((await page.request.get("/api/admin/feature-access")).status()).toBe(403);
  expect((await page.request.get("/api/admin/users?list=1")).status()).toBe(403);
});

test("admin pricing recovers from an API failure without crashing", async ({ page }) => {
  await installAdminFakes(page);
  let fail = true;
  await page.route("**/api/admin/pricing", (route) => fail
    ? json(route, { error: "temporary_failure" }, 503)
    : route.fallback());
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/pricing-config");
  await expect(page.getByRole("alert").filter({ hasText: "Could not load pricing" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry pricing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pricing Plans", exact: true })).toBeVisible();
  await expect(page.getByText("Could not load pricing.")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("system ingestion and rate-limit panels recover after failed reads", async ({ page }) => {
  await installAdminFakes(page);
  let fail = true;
  await page.route("**/api/admin/jobs-status", (route) => fail
    ? json(route, { error: "temporary_failure" }, 503)
    : json(route, { totalProfiles: 4, errors24h: 0, recentRuns: [] }));
  await page.route("**/api/admin/rate-limits", (route) => fail
    ? json(route, { error: "redis_unavailable" }, 503)
    : json(route, { scanned: 3, limits: [] }));
  await page.route("**/api/admin/services", (route) => json(route, { services: [] }));
  await page.route("**/api/admin/integrations", (route) => fail
    ? json(route, { error: "temporary_failure" }, 503)
    : route.fallback());
  await page.route("**/api/admin/logs?**", (route) => fail
    ? json(route, { error: "temporary_failure" }, 503)
    : json(route, { lines: ["QA log entry"], unavailable: false }));
  await page.goto("/admin/system");
  await expect(page.getByRole("button", { name: "Retry ingestion", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry rate limits", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry integrations", exact: true })).toBeVisible();
  await expect(page.getByText("Logs are unavailable for this service on the current host.")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry ingestion", exact: true }).click();
  await page.getByRole("button", { name: "Retry rate limits", exact: true }).click();
  await page.getByRole("button", { name: "Retry integrations", exact: true }).click();
  await page.locator("#admin-log-service").locator("..").getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("QA log entry", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry integrations", exact: true })).toHaveCount(0);
  await expect(page.getByText("Total profiles", { exact: true })).toBeVisible();
  await expect(page.getByText("3 active rate limit keys", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Retry (ingestion|rate limits)$/ })).toHaveCount(0);
});


test("every registered admin workspace denies staff without its permissions", async ({ page }) => {
  test.setTimeout(120_000);
  await installAdminFakes(page, { permissions: ["admin.access"] });
  const paths = [...new Set([...readFileSync("app/admin/navigation.ts", "utf8").matchAll(/href: "([^"\n]+)"/g)].map((match) => match[1]))];
  expect(paths.length).toBeGreaterThanOrEqual(27);
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Access restricted", exact: true }), path).toBeVisible();
  }
});


test("all protected admin GET APIs reject anonymous requests", async ({ request }) => {
  test.setTimeout(120_000);
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
      ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
  }
  const routes = walk("app/api/admin").filter((path) => path.endsWith("/route.ts")
    && !path.includes("[") && !path.includes("/auth/") && !path.includes("/session/")
    && /export async function GET/.test(readFileSync(path, "utf8")));
  expect(routes.length).toBeGreaterThanOrEqual(35);
  for (const file of routes) {
    const path = file.replace(/^app/, "").replace(/\/route\.ts$/, "");
    const response = await request.get(path);
    expect(response.status(), path).toBe(403);
  }
});

test("protected admin mutations reject anonymous same-origin requests", async ({ request, baseURL }) => {
  test.setTimeout(120_000);
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
      ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
  }
  const files = walk("app/api/admin").filter((path) => path.endsWith("/route.ts")
    && !path.includes("/auth/") && !path.includes("/login/") && !path.includes("/logout/"));
  let checked = 0;
  for (const file of files) {
    const methods = [...readFileSync(file, "utf8").matchAll(/export async function (POST|PATCH|PUT|DELETE)\(/g)].map((match) => match[1]);
    const path = file.replace(/^app/, "").replace(/\/route\.ts$/, "").replace(/\[[^\]]+\]/g, "00000000-0000-4000-8000-000000000000");
    for (const method of methods) {
      // These routes select edit/publish permission from a validated action.
      const data = path === "/api/admin/communications"
        ? { action: "pause", versionId: "00000000-0000-4000-8000-000000000000", confirmation: "PAUSE CAMPAIGN" }
        : path === "/api/admin/legal"
          ? { action: "schedule", versionId: "00000000-0000-4000-8000-000000000000" }
          : path === "/api/admin/offers"
            ? { action: "schedule", versionId: "00000000-0000-4000-8000-000000000000", confirmation: "SCHEDULE OFFER" }
            : path === "/api/admin/notifications"
              ? { action: "schedule", versionId: "00000000-0000-4000-8000-000000000000", confirmation: "SCHEDULE NOTICE" }
              : {};
      const response = await request.fetch(path, { method, headers: { Origin: baseURL! }, data });
      expect(response.status(), `${method} ${path}`).toBe(403);
      const body = await response.json();
      expect(body.error, `${method} ${path} should reach the permission gate`).not.toBe("cross_origin_blocked");
      expect(body.error, `${method} ${path} should reach the permission gate`).not.toBe("invalid_origin");
      checked++;
    }
  }
  expect(checked).toBeGreaterThanOrEqual(30);
});


test("recovery admin can revoke access but cannot approve without a named staff account", async ({ page }) => {
  await installAdminFakes(page, { breakGlass: true });
  await page.goto("/admin/feature-access");
  await expect(page.getByText("Sign in with a named staff account to approve or restore access.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Approval daily cap")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Revoke", exact: true })).toBeVisible();
});
