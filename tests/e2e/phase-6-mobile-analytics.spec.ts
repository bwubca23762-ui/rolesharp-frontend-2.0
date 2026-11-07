import { expect, test, type Page, type Route } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow } from "../helpers/accessibility";
import { denyExternalBrowserNetwork } from "../helpers/network-deny";
import { DEFAULT_FREE_MONTHLY_LIMIT, DEFAULT_PREMIUM_MONTHLY_LIMIT } from "../../lib/limits";
import { featuresFor } from "../../lib/tier-features";

type RecordedEvent = {
  type?: string;
  event?: string;
  path?: string;
  context?: string;
  pageFamily?: string;
  deviceClass?: string;
  authState?: string;
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installPhase6Fakes(
  page: Page,
  recordedEvents: RecordedEvent[],
  options: { loggedIn?: boolean; premium?: boolean } = {},
) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: (url: string | URL, data?: BodyInit | null) => {
        if (String(url).endsWith("/api/analytics") && data instanceof Blob) {
          void data.text().then((body) => fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          }));
        }
        return true;
      },
    });
  });

  await denyExternalBrowserNetwork(page);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/analytics" && request.method() === "POST") {
      const body = request.postDataJSON() as RecordedEvent;
      recordedEvents.push(body);
      return json(route, { ok: true });
    }
    if (path === "/api/me") {
      const premium = options.premium ?? false;
      return json(route, {
        loggedIn: options.loggedIn ?? true,
        email: "mobile@example.test",
        emailVerified: true,
        premium,
        premiumSource: premium ? "paid" : null,
        premiumUntil: premium ? "2026-09-01T00:00:00.000Z" : null,
        // Mirrors the real /api/me contract: premiumSource + features drive the
        // tier feature split (lib/tier-features.ts). A premium fixture without
        // features now renders DOCX locked, exactly as a broken server
        // response would — the fixture must mirror the contract, not the
        // client's fallbacks.
        features: featuresFor(premium ? "paid" : null, premium),
        // From the constants, not typed out. This fake said 10 and 3 while the
        // real allowance is 5 and 1 — the same wrong pair that was being served
        // on /login and four marketing pages. The regression sweep that catches
        // those walks app/, components/ and lib/, so it does not reach tests/,
        // which is exactly how a fixture kept asserting the retired numbers.
        limit: premium ? DEFAULT_PREMIUM_MONTHLY_LIMIT : DEFAULT_FREE_MONTHLY_LIMIT,
        used: 1,
        remaining: (premium ? DEFAULT_PREMIUM_MONTHLY_LIMIT : DEFAULT_FREE_MONTHLY_LIMIT) - 1,
        credits: 2,
        googleEnabled: true,
        plans: [
          { id: "monthly", label: "30-day pass", price: 12, days: 30 },
          { id: "yearly", label: "365-day pass", price: 79, days: 365 },
        ],
      });
    }
    if (path === "/api/geo") return json(route, { detected: true, code: "US" });
    if (path === "/api/countries" || path === "/api/countries/rules") {
      return json(route, [{
        code: "US",
        name: "United States",
        flag: "🇺🇸",
        count: 12,
        rules: { resume_photo: "no", resume_photo_verified: true },
      }]);
    }
    if (path === "/api/companies/search") return json(route, []);
    if (path === "/api/roles") return json(route, []);
    if (path === "/api/generate" && request.method() === "POST") {
      return json(route, {
        resumeId: "10000000-0000-4000-8000-000000000001",
        atsScore: 86,
        premiumUnlock: false,
        creditUsed: false,
        content: {
          headline: "Product Designer",
          summary: "Product designer focused on evidence-backed workflow improvements.",
          skills: ["Figma", "Research", "Prototyping"],
          experiences: [],
          education: [],
          projects: [],
          certifications: [],
          languages: [],
          achievements: [],
        },
      });
    }
    if (/^\/api\/resume\/[^/]+\/(pdf|docx)$/u.test(path)) {
      return route.fulfill({ status: 200, contentType: "application/octet-stream", body: "export" });
    }

    return json(route, { error: `unregistered_phase_6_fake:${request.method()}:${path}` }, 599);
  });
}

async function waitForEvent(events: RecordedEvent[], event: string) {
  await expect.poll(() => events.some((item) => item.event === event)).toBe(true);
}

