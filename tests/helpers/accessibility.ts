import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function expectNoAxeViolations(page: Page): Promise<void> {
  // Emulate the app's own reduced-motion contract (DESIGN.md: "reduced motion
  // uses the settled state immediately") before the scan. Without this, axe
  // samples elements mid-entrance-fade on slower machines — white text on a
  // danger button at ~54% opacity — and contrast "fails" only where the
  // timing was unlucky. Deterministic on every machine, and it exercises the
  // same settled state a reduced-motion user actually sees.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => {
    // html and body clip overflow-x so the decorative background cannot drag
    // the page sideways. That clipping also clamps scrollWidth, which would let
    // real layout spill slip past this check -- `body { overflow-x: clip }`
    // alone turns a 397px body in a 390px viewport into a reported 390. So
    // measure with the clipping lifted, then put it back exactly as it was.
    const root = document.documentElement;
    const previous = { root: root.style.overflowX, body: document.body.style.overflowX };
    root.style.overflowX = "visible";
    document.body.style.overflowX = "visible";
    const measured = {
      body: document.body.scrollWidth,
      document: root.scrollWidth,
      viewport: root.clientWidth,
    };
    root.style.overflowX = previous.root;
    document.body.style.overflowX = previous.body;
    return measured;
  });

  if (process.env.OVERFLOW_PROBE === "1") {
    const culprits = await page.evaluate(() => {
      const root = document.documentElement;
      const prev = { r: root.style.overflowX, b: document.body.style.overflowX };
      root.style.overflowX = "visible";
      document.body.style.overflowX = "visible";
      const vw = root.clientWidth;
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1 || r.right <= vw + 0.5) continue;
        const kids = [...el.children].some((c) => c.getBoundingClientRect().right > vw + 0.5);
        if (kids) continue; // report the innermost offender only
        out.push(`${el.tagName.toLowerCase()}[${String(el.className || "").slice(0, 45)}] right=${Math.round(r.right)} w=${Math.round(r.width)} "${(el.textContent || "").trim().slice(0, 30)}"`);
      }
      root.style.overflowX = prev.r;
      document.body.style.overflowX = prev.b;
      return { vw, out: out.slice(0, 10) };
    });
    console.log("OVERFLOW PROBE", JSON.stringify(culprits, null, 2));
  }

  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
}

export async function writeAriaSnapshot(
  page: Page,
  locator: string,
  path: string,
): Promise<void> {
  const snapshot = await page.locator(locator).ariaSnapshot();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${snapshot}\n`, "utf8");
}
