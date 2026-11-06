import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { expectNoAxeViolations, expectNoHorizontalOverflow } from "../helpers/accessibility";
import { denyExternalBrowserNetwork } from "../helpers/network-deny";
import { DEFAULT_AUTH_DESTINATION } from "../../lib/auth-redirect";
import { env } from "../../lib/env";

const evidence = process.env.CUSTOMER_FAMILY_EVIDENCE_ROOT
  ?? ".omo/evidence/customer-page-families";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installPublicFakes(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: () => true,
    });
  });
  // Register the broad network guard first. Playwright evaluates routes in
  // reverse registration order, so the narrower API fakes below must run first.
  await denyExternalBrowserNetwork(page);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/me") {
      return json(route, { loggedIn: false, googleEnabled: true });
    }
    if (path === "/api/geo") {
      return json(route, { detected: true, code: "US", name: "United States", flag: "🇺🇸" });
    }
    if (path === "/api/countries") {
      return json(route, [{ code: "US", name: "United States", flag: "🇺🇸" }]);
    }
    if (path === "/api/roles") {
      return json(route, [{ title: "Product Designer", slug: "product-designer" }]);
    }
    // The salary estimator looks up on mount with default role+country; a 599
    // here surfaces as a client console error, so serve a realistic row.
    if (path === "/api/salaries") {
      return json(route, {
        role: "data analyst",
        country: "United States",
        sampleSize: 1204,
        p25: 62000,
        median: 78000,
        p75: 98000,
        avgLow: 55000,
        avgHigh: 112000,
        currency: "USD",
      });
    }
    if (path === "/api/analytics") {
      return json(route, { recorded: true });
    }
    if (path === "/api/student/status") {
      return json(route, { eligible: false, status: "none" });
    }
    // /login fetches this on mount to render the signup acceptance notice. Left
    // unstubbed it falls through to the 599 below, which surfaces as a client
    // console error rather than as a missing-fixture failure.
    if (path === "/api/legal/current") {
      return json(route, {
        versions: [
          {
            id: "00000000-0000-4000-8000-000000000047",
            documentKey: "terms",
            title: "Terms of Service",
            versionNumber: 1,
            changeSummary: "End-to-end fixture baseline.",
            materialChange: false,
            effectiveAt: "2026-08-05T00:00:00.000Z",
            publishedAt: "2026-08-05T00:00:00.000Z",
            contentDigest: "0".repeat(64),
          },
          {
            id: "00000000-0000-4000-8000-000000000048",
            documentKey: "privacy",
            title: "Privacy Policy",
            versionNumber: 1,
            changeSummary: "End-to-end fixture baseline.",
            materialChange: false,
            effectiveAt: "2026-08-05T00:00:00.000Z",
            publishedAt: "2026-08-05T00:00:00.000Z",
            contentDigest: "1".repeat(64),
          },
        ],
      });
    }
    if (path === "/api/auth/forgot-password" && request.method() === "POST") {
      return json(route, { ok: true });
    }
    if (path === "/api/auth/reset-password" && request.method() === "POST") {
      return json(route, { ok: true });
    }

    return json(route, { error: `unregistered_public_fake:${request.method()}:${path}` }, 599);
  });
}

function observeClientErrors(page: Page) {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("ERR_BLOCKED_BY_CLIENT")) return;
    errors.push(`console: ${text}`);
  });

  return errors;
}