test("mobile builder keeps generated resume exports reachable", async ({ page }) => {
  const events: RecordedEvent[] = [];
  await installPhase6Fakes(page, events, { loggedIn: true, premium: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("rolesharp-build-draft", JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      name: "Alex Rivera",
      email: "alex@example.test",
      city: "Austin",
      country: "United States",
      countryCode: "US",
      roleQ: "Product Designer",
      projects: "Portfolio redesign | Improved task completion by 24%",
      skills: "Figma, Research, Prototyping, Analytics, Accessibility, Design systems",
      experiences: [],
      template: "basic",
    }));
  });

  await page.goto("/build");
  const generationRequests: { profile: { skills: string[] } }[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/generate") generationRequests.push(request.postDataJSON());
  });
  const reviewButton = page.getByRole("button", { name: "Review details" });
  await reviewButton.click();
  const review = page.getByRole("region", { name: "Review your resume details" });
  await expect(review.getByText("Alex Rivera", { exact: true })).toBeVisible();
  await expect(review.getByRole("button", { name: "Confirm & generate resume" })).toBeInViewport();
  expect(generationRequests).toHaveLength(0);
  await review.getByRole("button", { name: "Edit resume evidence" }).click();
  await expect(page.getByRole("textbox", { name: "Skills", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Add skill", exact: true }).click();
  const newSkill = page.getByRole("textbox", { name: "Skill 7", exact: true });
  await expect(newSkill).toBeFocused();
  await newSkill.fill("Experiment design, analysis");
  await reviewButton.click();
  await expect(review.getByText(/Experiment design, analysis/)).toBeVisible();
  expect(generationRequests).toHaveLength(0);
  await review.getByRole("button", { name: "Generate resume" }).click();
  await expect(page.getByRole("button", { name: "Open generated resume and exports" })).toBeVisible();
  expect(generationRequests).toHaveLength(1);
  expect(generationRequests[0].profile.skills).toHaveLength(7);
  expect(generationRequests[0].profile.skills).toContain("Experiment design, analysis");
  await page.getByRole("button", { name: "Open generated resume and exports" }).click();

  await expect(page.getByRole("dialog", { name: "Generated resume and exports" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
    "href",
    "/api/resume/10000000-0000-4000-8000-000000000001/pdf",
  );
  await expect(page.getByRole("link", { name: "Download DOCX" })).toHaveAttribute(
    "href",
    "/api/resume/10000000-0000-4000-8000-000000000001/docx",
  );
  await expect(page.getByRole("link", { name: "Open saved resume library" })).toHaveAttribute("href", "/dashboard");
  await expect(page.getByText(/This is not an employer decision/u)).toBeVisible();
  await waitForEvent(events, "tool_meaningful_start");
  await waitForEvent(events, "first_value_view");
  expect(events.find((item) => item.event === "tool_meaningful_start")).toMatchObject({
    path: "/build",
    context: "builder:generate",
    pageFamily: "tool",
    deviceClass: "mobile",
    authState: "authenticated",
  });
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
});

test("manual maker restores only current text draft data", async ({ page }) => {
  const events: RecordedEvent[] = [];
  await installPhase6Fakes(page, events, { loggedIn: false });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("rolesharp-maker-draft", JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      name: "Restored Candidate",
      headline: "Data Analyst",
      email: "candidate@example.test",
      phone: "",
      linkedin: "",
      location: "",
      links: "",
      summary: "Evidence-backed analyst profile.",
      skills: "SQL, Python, Tableau",
      experiences: [],
      education: "BSc | Example University | 2026 | Honours",
      projects: "",
      certifications: "",
      languages: "",
      achievements: "",
      jdText: "",
      template: "basic",
      companyType: "general",
      targetCountry: null,
      employerRequestedPhoto: false,
      photoDataUrl: "data:image/jpeg;base64,should-not-restore",
    }));
  });

  await page.goto("/resume-maker");
  await expect(page.getByText("Device draft restored", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Restored Candidate");
  await expect(page.locator('img[alt="Selected resume headshot"]')).toHaveCount(0);
  await expect(page.getByText(/for up to 30 days/u)).toBeVisible();
  await page.getByLabel("Headline or target title").fill("Senior Data Analyst");
  await expect(page.getByText("Draft saved on this device", { exact: true })).toBeVisible();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rolesharp-maker-draft") || "null"));
  expect(stored.headline).toBe("Senior Data Analyst");
  expect(stored.photoDataUrl).toBeUndefined();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
});

test("expired manual drafts are removed instead of restored", async ({ page }) => {
  const events: RecordedEvent[] = [];
  await installPhase6Fakes(page, events, { loggedIn: false });
  await page.setViewportSize({ width: 768, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("rolesharp-maker-draft", JSON.stringify({
      version: 1,
      savedAt: "2025-01-01T00:00:00.000Z",
      name: "Expired Candidate",
    }));
  });

  await page.goto("/resume-maker");
  await expect(page.getByLabel("Full name")).toHaveValue("");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("rolesharp-maker-draft"))).not.toContain("Expired Candidate");
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
});

test("template and navigation analytics stay allowlisted and free of user text", async ({ page }) => {
  const events: RecordedEvent[] = [];
  await installPhase6Fakes(page, events, { loggedIn: false });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/resume-templates?email=private@example.test");
  await page.getByText("Momentum", { exact: true }).click();
  await waitForEvent(events, "template_preview");
  const templateEvent = events.find((item) => item.event === "template_preview");
  expect(templateEvent).toMatchObject({
    path: "/resume-templates",
    context: "catalog:momentum",
    pageFamily: "directory",
    deviceClass: "mobile",
    authState: "anonymous",
  });
  expect(JSON.stringify(templateEvent)).not.toContain("private@example.test");

  await page.getByRole("button", { name: "Open menu" }).click();
  await waitForEvent(events, "nav_menu_open");
  const menuEvent = events.find((item) => item.event === "nav_menu_open");
  expect(menuEvent).toMatchObject({
    path: "/resume-templates",
    context: "mobile:main",
    deviceClass: "mobile",
  });
  expect(events.every((item) => !item.path?.includes("?"))).toBe(true);
  expect(events.every((item) => !JSON.stringify(item).includes("private@example.test"))).toBe(true);
});
