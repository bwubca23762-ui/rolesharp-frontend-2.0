import { test, expect } from "@playwright/test";
import { denyExternalBrowserNetwork } from "../helpers/network-deny";
import { expectNoHorizontalOverflow } from "../helpers/accessibility";

const resumeId = "00000000-0000-4000-8000-000000000011";
const content = {
  headline: "Product Manager",
  summary: "Product manager working on onboarding.",
  skills: ["SQL", "User research"],
  contact: { email: "avery@example.test", phone: "555-0100", links: ["https://example.test/portfolio"] },
  experiences: [{ title: "Product Manager", company: "Fieldnote", bullets: ["Improved activation by 12%."] }],
  education: [{ degree: "B.S.", school: "Cedar State", year: "2019" }],
  projects: [{ name: "Onboarding research", detail: "Interviewed 24 customers." }],
};

test.beforeEach(async ({ page }) => {
  await denyExternalBrowserNetwork(page);
  await page.route("**/api/me", route => route.fulfill({ json: { loggedIn: true, premium: true, pendingLegalAcceptances: [] } }));
  await page.route("**/api/resumes", route => route.fulfill({ json: [{ id: resumeId, candidate_name: "Avery Chen", headline: "Product Manager" }] }));
  await page.route("**/api/resume/" + resumeId, route => route.fulfill({ json: { id: resumeId, candidateName: "Avery Chen", content } }));
});

test("prototype Studio reviews edits and template choice before saving", async ({ page }) => {
  const generated: { profile: { name: string; email: string; links: string[]; projects: unknown[]; skills: string[]; experiences: unknown[] }; template: string }[] = [];
  await page.route("**/api/generate", route => {
    generated.push(route.request().postDataJSON());
    return route.fulfill({ json: { resumeId, content } });
  });
  await page.goto("/dev/frontend-review/templates");
  await page.getByRole("link", { name: "Use Ledger" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Avery J. Chen");
  await page.getByRole("checkbox").first().uncheck();
  await page.getByRole("button", { name: "Review details", exact: true }).click();
  const review = page.getByRole("region", { name: "Review your resume details" });
  await expect(review).toContainText("Avery J. Chen");
  expect(generated).toHaveLength(0);
  await review.getByRole("button", { name: "Edit resume evidence" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Avery J. Chen");
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  await page.getByRole("textbox", { name: "Profile email", exact: true }).fill("avery.edited@example.test");
  await page.getByRole("button", { name: "Review details", exact: true }).click();
  await review.getByRole("button", { name: "Confirm & generate resume" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Resume saved to your workspace." })).toBeVisible();
  expect(generated).toHaveLength(1);
  expect(generated[0].template).toBe("executive");
  expect(generated[0].profile.experiences).toHaveLength(0);
  expect(generated[0].profile.email).toBe("avery.edited@example.test");
  expect(generated[0].profile.links).toEqual(content.contact.links);
  expect(generated[0].profile.projects).toEqual(content.projects);
  await expect(page.getByRole("link", { name: "Open saved resume" })).toHaveAttribute("href", "/resumes/" + resumeId);
});

test("prototype checker and job search use the entered values", async ({ page }) => {
  let checked = "";
  await page.route("**/api/check-resume", route => {
    checked = route.request().postDataJSON().resumeText;
    return route.fulfill({ json: { score: 72, verdict: "Add clearer outcomes.", breakdown: [{ label: "Impact", score: 12, max: 20, note: "Show your results." }] } });
  });
  await page.goto("/dev/frontend-review/checker");
  const text = "Avery Chen. Product Manager. Led onboarding research and experiments, improving activation by 12% across two releases.";
  await page.getByLabel("Resume text").fill(text);
  await page.getByRole("button", { name: "Check resume", exact: true }).click();
  await expect(page.getByLabel("Resume analysis")).toContainText("72");
  expect(checked).toBe(text);
  let query = "";
  await page.route("**/api/jobs?*", route => {
    query = new URL(route.request().url()).searchParams.get("q") ?? "";
    return route.fulfill({ json: { jobs: [{ id: "job-1", title: "Platform PM", company: "Atlas Relay", location: "Remote" }] } });
  });
  await page.goto("/dev/frontend-review/jobs");
  await page.getByLabel("Role search").fill("Platform PM");
  await page.getByRole("button", { name: "Search jobs" }).click();
  await expect(page.getByRole("heading", { name: "Platform PM" })).toBeVisible();
  expect(query).toBe("Platform PM");
  await page.getByRole("link", { name: "Tailor", exact: true }).click();
  await expect(page.getByLabel("Target role", { exact: true })).toHaveValue("Platform PM");
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue("Atlas Relay");
});

test("prototype Studio waits for a queued resume before displaying a saved result", async ({ page }) => {
  let generated = false;
  await page.route("**/api/generate", route => {
    generated = true;
    return route.fulfill({ status: 202, json: { resumeId, status: "processing" } });
  });
  await page.route("**/api/resume/" + resumeId, route => route.fulfill({
    json: { id: resumeId, candidateName: "Avery Chen", content: generated ? { ...content, summary: "Saved queued result." } : content },
  }));
  await page.goto("/dev/frontend-review/build");
  await page.getByRole("button", { name: "Review details", exact: true }).click();
  await page.getByRole("button", { name: "Confirm & generate resume" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Resume saved to your workspace." })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("Resume preview")).toContainText("Saved queued result.");
});

test("prototype tracker saves stages and renders them after reload on mobile", async ({ page }) => {
  let application = { id: resumeId, company: "Atlas Relay", role: "Product Manager", status: "saved" };
  await page.route("**/api/applications?*", route => route.fulfill({ json: { applications: [application], nextCursor: null } }));
  await page.route("**/api/applications/" + resumeId, route => {
    application = { ...application, ...route.request().postDataJSON() };
    return route.fulfill({ json: { ok: true } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/frontend-review/track");
  await page.getByLabel("Stage for Atlas Relay").selectOption("interview");
  await expect(page.getByLabel("Stage for Atlas Relay")).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel("Stage for Atlas Relay")).toHaveValue("interview");
  await expectNoHorizontalOverflow(page);
});