async function expectAccessiblePage(
  page: Page,
  heading: string,
  screenshotPath: string,
) {
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

test.beforeAll(async () => {
  await mkdir(evidence, { recursive: true });
});

for (const viewport of viewports) {
  test(`job alerts exposes a real heading while session state loads on ${viewport.name}`, async ({ page }) => {
    await installPublicFakes(page);
    await page.setViewportSize(viewport);
    await page.goto("/job-alerts");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test(`Jobs and Auto Apply preserve truthful workflow boundaries on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    await installPublicFakes(page);
    const clientErrors = observeClientErrors(page);
    await page.setViewportSize(viewport);

    await page.goto("/jobs");
    await expect(page.getByText("Searching jobs in United States", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Find jobs", exact: true })).toHaveAttribute("href", "/jobs/united-states");
    // The 4-paragraph "ends with a better application" prose wall (which carried
    // the salary honesty line) was retired 2026-10-20 — the picker + finder are
    // the page.
    await expectAccessiblePage(
      page,
      "Find fresh jobs in your country",
      `${evidence}/jobs-${viewport.name}.png`,
    );

    await page.goto("/auto-apply");
    await expect(page.getByText("Sign in when you are ready to connect", { exact: true })).toBeVisible();
    await expect(page.getByText("Your review queue appears here after matching", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /resend/iu })).toHaveCount(0);
    await expectAccessiblePage(
      page,
      "Controlled application email, never mass ATS submission",
      `${evidence}/auto-apply-${viewport.name}.png`,
    );

    expect(clientErrors).toEqual([]);
  });

  test(`Phase 3 trust and conversion boundaries remain accessible on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await installPublicFakes(page);
    const clientErrors = observeClientErrors(page);
    await page.setViewportSize(viewport);

    await page.goto("/pricing");
    await expect(page.getByRole("link", { name: `Choose ${env.daysMonthly}-day pass` })).toHaveAttribute("href", "/settings?tab=billing&plan=monthly");
    await expect(page.getByRole("link", { name: `Choose ${env.daysYearly}-day pass` })).toHaveAttribute("href", "/settings?tab=billing&plan=yearly");
    await expect(page.getByText(/never auto-renews/i).first()).toBeVisible();
    await expect(page.getByText(/returns to Free when the pass expires/i).first()).toBeVisible();
    await expectAccessiblePage(
      page,
      "Start free. Pay once if you need more.",
      `${evidence}/phase-3-pricing-${viewport.name}.png`,
    );

    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 2, name: "Access terms and usage allowances answer different questions" })).toBeVisible();
    await expect(page.getByText(/One-time payment with no renewal charge/u)).toBeVisible();
    await expectAccessiblePage(
      page,
      "A job-application tool should explain its evidence and its limits.",
      `${evidence}/phase-3-about-${viewport.name}.png`,
    );

    await page.goto("/checker");
    // The MethodologyCallout/RelatedWorkflow slabs were retired 2026-10-18
    // (pure workspaces). The claim-integrity line they carried still lives in
    // the checker's own results copy; the page is now the workspace itself.
    await expect(page.getByRole("heading", { level: 1, name: /ATS resume checker|Check your resume/i })).toBeVisible();
    await expectAccessiblePage(
      page,
      "Check your resume",
      `${evidence}/phase-3-checker-${viewport.name}.png`,
    );

    await page.goto("/resume-fixer");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessiblePage(
      page,
      "Fix your old resume",
      `${evidence}/phase-3-resume-fixer-${viewport.name}.png`,
    );

    expect(clientErrors).toEqual([]);
  });

  // Eleven of the twelve grid tools had zero e2e page visits — the landing
  // spec asserted the links existed and nothing ever loaded the destinations.
  // Each page must render exactly one h1, stay axe-clean, and hold its layout
  // at both breakpoints. The generator islands only fetch on submit, so these
  // visits exercise the real anonymous first paint.
  const toolPages: Array<{ path: string; h1: string }> = [
    { path: "/resume-match", h1: "Does your resume match this job?" },
    { path: "/resume-compare", h1: "Which version fits better?" },
    { path: "/salaries", h1: "What does this role actually pay?" },
    { path: "/interview-questions", h1: "Interview questions for your role." },
    { path: "/resume-summary-generator", h1: "Resume summary generator" },
    { path: "/resume-bullet-points-generator", h1: "Resume bullet points generator" },
    { path: "/work-experience-generator", h1: "Work experience generator" },
    { path: "/career-summary-generator", h1: "Career summary generator" },
    { path: "/resignation-letter-generator", h1: "Resignation letter generator" },
    { path: "/skill-gap", h1: "Skill gap check" },
    { path: "/cover-letter-generator", h1: "A tight cover letter. Real evidence. No filler." },
  ];

  test(`every free tool page renders for anonymous visitors on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await installPublicFakes(page);
    const clientErrors = observeClientErrors(page);
    await page.setViewportSize(viewport);

    for (const tool of toolPages) {
      await page.goto(tool.path);
      await expectAccessiblePage(
        page,
        tool.h1,
        `${evidence}/tool-${tool.path.replaceAll("/", "-") || "root"}-${viewport.name}.png`,
      );
    }

    expect(clientErrors).toEqual([]);
  });

  test(`Phase 4 catalogs preserve evidence boundaries on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await installPublicFakes(page);
    const clientErrors = observeClientErrors(page);
    await page.setViewportSize(viewport);

    await page.goto("/resume-templates");
    // DirectoryMethodCard ("Evidence boundaries" essay) retired 2026-10-18 —
    // the catalogue itself is the surface now.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessiblePage(
      page,
      "Choose the document your work deserves.",
      `${evidence}/phase-4-templates-${viewport.name}.png`,
    );

    await page.goto("/resume-examples");
    // The one-line provenance badge (DirectoryEvidenceNote) survives — it
    // says what the data IS; only the essay card around it went away.
    await expect(page.getByText("Illustrative sample", { exact: true }).first()).toBeVisible();
    await expectAccessiblePage(
      page,
      "Illustrative resume guidance, organized by role.",
      `${evidence}/phase-4-examples-${viewport.name}.png`,
    );

    await page.goto("/companies");
    // The honesty sentence lives in the page body; the essay card listing it
    // was retired.
    await expect(page.getByText(/do not claim access to private hiring criteria/u)).toBeVisible();
    await expectAccessiblePage(
      page,
      "Resume guides for companies worldwide",
      `${evidence}/phase-4-companies-${viewport.name}.png`,
    );

    await page.goto("/roles");
    // The "live job posting is the source of truth" line lived in the retired
    // method card's description; the roles directory grid itself remains.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAccessiblePage(
      page,
      "Resume guides for your role",
      `${evidence}/phase-4-roles-${viewport.name}.png`,
    );

    expect(clientErrors).toEqual([]);
  });

  test(`legal shells preserve mailbox, delivery, and refund disclosures on ${viewport.name}`, async ({ page }) => {
    // /privacy and /terms render the legal documents seeded by migration 047,
    // so the text below exists in Postgres and nowhere in the source tree. With
    // no DATABASE_URL the pool is null, q() returns [], and the pages render
    // without a document — this cannot pass and it is not a defect. Skip rather
    // than fail, so a local run is honestly green; CI sets DATABASE_URL and runs
    // Postgres, so it still covers all three pages there.
    test.skip(!process.env.DATABASE_URL, "needs the seeded legal documents in Postgres");
    test.setTimeout(90_000);
    await installPublicFakes(page);
    const clientErrors = observeClientErrors(page);
    await page.setViewportSize(viewport);

    await page.goto("/privacy");
    // Quoted from the seeded document (047 line 220), not paraphrased. The
    // previous wording ("Mailbox connection is separate from RoleSharp login")
    // appears nowhere in the app or the migrations, so this could never pass --
    // it was read as "needs a database", which sent the fix in the wrong
    // direction. /refund needs no database at all; it is a static page.
    await expect(page.getByText(/connections are separate from login and use send-oriented delegated scopes/u)).toBeVisible();
    await expect(page.getByText(/does not request inbox-read, mailbox-modify, contacts/u)).toBeVisible();
    await expectAccessiblePage(
      page,
      "Privacy Policy",
      `${evidence}/privacy-${viewport.name}.png`,
    );

    await page.goto("/terms");
    await expect(page.getByText(/does not complete LinkedIn, Indeed, or employer ATS forms/u)).toBeVisible();
    await expect(page.getByText(/Unknown outcomes are not automatically resent/u)).toBeVisible();
    await expectAccessiblePage(
      page,
      "Terms of Service",
      `${evidence}/terms-${viewport.name}.png`,
    );

    await page.goto("/refund");
    await expect(page.getByRole("heading", { level: 2, name: "Eligibility" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Non-refundable cases" })).toBeVisible();
    await expectAccessiblePage(
      page,
      "Refund Policy",
      `${evidence}/refund-${viewport.name}.png`,
    );

    expect(clientErrors).toEqual([]);
  });

  test(`Phase 5 login preserves safe workspace continuity on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    await installPublicFakes(page);
    const clientErrors = observeClientErrors(page);
    await page.setViewportSize(viewport);

    await page.goto("/login?next=%2Fsettings%3Ftab%3Dsecurity");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back." })).toBeVisible();
    await expect(page.locator('a[href^="/api/auth/google/start?next="]')).toHaveAttribute("href", /next=%2Fsettings%3Ftab%3Dsecurity/u);
    await expectAccessiblePage(
      page,
      "Welcome back.",
      `${evidence}/phase-5-login-${viewport.name}.png`,
    );

    await page.goto("/login?next=https%3A%2F%2Fattacker.example%2Fsteal");
    // The invariant is that an off-origin `next` is discarded for the default
    // destination, not what that destination happens to be — it moved from
    // /build to /dashboard once already.
    await expect(page.locator('a[href^="/api/auth/google/start?next="]')).toHaveAttribute(
      "href",
      new RegExp(`next=${encodeURIComponent(DEFAULT_AUTH_DESTINATION)}`, "u"),
    );
    expect(clientErrors).toEqual([]);
  });

  // Replaces a source-text assertion that counted occurrences of a literal
  // inline style in app/build/page.tsx. That pinned the markup of the three
  // auth-state cards instead of the guarantee they exist for -- a logged-out
  // visitor still gets a real, visible h1 rather than a collapsed shell.
  test(`logged-out tool pages keep a visible primary heading on ${viewport.name}`, async ({ page }) => {
    await installPublicFakes(page);
    const clientErrors = observeClientErrors(page);
    await page.setViewportSize(viewport);

    await page.goto("/build");
    await expect(
      page.getByRole("heading", { level: 1, name: "Build a resume tailored to the job" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in / Sign up" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    expect(clientErrors).toEqual([]);
  });

  test(`account recovery remains semantic and anti-enumerating on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    await installPublicFakes(page);
    const clientErrors = observeClientErrors(page);
    await page.setViewportSize(viewport);

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("member@example.test");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account with that email exists, we've sent a reset link/u)).toBeVisible();
    await expectAccessiblePage(
      page,
      "Forgot your password?",
      `${evidence}/forgot-password-${viewport.name}.png`,
    );

    await page.goto("/reset-password?token=browser-proof-token");
    await page.getByLabel("New password (10-256 characters)").fill("secure-proof-password");
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText("Password reset successfully. You can now log in.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to login" })).toHaveAttribute("href", "/login");
    await expectAccessiblePage(
      page,
      "Reset your password",
      `${evidence}/reset-password-${viewport.name}.png`,
    );

    expect(clientErrors).toEqual([]);
  });

  test(`marketing, directory, and locale shells remain accessible on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await installPublicFakes(page);
    const clientErrors = observeClientErrors(page);
    await page.setViewportSize(viewport);

    const routes = [
      {
        path: "/pricing",
        heading: "Start free. Pay once if you need more.",
        // ModernPlans' student banner carries the proof now (the old
        // StudentOfferCard fallback heading left with the redesign).
        proofHeading: "Studying or active university student?",
        screenshot: "pricing",
      },
      {
        path: "/resume-templates",
        heading: "Start with the right structure",
        proofHeading: "Preview first. Build when one feels right.",
        screenshot: "resume-templates",
      },
      {
        path: "/companies",
        heading: "Resume guides for companies worldwide",
        proofHeading: "Top global employers",
        screenshot: "companies",
      },
      {
        path: "/roles",
        heading: "Resume guides for your role",
        proofHeading: "Roles",
        screenshot: "roles",
      },
      {
        path: "/en-gb",
        heading: "CV and resume help for job seekers in the United Kingdom",
        proofHeading: "How RoleSharp helps in the United Kingdom",
        screenshot: "locale-en-gb",
      },
    ] as const;

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { name: route.proofHeading })).toBeVisible();
      await expectAccessiblePage(
        page,
        route.heading,
        `${evidence}/${route.screenshot}-${viewport.name}.png`,
      );
    }

    expect(clientErrors).toEqual([]);
  });

  // `body { overflow-x: hidden }` made the body a scroll container, which
  // silently disabled the nav's `position: sticky` -- the header scrolled away
  // on every page, on the live site too. Asserting the stuck position rather
  // than the CSS property, so the next way of breaking it also fails here.
  test(`the site header stays pinned while the page scrolls on ${viewport.name}`, async ({ page }) => {
    await installPublicFakes(page);
    await page.setViewportSize(viewport);
    await page.goto("/");

    const nav = page.locator("nav.rs-site-nav");
    await expect(nav).toBeVisible();
    expect((await nav.boundingBox())?.y).toBeCloseTo(0, 0);

    await page.evaluate(() => window.scrollTo(0, 1800));
    await expect
      .poll(async () => Math.round((await nav.boundingBox())?.y ?? -1))
      .toBe(0);

    // The overflow rule exists to stop the decorative orbs dragging the page
    // sideways; keep proving that while the header sticks.
    await expectNoHorizontalOverflow(page);
  });
}
