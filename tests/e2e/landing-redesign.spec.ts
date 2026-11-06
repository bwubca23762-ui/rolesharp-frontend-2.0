import { expect, test, type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { expectNoAxeViolations, expectNoHorizontalOverflow } from "../helpers/accessibility";
import { denyExternalBrowserNetwork } from "../helpers/network-deny";

const evidence = process.env.LANDING_EVIDENCE_ROOT ?? ".omo/evidence/landing-redesign";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

test.beforeAll(async () => { await mkdir(evidence, { recursive: true }); });

test.beforeEach(async ({ page }) => {
  await denyExternalBrowserNetwork(page);
  await page.route("**/api/me", (route) => json(route, { loggedIn: false }));
});

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 960 },
  { name: "desktop", width: 1440, height: 960 },
]) {
  test(`landing redesign is complete and accessible on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Tailor your resume to the job." })).toBeVisible();
    await expect(page.getByRole("link", { name: /Check my resume free/u }).first()).toHaveAttribute("href", "/checker");
    await expect(page.getByRole("link", { name: "Build a tailored resume", exact: true })).toHaveAttribute("href", "/build");
    await expect(page.getByText("Fictional candidate and job posting")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Supported by the resume" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check before adding" })).toBeVisible();
    await expect(page.getByText("Sample source", { exact: true })).toBeVisible();
    // Assert the shape, not the numbers. These were pinned as literal 3/10/5
    // and broke the moment the plans were retuned -- the same defect the page
    // copy had. The values themselves are config, and a deployment is allowed
    // to override them; what must hold is that all three plans state an
    // allowance. tests/frontend-regression.test.ts covers where it comes from.
    // Scoped to the list items: `getByText` with an anchored regex does not
    // normalize the whitespace around the sibling icon, so it matched nothing.
    // `resumes?` because the free plan is 1 by default and reads "1 tailored
    // resume". lib/limits.ts owns that singular/plural choice.
    await expect(page.locator("li", { hasText: /\d+ tailored resumes? per rolling month/u })).toHaveCount(3);
    await expect(page.getByText(/never auto-renews/u).first()).toBeVisible();
    await expect(page.getByText("Paid once — never auto-renews — drops to Free at term end", { exact: true })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `${evidence}/landing-${viewport.name}-light.png`, fullPage: true });
  });
}

test("application journey loop line links every stage", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  // The interactive four-panel demo was cut (the owner read its fictional
  // widgets as filler boxes). The loop survives as one actionable line; every
  // stage must still reach its tool.
  const loop = page.locator("#application-journey");
  await expect(loop).toBeVisible();
  await expect(loop.getByRole("link", { name: "Check" })).toHaveAttribute("href", "/checker");
  await expect(loop.getByRole("link", { name: "Tailor" })).toHaveAttribute("href", "/build");
  await expect(loop.getByRole("link", { name: "Apply" })).toHaveAttribute("href", "/auto-apply");
  await expect(loop.getByRole("link", { name: "Track" })).toHaveAttribute("href", "/tracker");
  // The full catalogue now lives on its own page, linked directly from the
  // hero. Verify that page still exposes every tool and its category filters.
  await expect(page.getByRole("link", { name: "Browse all career tools", exact: true })).toHaveAttribute("href", "/tools#catalogue");
  await expect(page.locator("#tools")).toHaveCount(0);
  await page.goto("/tools#catalogue");
  const tools = page.getByLabel("Career tools catalogue");
  for (const href of ["/checker", "/resume-match", "/resume-compare", "/salaries", "/interview-questions",
    "/resume-summary-generator", "/resume-bullet-points-generator", "/work-experience-generator",
    "/career-summary-generator", "/resignation-letter-generator", "/skill-gap", "/cover-letter-generator",
    "/resume-fixer", "/linkedin-checker", "/cover-letter-analyzer", "/linkedin-headline-generator",
    "/thank-you-note-generator", "/salary-negotiation-script", "/cv-converter", "/career-map", "/free-certifications"]) {
    await expect(tools.locator(`a[href="${href}"]`).first()).toBeVisible();
  }
  const filters = page.getByRole("group", { name: "Filter tools by workspace" });
  await filters.getByRole("button", { name: "Resume Studio", exact: true }).click();
  await expect(tools.locator('a[href="/checker"]')).toBeVisible();
  await expect(tools.locator('a[href="/salaries"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("dark mode and reduced motion preserve the landing hierarchy", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // The application act still renders under dark mode — now as the loop line
  // (the demo was cut), anchored where the nav's featured entry points.
  await expect(page.locator("#application-journey").getByRole("link", { name: "Track" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  await page.screenshot({ path: `${evidence}/landing-desktop-dark-reduced.png`, fullPage: true });
});
