import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  writeAriaSnapshot,
} from "../helpers/accessibility";

const evidenceDirectory = ".omo/evidence/task-1-auto-apply";
const repositoryRoot = resolve(__dirname, "../..");
const viewports = [
  { name: "mobile", width: 375, height: 900 },
  { name: "tablet", width: 768, height: 960 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`renders every Jobs primitive without overflow at ${viewport.width}px`, async ({
    page,
  }) => {
    // Given: a viewport required by the Jobs design contract.
    await page.setViewportSize(viewport);

    // When: the development-only primitive showcase is rendered.
    await page.goto("/dev/jobs-primitives");
    await expect(page.getByRole("heading", { name: "Jobs workflow primitives" })).toBeVisible();

    // Then: the full state harness is accessible, stable, and captured.
    await expect(page.getByTestId("score-low-confidence")).toContainText("Low confidence");
    await expect(page.getByTestId("connection-expired")).toContainText("Reconnect required");
    await expect(page.getByTestId("queue-stale")).toContainText("Stale");
    await expect(page.locator('.jobs-system-states [role="alert"]')).toContainText("We could not refresh the queue");
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);

    await page.screenshot({
      path: `${evidenceDirectory}/jobs-primitives-${viewport.name}.png`,
      fullPage: true,
    });
    await writeAriaSnapshot(
      page,
      "main",
      `${evidenceDirectory}/jobs-primitives-${viewport.name}.aria.yml`,
    );
  });
}

test("supports keyboard navigation and dialog focus containment", async ({ page }) => {
  // Given: the development showcase at the narrowest supported viewport.
  await page.setViewportSize(viewports[0]);
  await page.goto("/dev/jobs-primitives");

  // When: a keyboard user traverses every primitive group.
  const keyboardSequence = [
    page.getByRole("link", { name: "Daily matches" }),
    page.getByRole("link", { name: "Auto Apply" }),
    page.getByRole("link", { name: "Application queue" }),
    page.getByRole("link", { name: "Email connection" }),
    page.getByRole("textbox", { name: "Desired title" }),
    page.getByRole("combobox", { name: "Work arrangement" }),
    page.getByRole("spinbutton", { name: "Daily application limit" }),
    page.getByRole("spinbutton", { name: "Minimum fit" }),
    page.getByRole("checkbox"),
    page.getByRole("button", { name: "Save draft" }),
    page.getByRole("button", { name: "Preview rules" }),
    page.getByRole("button", { name: "Disconnect", exact: true }),
    page.getByRole("button", { name: "Reconnect", exact: true }),
    page.getByRole("button", { name: "Connect mailbox" }),
    page.getByRole("button", { name: "Open approval dialog" }),
  ];
  await keyboardSequence[0].focus();
  for (const control of keyboardSequence) {
    await expect(control).toBeFocused();
    if (control !== keyboardSequence.at(-1)) await page.keyboard.press("Tab");
  }

  // When: the keyboard user opens and navigates the dialog.
  const trigger = page.getByRole("button", { name: "Open approval dialog" });
  await page.keyboard.press("Enter");

  // Then: focus enters the dialog, remains contained, and returns on Escape.
  const dialog = page.getByRole("dialog", { name: "Approve application email" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel approval" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Approve package" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cancel approval" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("preserves focus and state meaning with reduced motion", async ({ page }) => {
  // Given: reduced motion is enabled before the page loads.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/jobs-primitives");

  // When: every semantic failure state is inspected.
  const transitionDuration = await page
    .getByRole("button", { name: "Open approval dialog" })
    .evaluate((element) => getComputedStyle(element).transitionDuration);

  // Then: state text remains present and non-essential transitions are removed.
  expect(transitionDuration).toMatch(
    /^(0s|0\.001ms|1e-06s)(,\s*(0s|0\.001ms|1e-06s))*$/,
  );
  await expect(page.getByTestId("score-low-confidence")).toBeVisible();
  await expect(page.getByTestId("connection-expired")).toBeVisible();
  await expect(page.getByTestId("connection-disconnected")).toBeVisible();
  await expect(page.getByTestId("queue-stale")).toBeVisible();
  await expect(page.locator('.jobs-system-states [role="alert"]')).toBeVisible();
});

test("survives long labels and unbroken content at mobile width", async ({ page }) => {
  // Given: a narrow screen containing adversarial fixture text.
  await page.setViewportSize(viewports[0]);
  await page.goto("/dev/jobs-primitives");

  // When: the long queue row and recipient identity render.
  const stressedRow = page.getByTestId("queue-long-label");
  await expect(stressedRow).toContainText("Principal");
  await expect(stressedRow).toContainText("applications");

  // Then: neither the component nor the document clips primary content.
  const rowWidths = await stressedRow.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(rowWidths.scroll).toBeLessThanOrEqual(rowWidths.client);
  await expectNoHorizontalOverflow(page);
});

test("keeps react-scan behind the development-only route boundary", async () => {
  // Given: the source and package contract for the primitive route.
  const [pageSource, packageSource] = await Promise.all([
    readFile(resolve(repositoryRoot, "app/dev/jobs-primitives/page.tsx"), "utf8"),
    readFile(resolve(repositoryRoot, "package.json"), "utf8"),
  ]);

  // When: the development instrumentation contract is inspected.
  const productionDependencies = packageSource.slice(
    packageSource.indexOf('"dependencies"'),
    packageSource.indexOf('"overrides"'),
  );

  // Then: production returns not-found and react-scan is exact, dynamic, and dev-only.
  expect(pageSource).toContain('process.env.NODE_ENV !== "development"');
  expect(pageSource).toContain('import("react-scan/lite")');
  expect(pageSource).toContain("instrument().stop");
  expect(pageSource).not.toMatch(/^import .* from ["']react-scan["'];?$/m);
  expect(packageSource).toMatch(/"react-scan": "0\.5\.7"/);
  expect(productionDependencies).not.toContain('"react-scan"');
});

test("locks the exact development-only browser tooling versions", async () => {
  // Given: the committed package and npm lock contracts.
  const [packageSource, lockSource] = await Promise.all([
    readFile(resolve(repositoryRoot, "package.json"), "utf8"),
    readFile(resolve(repositoryRoot, "package-lock.json"), "utf8"),
  ]);

  // When: exact pins and resolved package entries are inspected.
  const pins = [
    ["@playwright/test", "1.62.0"],
    ["@axe-core/playwright", "4.12.1"],
    ["lighthouse", "13.4.1"],
    ["react-scan", "0.5.7"],
  ] as const;

  // Then: the manifest and lockfile cannot drift to ranges or other versions.
  for (const [name, version] of pins) {
    expect(packageSource).toContain(`"${name}": "${version}"`);
    const lockName = name.replace("/", "\\/");
    expect(lockSource).toMatch(
      new RegExp(`"node_modules\\/${lockName}": \\{\\s*"version": "${version}"`),
    );
  }
});
