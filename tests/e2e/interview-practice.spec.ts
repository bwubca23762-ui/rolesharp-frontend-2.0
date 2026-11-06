import { expect, test } from "@playwright/test";
import { denyExternalBrowserNetwork } from "../helpers/network-deny";

const RESUME_ID = "10000000-0000-4000-8000-000000000001";
const SESSION_ID = "practice-session-test";

const readout = {
  score: 78,
  fillerCount: 0,
  evidenceMatched: ["reconciled 320 vendor invoices"],
  unsupported: [],
  starCoverage: { situation: true, task: true, action: true, result: true },
  coaching: ["State the result clearly."],
};

test("free interview practice starts, records answers, advances, completes, and restarts", async ({ page }) => {
  await denyExternalBrowserNetwork(page);
  await page.addInitScript(() => {
    localStorage.setItem("rolesharp-country-dismissed", "1");
    localStorage.setItem("rolesharp-student-banner-dismissed", "1");
    localStorage.setItem("rolesharp-theme", "light");
  });

  const answeredIndexes = new Set<number>();
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/me") {
      return route.fulfill({ json: { loggedIn: true, email: "member@example.test", emailVerified: true, premium: false, credits: 0 } });
    }
    if (path === "/api/resumes") {
      return route.fulfill({ json: [{ id: RESUME_ID, candidate_name: "Priya Sharma", headline: "Accountant", role_title: "Accounting Intern", created_at: "2026-09-01T00:00:00.000Z" }] });
    }
    if (path === "/api/interview" && request.method() === "POST") {
      return route.fulfill({ json: {
        interview: { items: [
          { q: "Tell me about a result you delivered.", a: "Use your own evidence." },
          { q: "How did you improve a process?", a: "Describe the action you took." },
        ], star: { entries: [] } },
        session: { id: SESSION_ID, tier: "free", questionCount: 2, sessionsRemaining: 1 },
      } });
    }
    if (path === `/api/interview/${SESSION_ID}/answer` && request.method() === "POST") {
      const body = request.postDataJSON() as { index: number; answer?: string };
      answeredIndexes.add(body.index);
      return route.fulfill({ json: {
        readout,
        starEntry: null,
        answeredCount: answeredIndexes.size,
        questionCount: 2,
        nextIndex: body.index === 0 ? 1 : -1,
        done: body.index === 1,
      } });
    }
    return route.fulfill({ status: 404, json: { error: "unregistered_test_request" } });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/interview-prep#prep");
  await expect(page.getByRole("heading", { name: "Get your practice questions" })).toBeVisible();
  await page.getByRole("button", { name: "Generate my questions", exact: true }).click();

  await expect(page.getByText("Practice · question 1 of 2 · free session")).toBeVisible();
  await page.getByLabel("Your answer").fill("I reconciled 320 vendor invoices and made the monthly close faster.");
  await page.getByRole("button", { name: "Get my readout" }).click();
  await expect(page.getByText("Evidence match: 78%", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Re-answer" }).click();
  await expect(page.getByLabel("Your answer")).toBeVisible();
  await page.getByLabel("Your answer").fill("I reconciled the invoices and shortened the monthly close.");
  await page.getByRole("button", { name: "Get my readout" }).click();
  await expect(page.getByText("Evidence match: 78%", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Next question" }).click();

  await expect(page.getByRole("heading", { name: "How did you improve a process?" })).toBeVisible();
  await page.getByLabel("Your answer").fill("I built a tracker that helped the team catch errors every day.");
  await page.getByRole("button", { name: "Get my readout" }).click();
  await expect(page.getByRole("button", { name: "Finish practice" })).toBeVisible();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(page.getByText("Practice complete — 2/2 answered")).toBeVisible();
  await page.getByRole("button", { name: "Restart practice" }).click();
  await expect(page.getByText("Practice · question 1 of 2 · free session")).toBeVisible();
});
