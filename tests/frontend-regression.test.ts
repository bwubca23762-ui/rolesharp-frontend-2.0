import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DEFAULT_AUTH_DESTINATION } from "../lib/auth-redirect";
import { planLabel } from "../lib/plan-label";

test("the redesign prototype reuses the landing interactions and live review flows", () => {
  const prototype = source("app/dev/frontend-review/prototype-page.tsx");
  assert.match(prototype, /<ThemeToggle compact/);
  assert.match(prototype, /<LanguagePicker/);
  assert.match(prototype, /<LandingQuote compact/);
  assert.match(prototype, /\/login\?next=/);
  assert.match(prototype, /href="\/tracker"/);
  assert.match(source("app/dev/frontend-review/prototype.module.css"), /--ink:\s*var\(--fg\)/);
});

function walkSurfaces(): string[] {
  const roots = ["app", "components", "lib"];
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(new URL(`../${dir}`, import.meta.url), {
      withFileTypes: true,
    })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith("."))
          continue;
        walk(path);
      } else if (
        /\.(tsx?|ts)$/.test(entry.name) &&
        !entry.name.endsWith(".d.ts")
      ) {
        found.push(path);
      }
    }
  };
  roots.forEach(walk);
  // lib/limits.ts and lib/env.ts are where the numbers legitimately live.
  return found.filter(
    (path) => path !== "lib/limits.ts" && path !== "lib/env.ts",
  );
}

// Every "this string must not appear" assertion should run against this rather
// than source(): the comment explaining why a thing was removed names the thing,
// so a naive doesNotMatch fails precisely when the code is documented best.
function code(path: string) {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function cssSource() {
  // admin-modern.css is a real, layout-imported stylesheet (the admin v2/v3
  // layer) — the defined-in-a-stylesheet guard must see it, or every class it
  // defines reads as "unstyled" to this test.
  return (
    [
      "shared.css",
      "admin.css",
      "marketing.css",
      "auth.css",
      "tool.css",
      "legacy-bridge.css",
    ]
      .map((file) => source(`app/compat/${file}`))
      .join("\n") +
    "\n" +
    source("app/admin/admin-modern.css")
  );
}

// The heading is actually rendered and checked at both viewports by
// "logged-out tool pages keep a visible primary heading" and "Phase 5 login
// preserves safe workspace continuity" in tests/e2e/customer-page-families.
// What stays here is the structural reason those hold: the h1 comes from
// AuthShell's PageHeader, so login must route through the shell rather than
// hand-rolling a heading that can drift out of the accessibility tree.
test("auth screens take their primary heading from the shared shell", () => {
  const login = source("app/login/page.tsx");
  const shells = source("components/ui/primitives/Shells.tsx");
  assert.match(login, /<AuthShell/);
  assert.match(shells, /export function AuthShell[\s\S]*<PageHeader/);
});

test("landing sections use one container and a consistent heading hierarchy", () => {
  const home = source("app/page.tsx");
  const componentPaths = ["components/marketing/RoleSharpLanding.tsx"];
  assert.match(home, /<MarketingShell>/);
  assert.equal((home.match(/<RoleSharpLanding \/>/g) ?? []).length, 1);
  const hero = source("components/marketing/RoleSharpLanding.tsx");
  assert.equal((hero.match(/<h1\b/g) ?? []).length, 1);
  assert.match(hero, /href="\/checker"/);
  assert.match(hero, /href="\/resume-templates"/);
  for (const path of componentPaths) {
    const component = source(path);
    assert.doesNotMatch(
      component,
      /<Section(?![^>]*asContainer=\{false\})[^>]*>\s*<Container/,
    );
    assert.doesNotMatch(component, /<h2[^>]*>[\s\S]{0,160}<h2/);
  }
  assert.doesNotMatch(source("app/resume-preview.tsx"), /<main/);
});

test("marketing sections do not double-wrap shared containers", () => {
  for (const path of [
    "app/cover-letter-generator/page.tsx",
    "app/interview-prep/page.tsx",
    "app/pricing/page.tsx",
    "app/prompts/page.tsx",
    "app/resume-builder/page.tsx",
    "app/resume-examples/page.tsx",
    "app/resume-tailoring/page.tsx",
    "app/resume-templates/page.tsx",
    "app/resume-translator/page.tsx",
    "app/tool-seo.tsx",
  ]) {
    assert.doesNotMatch(
      source(path),
      /<Section(?![^>]*asContainer=\{false\})[^>]*>\s*<Container/,
    );
  }
  const footer = source("app/footer.tsx");
  assert.match(footer, /lg:grid-cols-4/);
  assert.match(footer, /lg:col-span-2/);
});

test("core dialogs trap focus and restore the invoking control", () => {
  const dialog = source("components/ui/AccessibleDialog.tsx");
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /returnFocusRef\.current\?\.focus\(\)/);
  // The five tool pages reach the dialog through the shared PreviewModal, so
  // the focus trap is wired once rather than re-declared per page.
  assert.match(source("components/ui/PreviewModal.tsx"), /<AccessibleDialog/);
  for (const path of [
    "app/build/page.tsx",
    "app/checker/page.tsx",
    "app/resume-fixer/page.tsx",
    "app/resume-maker/page.tsx",
    "app/linkedin-checker/page.tsx",
  ]) {
    assert.match(source(path), /<PreviewModal/);
  }
});

test("admin payment and resume detail views use accessible dialogs and controls", () => {
  for (const path of [
    "app/admin/views/payments-view.tsx",
    "app/admin/views/resumes-view.tsx",
  ]) {
    const view = source(path);
    assert.match(view, /<AccessibleDialog/);
    assert.doesNotMatch(view, /position:"fixed",inset:0/);
  }
  // This used to pin className="admin-link-btn". That class is defined in no
  // stylesheet, so the assertion was guarding a name rather than the behaviour
  // it stood for: the row opens from a real button, not a click handler on a
  // cell. Assert that instead — it survives the class going away.
  assert.match(
    code("app/admin/views/payments-view.tsx"),
    /<button type="button"[^>]*onClick=\{\(\) => setDetail\(p\)\}/,
  );
});

test("session failures are finite and retryable", () => {
  const session = source("app/session-context.tsx");
  const jobs = source("app/jobs/jobs-finder.tsx");
  const build = source("app/build/page.tsx");
  assert.match(session, /AbortController/);
  assert.match(session, /setError\(/);
  assert.match(jobs, /sessionError/);
  assert.match(build, /Your workspace could not load/);
});

test("checker autocomplete cancels stale requests through the shared hook", () => {
  const checker = source("app/checker/page.tsx");
  const autocomplete = source("app/build/use-autocomplete.ts");
  assert.match(checker, /useAutocomplete<Company>/);
  assert.match(checker, /useAutocomplete<Role>/);
  assert.doesNotMatch(checker, /companyDeb|roleDeb/);
  assert.match(autocomplete, /AbortController/);
  assert.match(autocomplete, /requestSequence/);
  assert.match(autocomplete, /if \(!response\.ok\)/);
});

test("student expired links use an error status instead of success styling", () => {
  assert.match(
    source("components/StudentOfferCard.tsx"),
    /studentStatus === "expired"[\s\S]*?<StatusBanner variant="error">/,
  );
});

test("country and account controls retain native accessible relationships", () => {
  const picker = source("components/ui/CountryPicker.tsx");
  const login = source("app/login/page.tsx");
  const pricing = source("app/pricing-toggle.tsx");
  assert.match(picker, /id=\{id\}/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /aria-activedescendant/);
  assert.match(login, /<form[\s\S]{0,120}onSubmit=/);
  assert.match(login, /htmlFor="login-invite"/);
  assert.match(pricing, /aria-pressed=\{active\}/);
});

test("standalone reports expose a main landmark", () => {
  const report = source("app/resume-keyword-report-2026/page.tsx");
  const embed = source("app/tools/embed-ats-checker/page.tsx");
  assert.match(report, /<MarketingShell\b/);
  assert.match(report, /<\/MarketingShell>/);
  assert.match(embed, /<main>/);
  assert.match(embed, /<\/main>/);
});

test("student anchor ID is unique on pricing", () => {
  const pricing = source("app/pricing/page.tsx");
  assert.equal((pricing.match(/id="student-access"/g) ?? []).length, 1);
  assert.match(pricing, /env\.studentOfferEnabled/);
  assert.doesNotMatch(
    source("components/StudentOfferCard.tsx"),
    /id="student"/,
  );
});

test("pricing presents Premium as fixed-term access without subscription shorthand", () => {
  const toggle = source("app/pricing-toggle.tsx");
  const pricing = source("app/pricing/page.tsx");
  const llms = source("app/llms.txt/route.ts");
  assert.match(toggle, /Premium access term/);
  assert.match(toggle, /-day pass/);
  assert.match(toggle, /Never auto-renews/);
  assert.match(toggle, /returns to Free/);
  assert.doesNotMatch(toggle, /billed monthly|\/month|\/year/);
  assert.match(pricing, /env\.daysMonthly/);
  assert.match(pricing, /env\.daysYearly/);
  assert.match(pricing, /env\.premiumMonthlyLimit/);
  // "Purchase boundaries" methodology callout retired 2026-10-18; the
  // fixed-term claim itself now lives in ModernPlans copy ("never
  // auto-renews", "drops to Free at term end").
  assert.doesNotMatch(pricing, /subscription/i);
  // The pass lengths are interpolated now, so pinning the literal "30-day"
  // would pin today's config rather than the shape of the claim.
  assert.match(llms, /Premium \$\{env\.daysMonthly\}-day pass/);
  assert.match(llms, /Premium \$\{env\.daysYearly\}-day pass/);
  assert.match(llms, /Neither pass auto-renews/);
});

test("Phase 4 directories share explicit evidence-boundary primitives", () => {
  const provenance = source("components/marketing/DirectoryProvenance.tsx");
  const marketing = source("components/marketing/index.ts");
  const templates = source("app/resume-templates/page.tsx");
  const catalog = source("app/resume-templates/template-catalog.tsx");
  const examples = source("app/resume-examples/page.tsx");
  assert.match(provenance, /curated: "Curated taxonomy"/);
  assert.match(provenance, /database: "Database-backed catalog"/);
  assert.match(provenance, /guidance: "General guidance"/);
  assert.match(provenance, /illustrative: "Illustrative sample"/);
  assert.match(provenance, /export function DirectoryEvidenceNote/);
  assert.match(provenance, /export function DirectoryMethodCard/);
  assert.match(marketing, /export \* from "\.\/DirectoryProvenance"/);
  assert.match(templates, /<DirectoryMethodCard/);
  assert.match(catalog, /<SampleProvenance/);
  assert.match(examples, /Illustrative resume guidance, organized by role/);
  assert.match(examples, /<DirectoryMethodCard/);
  assert.doesNotMatch(
    templates,
    /roughly 75%|proven to parse|exported text accessible to ATS software/,
  );
  assert.doesNotMatch(
    examples,
    /get results|hiring managers in that role look for first|most in-demand role pages/,
  );
});

test("high-intent routes expose consistent method limits and workflow handoffs", () => {
  const checker = source("app/checker/page.tsx");
  const fixer = source("app/resume-fixer/page.tsx");
  const jobs = source("app/jobs/page.tsx");
  const autoApply = source("app/auto-apply/page.tsx");
  const tracker = source("app/tracker/page.tsx");

  for (const page of [checker, fixer, jobs, autoApply]) {
    assert.match(page, /MethodologyCallout/);
    assert.match(page, /RelatedWorkflow/);
  }
  assert.match(checker, /diagnostic estimate, not an employer decision/);
  assert.match(fixer, /not manufacture it/);
  assert.match(jobs, /verify at the original source/);
  assert.match(
    autoApply,
    /Provider acceptance is recorded as delivery unverified/,
  );
  assert.match(autoApply, /Unknown outcomes cannot trigger an automatic retry/);
  assert.match(
    autoApply,
    /the posting asks for applications by email and supplies the recipient/,
  );
  assert.doesNotMatch(
    autoApply,
    /Authorized campaign|Time-limited 30-day consent/,
  );
  assert.match(tracker, /do not infer employer outcomes/);
  assert.doesNotMatch(tracker, /MethodologyCallout|RelatedWorkflow/);
});

test("global prompts yield to mobile navigation", () => {
  assert.match(source("app/nav.tsx"), /dataset\.mobileNavOpen = open/);
  assert.match(source("app/first-visit-country.tsx"), /first-visit-country/);
  assert.match(
    source("app/globals.css"),
    /data-mobile-nav-open="true".*first-visit-country/,
  );
});

test("tool preview actions only float after useful content exists", () => {
  // The launcher is gated once, inside the shared component; each page supplies
  // the condition that means "there is something worth previewing".
  assert.match(
    source("components/ui/PreviewModal.tsx"),
    /\{visible && \([\s\S]*className="preview-fab"/,
  );
  assert.match(source("app/checker/page.tsx"), /visible=\{Boolean\(result\)\}/);
  assert.match(
    source("app/resume-fixer/page.tsx"),
    /visible=\{Boolean\(result\)\}/,
  );
  assert.match(
    source("app/linkedin-checker/page.tsx"),
    /visible=\{Boolean\(result\)\}/,
  );
  assert.match(
    source("app/resume-maker/page.tsx"),
    /visible=\{Boolean\(hasPreviewContent\)\}/,
  );
  assert.match(source("app/build/page.tsx"), /visible=\{hasPreviewContent\}/);
  assert.match(
    source("app/build/page.tsx"),
    /fabText=\{out \? "Resume & exports"/,
  );
});

test("mobile builder keeps generated exports and saved-work handoff reachable", () => {
  const build = source("app/build/page.tsx");
  assert.match(build, /fabLabel=\{out \? "Open generated resume and exports"/);
  assert.match(build, /href=\{`\/api\/resume\/\$\{out\.resumeId\}\/pdf`\}/);
  assert.match(build, /href=\{`\/api\/resume\/\$\{out\.resumeId\}\/docx`\}/);
  assert.match(build, /Open saved resume library/);
  assert.match(build, /diagnostic estimate:[\s\S]*not an employer decision/);
  // StepProgress navigates by element id. Asserting every jump target exists
  // is the actual contract; the previous form required the heading to sit
  // within 80 characters of the anchor, which broke on markup changes even
  // when no target had gone missing.
  for (const stepId of [
    "step-profile",
    "step-target",
    "step-evidence",
    "step-generate",
    "step-export",
  ]) {
    assert.match(
      build,
      new RegExp(`id="${stepId}"`),
      `missing step wizard target ${stepId}`,
    );
  }
  // This used to pin the `.badge-model` rule in the compat sheet. Phase 6
  // deleted that rule along with the rest of the compat button and badge CSS,
  // and pinning a stylesheet was never the point: what has to survive is that
  // the builder still shows the plan, the credit balance and the completeness
  // reading. Assert the indicators, not the paint.
  assert.match(build, /<Badge variant=\{premium \? "premium" : "default"\}/);
  assert.match(build, /\{credits\} credits/);
  assert.match(build, /Profile \{completeness\}%/);
});

test("manual maker restores a bounded text-only device draft", () => {
  const maker = source("app/resume-maker/page.tsx");
  const draftHook = source("lib/resume-form/use-local-draft.ts");
  const _makerLayout = source("app/resume-maker/layout.tsx");
  assert.match(
    maker,
    /const MAKER_DRAFT_MAX_AGE_MS = 30 \* 24 \* 60 \* 60 \* 1_000/,
  );
  assert.match(maker, /key: MAKER_DRAFT_KEY/);
  assert.match(maker, /maxAgeMs: MAKER_DRAFT_MAX_AGE_MS/);
  // Expiry, versioning and stale-draft removal are enforced once, in the shared
  // hook, for every tool that stores a device-local draft.
  assert.match(draftHook, /Date\.now\(\) - savedAt <= maxAgeMs/);
  assert.match(draftHook, /localStorage\.removeItem\(key\)/);
  assert.match(draftHook, /localStorage\.setItem\(key, JSON\.stringify\(/);
  assert.match(maker, /Photos are deliberately excluded/);
  // Assert the saved payload itself, rather than proximity to the write call.
  const makerDraftValue = maker.match(/value: \{[\s\S]*?\n {4}\},/)?.[0] ?? "";
  assert.ok(makerDraftValue, "manual maker draft payload not found");
  assert.doesNotMatch(makerDraftValue, /photoDataUrl/);
  assert.match(maker, /Photos are never stored in the draft/);
  assert.match(maker, /Clear saved draft/);
  // The maker's SEO essay wall was retired 2026-10-18 (pure workspace) — the
  // manual-maker-method-heading anchors it used to assert are gone with it.
});

test("tracker updates expose mobile-safe recovery and polite save feedback", () => {
  const tracker = source("app/tracker/page.tsx");
  assert.match(tracker, /Your previous tracker stage was restored/);
  assert.match(tracker, /Follow-up date saved/);
  assert.match(tracker, /Application note saved/);
  assert.match(tracker, /role="status" aria-live="polite"/);
  // The mobile-safety half of this used to pin Tailwind class strings. It is
  // measured for real by "settings, support, and tracker expose the signed-in
  // account essentials" in tests/e2e/account-admin-workspaces, which loads
  // /tracker at 375px and 1280px and asserts no horizontal overflow.
});

test("high-input tool pages expose accessible control names", () => {
  for (const path of [
    "app/resume-fixer/page.tsx",
    "app/linkedin-checker/page.tsx",
    "app/resume-maker/page.tsx",
  ]) {
    assert.match(source(path), /aria-label=/);
  }
  const directorySearch = source("components/reading/DirectorySearch.tsx");
  assert.match(directorySearch, /<label htmlFor=\{searchId\}>/);
  assert.match(directorySearch, /<Input\s+id=\{searchId\}/);
  assert.match(
    source("app/forgot-password/page.tsx"),
    /htmlFor="forgot-email"/,
  );
  assert.match(source("app/forgot-password/page.tsx"), /id="forgot-email"/);
});

// These assert element semantics, not styling: a locked control has to be a
// real <button>. An <a> without a usable href is skipped by keyboard
// navigation and announced as a link that goes nowhere. Matching on the tag
// plus the `locked` marker keeps that guarantee while letting the classes be
// restyled freely.
// These used to key on the compat `locked` class. Phase 6 removed it, but the
// invariant it stood for is unchanged and is the whole point of the pair: a
// locked control must render a <button>, never an <a> without a usable href,
// which keyboard navigation skips and screen readers announce as a link going
// nowhere. `Button` renders <button> unless given as="a", so assert that.
test("premium DOCX lock is a disabled button, not an empty link", () => {
  const maker = source("app/resume-maker/page.tsx");
  // The lock message names the Student tier explicitly: DOCX is Platform
  // Premium only (tier-features docxExport), and the student tier deliberately
  // carries docxExport: false — the copy is the comms decision, pinned here.
  const docx = maker.match(
    /<Button[^>]*title=\{me\?\.premiumSource === "student"[^>]*>/,
  );
  assert.ok(docx, "the DOCX lock control is gone");
  assert.match(docx[0], /\bdisabled\b/);
  assert.doesNotMatch(docx[0], /as="a"/);
  assert.match(docx[0], /Student plan includes clean, watermark-free PDF/);
});

test("locked authenticated and country actions remain semantic buttons", () => {
  const build = source("app/build/page.tsx");
  const country = source("app/checker/checker-country-cta.tsx");
  assert.doesNotMatch(build, /href=\{premiumForOutput \?/);

  // The three premium actions plus both DOCX locks. Match backwards from the
  // action to the tag that opens it — `[^>]*` cannot be used here because the
  // onClick contains an arrow function, and `=>` holds a `>`. The DOCX locks
  // route through docxLockedMessage, which names the Student tier for student
  // accounts (the tier feature split is enforced server-side).
  const gated = [
    ...build.matchAll(
      /premiumAction\("(?:cover|interview|linkedin)"\)|setErr\(docxLockedMessage\)/g,
    ),
  ];
  assert.equal(
    gated.length,
    5,
    `expected the five gated controls, saw ${gated.length}`,
  );
  for (const m of gated) {
    const open = build.slice(0, m.index).lastIndexOf("<");
    const tag = build.slice(open, m.index);
    assert.match(
      tag,
      /^<Button\b/,
      `gated control is not a Button: ${tag.slice(0, 60)}`,
    );
    assert.doesNotMatch(tag, /as="a"/);
  }

  assert.doesNotMatch(country, /href=\{code \?.*"#"/);
  const picker = country.match(/<Button[^>]*\bdisabled\b[^>]*>/);
  assert.ok(picker, "the country-gate control is gone");
  assert.doesNotMatch(picker[0], /as="a"/);
});

test("marketing typography stays within the responsive heading scale", () => {
  // LandingHero was deleted with the duplicate-component cleanup; the live
  // homepage hero is ModernHeroAndMethod — the pin follows the live surface.
  const hero = source("components/marketing/ModernHeroAndMethod.tsx");
  const globals = source("app/globals.css");
  // The clamp floor/ceiling are pinned, not three breakpoints. v5 raised the
  // ceiling to 6rem (Apple keynote scale); the owner's later "hero too much
  // big" direction compacted it so the headline stops consuming the viewport
  // and the product suite shows above the fold. The 2.35rem floor keeps the
  // claim legible without undoing the compact hero.
  const clamp = hero.match(/text-\[clamp\(([\d.]+)rem,[^,]+,([\d.]+)rem\)\]/);
  assert.ok(clamp, "the h1 no longer uses a single fluid clamp");
  assert.ok(
    Number(clamp[1]) >= 2.25,
    `h1 floor ${clamp[1]}rem is below the readable minimum`,
  );
  assert.ok(
    Number(clamp[2]) <= 4,
    `h1 ceiling ${clamp[2]}rem re-inflates the compacted hero`,
  );
  // The display family is NOT set with a utility on the h1, and must not be:
  // the unlayered `h1,h2,...` base rule below already applies var(--font-display)
  // and outranks @layer utilities anyway. Weight and leading do need the
  // important modifier for exactly that reason.
  assert.match(
    globals,
    /h1, h2, h3, h4, h5, h6 \{[\s\S]*?font-family: var\(--font-display\)/,
  );
  assert.match(hero, /font-extrabold!/);
  assert.match(hero, /leading-\[1\.0[0-9]\]!/);
  // Deep-blue palette: muted copy remains a dedicated high-contrast token in both themes.
  assert.match(globals, /--color-text-faint: #52647A/);
  assert.match(globals, /--color-dark-text-faint: #A9BAD1/);
  assert.match(globals, /--color-brand-amber:/);
  assert.match(
    globals,
    /\[data-theme="dark"\][\s\S]*--color-brand-amber-ink: #FFF7E6/,
  );
  assert.match(globals, /--color-warning: #C2410C/);
});

test("landing page presents three clear entry paths with responsive evidence", () => {
  const landing = source("components/marketing/RoleSharpLanding.tsx");
  assert.match(landing, /href="\/checker"/);
  assert.match(landing, /href="\/resume-templates"/);
  assert.match(landing, /"\/tracker"/);
  assert.match(landing, /Evidence review/);
  assert.doesNotMatch(landing, /unsplash|pexels/i);
  // The replacement page keeps a real product artifact in the hero rather
  // than relying on generic stock imagery or a detached illustration.
  assert.match(source("app/resume-preview.tsx"), /rs-paper-preview/);
  assert.match(source("app/template-thumb.tsx"), /rs-paper-preview/);
});

// The allowances were advertised as literal text in 15 places while being
// enforced from env, so changing a limit changed what users GOT without
// changing what they were PROMISED. Every surface now reads the number, from
// lib/env.ts on the server or lib/limits.ts in a client component.
test("no page states a plan allowance as a hardcoded number", () => {
  // This list used to be hand-maintained, which meant it only ever caught the
  // files someone remembered to add. app/login/page.tsx was never on it, so
  // production advertised "3 free resumes/month" on the signup page for the
  // entire life of the retune -- the single most-read wrong number on the site.
  // A sweep that needs a human to enumerate its own inputs is not a sweep, so
  // it now walks every page and component and skips nothing.
  const surfaces = walkSurfaces();
  // A digit or number-word immediately before "tailored resume(s)" is the
  // shape that drifts. Interpolations read as `} tailored resumes`, so they
  // do not match. "one" is excluded on purpose: /pricing explains what counts
  // as one tailored resume, which is prose about the unit, not an allowance.
  // The qualifier is optional: /students said "5 company-tailored resumes a
  // month" and slipped past a pattern that required "tailored" to follow the
  // number directly.
  const hardcoded =
    /\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+(?:[a-z]+-)?tailored\s+resumes?/iu;
  // /help phrases the same promise without the word "tailored".
  const bareAllowance =
    /\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+resumes?\s+a\s+month/iu;
  // The referral reward and its rolling ceiling were literals in three places
  // while the ceiling itself was a bare `>= 3` in lib/credits.ts.
  const referralLiteral =
    /\b\d+\s+credits?\s+per\s+(rolling\s+)?(month|\d+\s+days)/iu;
  // Interpolating the count next to a hardcoded plural is the same defect with
  // the number moved: /pricing shipped "1 free tailored resumes" the moment the
  // free plan became 1, and the patterns above cannot see it because they all
  // require a literal digit. tailoredResumes() exists precisely for this.
  // Bounded to the same clause on purpose: an unbounded gap ran past a comma
  // and matched a "resumes" three FAQ answers later in app/build/page.tsx.
  const interpolatedPlural =
    /\$?\{(env\.(free|premium|student)MonthlyLimit|DEFAULT_(FREE|PREMIUM|STUDENT)_MONTHLY_LIMIT)\}[^<{}`'".,;!?]{0,24}\bresumes\b/u;
  for (const path of surfaces) {
    const text = source(path);
    for (const [label, pattern] of [
      ["an allowance", hardcoded],
      ["a bare allowance", bareAllowance],
      ["a referral cap", referralLiteral],
      ["a plural next to an interpolated count", interpolatedPlural],
    ] as const) {
      const hit = text.match(pattern);
      assert.equal(hit, null, `${path} hardcodes ${label}: ${hit?.[0]}`);
    }
  }
});

test("the referral cap is configured, not a magic number", () => {
  assert.match(source("lib/credits.ts"), /env\.referralMonthlyCap/);
  assert.doesNotMatch(source("lib/credits.ts"), /count \?\? 0\) >= \d/);
});

// Students are premium, so every `!premium` test excluded them from credits.
// That made the student tier the only one with no way past its cap, while
// students are the group most able to earn credits by inviting classmates.
test("students can spend credits past their cap; paid Premium cannot", () => {
  const entitlements = source("lib/entitlements.ts");
  assert.match(
    entitlements,
    /canUseCredit: isStudent && remaining <= 0 && credits > 0/,
  );
  assert.match(
    entitlements,
    /canGenerate: remaining > 0 \|\| \(isStudent && credits > 0\)/,
  );
  // The generate route must trust the entitlement instead of re-deriving it,
  // or the flag above never reaches the spend path.
  const generate = source("app/api/generate/route.ts");
  assert.match(generate, /const useCredit = ent\.canUseCredit;/);
  assert.doesNotMatch(generate, /useCredit = !ent\.premium/);
});

test("landing motion tells the evidence-to-score story and respects reduced motion", () => {
  const globals = source("app/globals.css");
  // Measured, not assumed: all five ScrollReveal wrappers on this page never
  // receive .rs-reveal-in, so whatever they wrap keeps its resting transform.
  // The Ink & Signal Reveal primitive replaced ScrollReveal sitewide on this
  // page; the hero itself stays eager/server-visible per the LCP law.
  assert.doesNotMatch(
    code("components/marketing/ModernHeroAndMethod.tsx"),
    /ScrollReveal/,
  );
  assert.doesNotMatch(
    code("components/marketing/ModernHeroAndMethod.tsx"),
    /data-countup/,
    "the countup meter was removed; drop its machinery in the net-CSS pass",
  );
  // The rvl-* reduced-motion block is the new global guarantee.
  assert.match(globals, /prefers-reduced-motion: reduce[\s\S]*\.rvl/);
  assert.match(globals, /--motion-spring:/);
  assert.match(
    globals,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.rs-interactive-lift:hover[\s\S]*transform: none/,
  );
});

test("navigation uses one route registry and one Auto Apply destination per surface", () => {
  const nav = source("app/nav.tsx");
  const registry = source("app/navigation-registry.ts");
  const shell = source("app/app-shell.tsx");
  const contextNav = source("app/workspace-context-nav.tsx");
  const globals = source("app/globals.css");

  assert.match(nav, /findNavigationGroup/);
  assert.match(nav, /FEATURED_WORKFLOW_ROUTE/);
  assert.match(registry, /id: "products"/);
  assert.match(registry, /id: "jobs"/);
  assert.match(registry, /label: "Jobs"/);
  assert.match(registry, /label: "Find Jobs"/);
  assert.match(registry, /label: "Auto Mail Jobs"/);
  assert.match(registry, /label: "Email-Sending Jobs"/);
  assert.match(registry, /id: "resources"/);
  assert.match(registry, /id: "workspace"/);
  assert.match(registry, /id: "account"/);
  assert.match(registry, /label: "Build & improve"/);
  assert.match(registry, /label: "Apply & organize"/);
  assert.equal((registry.match(/href: "\/auto-apply"/g) ?? []).length, 1);
  assert.equal((registry.match(/href: "\/jobs"/g) ?? []).length, 1);
  assert.equal((registry.match(/href: "\/daily-matches"/g) ?? []).length, 2);
  assert.equal(
    (registry.match(/href: "\/application-queue"/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(nav, /PUBLIC_DESKTOP_ROUTES[\s\S]{0,160}jobsRoute/);
  assert.doesNotMatch(nav, /href: "\/auto-apply"/);
  assert.match(shell, /<WorkspaceContextNav \/>/);
  assert.match(contextNav, /WORKSPACE_CONTEXT_ROUTES/);
  assert.match(contextNav, /isOperationalWorkspacePath/);
  assert.match(contextNav, /!railVisible/);
  assert.match(contextNav, /aria-label="RoleSharp workspace"/);
  assert.doesNotMatch(nav, /onPointerLeave=\{\(\) => setMenuOpen\(null\)\}/);
  assert.doesNotMatch(nav, /top-\[calc\(100%\+12px\)\]/);
  assert.match(globals, /\.rs-nav-dropdown\s*\{[\s\S]*?top: 100%/);
  assert.doesNotMatch(globals, /\.rs-nav-mega-menu::before/);
  assert.match(registry, /href: "\/billing"/);
  assert.match(registry, /href: "\/security"/);
  assert.match(registry, /href: "\/support"/);
  assert.match(registry, /label: "Billing & Access"/);
  assert.match(
    registry,
    /WORKSPACE_CONTEXT_ROUTES: readonly NavigationRoute\[] = AUTHENTICATED_WORKSPACE_ROUTES/,
  );
  assert.match(nav, /rs-mobile-theme-row/);
  assert.match(nav, /<ThemeToggle compact/);
  // The deleted LandingHero's image alt ("Example RoleSharp diagnosis…")
  // went with the image; the live hero carries no imagery at all, so there is
  // no hero visual identity to pin here anymore.
  // Two hero assertions used to live here, in a test about navigation, and both
  // are gone on purpose. "Example ATS movement" pinned the drawn meter the
  // redesign replaced. The other banned public/shots/*.webp from the hero — it
  // arrived in the b18449d bulk commit with no stated reason, the two files it
  // banned were referenced by nothing for the next three weeks, and the
  // 2026-08-15 ink-instrument-v3 approval requires real product imagery. The
  // hero's own coverage above owns the screenshot now.
  assert.match(globals, /\.rs-nav-link:hover,\s*\.rs-nav-link:focus-visible,/);
  assert.match(globals, /box-shadow:\s*inset 0 0 0 1px/);
});

test("country picker returns every country instead of only countries with companies", () => {
  const countryList = source("lib/country-list.ts");
  const picker = source("components/ui/CountryPicker.tsx");
  assert.match(countryList, /left join companies/);
  assert.doesNotMatch(countryList, /\n\s+join companies/);
  assert.match(countryList, /rules: row\.rules/);
  assert.match(countryList, /fallbackCountries/);
  assert.match(countryList, /databaseCodes/);
  assert.match(picker, /includeRules \? "\/api\/countries\/rules"/);
  assert.match(
    source("app/resume-maker/page.tsx"),
    /<CountryPicker[\s\S]*?includeRules/,
  );
  assert.match(picker, /Supported/);
  assert.match(picker, /receivedCodes/);
  assert.match(picker, /fallbackCountries/);
  assert.match(source("lib/country-codes.ts"), /ISO 3166-1 alpha-2 fallback/);
});

test("manual maker applies safe country-aware photo controls", () => {
  const maker = source("app/resume-maker/page.tsx");
  const policy = source("lib/resume-photo.ts");
  assert.match(maker, /Target application country/);
  assert.match(maker, /employer or job posting specifically requests a photo/i);
  assert.match(maker, /photoDataUrl: photoAllowed/);
  assert.match(policy, /legacy \"yes\" is[\s\S]*never required/i);
  assert.match(policy, /verified && status === "required"/);
});

test("AI builder preserves ISO country codes beyond the former ten-country list", () => {
  const build = source("app/build/page.tsx");
  assert.doesNotMatch(build, /const COUNTRIES = \[/);
  assert.match(build, /countryCode, careerLevel/);
  assert.match(build, /statesFor\(countryCode\)/);
  assert.match(build, /country=\$\{countryCode\}/);
});

test("tool-intent landing pages expose a real entry point, not just prose", () => {
  // These four pages rank for tool queries. They used to be pure marketing with
  // a /pricing CTA, so the traffic bounced. Each must now mount a working panel:
  // cover/interview run the existing Premium endpoints against a saved resume,
  // translator/tailoring hand off to /build through its fragment prefill.
  const mounts: [string, string][] = [
    ["app/cover-letter-generator/page.tsx", "ResumeToolPanel"],
    ["app/interview-prep/page.tsx", "ResumeToolPanel"],
    ["app/resume-translator/page.tsx", "BuildLauncher"],
    ["app/resume-tailoring/page.tsx", "BuildLauncher"],
  ];
  for (const [file, component] of mounts) {
    assert.match(
      source(file),
      new RegExp(`<${component}`),
      `${file} must mount ${component}`,
    );
  }
  // The panels must keep using the endpoints that already exist rather than
  // growing parallel ones.
  const panel = source("components/ResumeToolPanel.tsx");
  assert.match(panel, /\/api\/resumes/);
  assert.match(panel, /`\/api\/\$\{kind\}`/);
  assert.match(
    panel,
    /status === 402/,
    "must surface the Premium gate instead of a generic error",
  );
  // The launcher must use fragments, not query strings, to stay off the indexed
  // URL surface — same contract as /resume/[company]/[role].
  const launcher = source("components/BuildLauncher.tsx");
  assert.match(launcher, /`\/build#\$\{parts\.join\("&"\)\}`/);
});

test("the prompts library gives every published strategy a usable copy action", () => {
  const prompts = source("app/prompts/page.tsx");
  const copyButton = source("components/prompts/CopyPromptButton.tsx");
  assert.match(prompts, /import CopyPromptButton/);
  assert.match(
    prompts,
    /<CopyPromptButton prompt=\{strategy\.prompt\} title=\{strategy\.title\}/,
  );
  assert.match(copyButton, /navigator\.clipboard\?\.writeText/);
  assert.match(copyButton, /aria-live="polite"/);
  assert.match(
    copyButton,
    /Copy failed\. Select the prompt and copy it manually\./,
  );
});

test("the shared Product footer links to the three standalone resume tools", () => {
  const product =
    source("app/footer.tsx")
      .split('title: "Product"')[1]
      ?.split('title: "Jobs"')[0] ?? "";
  for (const href of ["/ats-xray", "/github-resume", "/ai-humanizer"]) {
    assert.ok(
      product.includes(`href: "${href}"`),
      `${href} must stay in the Product footer group`,
    );
  }
});

test("every Premium entry point reaches the shared two-method checkout and records its funnel", () => {
  const pricing = source("app/pricing-toggle.tsx");
  const builder = source("app/build/page.tsx");
  const billing = source("app/settings/panels/billing.tsx");
  const events = source("lib/product-analytics.ts");
  const migration = source("db/migrations/078_checkout_funnel_events.sql");
  assert.match(pricing, /\/settings\?tab=billing&plan=\$\{plan\}/);
  assert.match(pricing, /Choose payment method/);
  assert.match(
    builder,
    /const checkoutPath = `\/settings\?tab=billing&plan=\$\{plan\}`/,
  );
  assert.match(billing, /Continue with crypto/);
  assert.match(billing, /Continue to secure payment/);
  for (const event of [
    "checkout_intent",
    "checkout_provider_selected",
    "checkout_started",
    "checkout_cancelled",
    "checkout_failed",
    "checkout_verified",
  ]) {
    assert.match(events, new RegExp(`"${event}"`));
    assert.match(migration, new RegExp(`'${event}'`));
  }
});

test("free checkers keep a recoverable draft and a bounded request", () => {
  // The checker rides the shared workspace context (2026-10-21): draft
  // persistence lives in lib/workspace-context.ts, and the page wires
  // updateDraft with the not-before-loaded guard.
  const checker = source("app/checker/page.tsx");
  assert.match(
    checker,
    /useWorkspaceDraft/,
    "checker must use the shared workspace draft",
  );
  assert.match(
    checker,
    /WORKSPACE_STORAGE_KEY/,
    "checker must read the shared workspace key",
  );
  assert.match(
    checker,
    /if \(!draftLoaded\) return;/,
    "must not overwrite a draft before it loads",
  );
  assert.match(
    checker,
    /controller\.abort\(\), CHECK_TIMEOUT_MS/,
    "must bound the request",
  );
  const linkedin = source("app/linkedin-checker/page.tsx");
  assert.match(
    linkedin,
    /localStorage\.setItem\(DRAFT_KEY/,
    "linkedin-checker must persist a draft",
  );
  assert.match(linkedin, /if \(!draftLoaded\) return;/);
});

test("the admin offer form seeds a new version from the shared student allowance", () => {
  // This is how the published offer drifted from the code: the form defaulted a
  // NEW student offer version to a literal 5 while lib/limits.ts said 2, so
  // publishing one re-advertised the old number. The prose sweep above cannot
  // catch it — it is a config value, not copy.
  const view = source("app/admin/views/offers-view.tsx");
  assert.match(
    view,
    /import \{ DEFAULT_STUDENT_MONTHLY_LIMIT \} from "@\/lib\/limits"/,
    "the offer form must read the shared constant",
  );
  assert.match(
    view,
    /tailoredResumesPerMonth: DEFAULT_STUDENT_MONTHLY_LIMIT/,
    "default terms must not restate the allowance",
  );
  assert.doesNotMatch(
    view,
    /useState\(\d+\)[^\n]*\/\/ *resumes|const \[resumes, setResumes\] = useState\(\d+\)/,
    "the resumes field must not seed from a literal",
  );
});

test("the remaining tool actions bound their request and say so when it expires", () => {
  // The other three tools spun forever on a stalled request. These are the
  // exact call sites: a new fetch elsewhere in these files is not covered.
  const bounded: [string, string, string[]][] = [
    [
      "app/build/page.tsx",
      "TOOL_TIMEOUT_MS",
      ['"/api/generate"', "`/api/${kind}`"],
    ],
    [
      "app/resume-fixer/page.tsx",
      "CHECK_TIMEOUT_MS",
      ['"/api/check-resume/upload"', '"/api/check-resume"'],
    ],
    [
      "app/resume-maker/page.tsx",
      "EXPORT_TIMEOUT_MS",
      ["`/api/manual-export/${kind}`"],
    ],
  ];
  for (const [file, constant, routes] of bounded) {
    const tool = source(file);
    for (const route of routes) {
      // The signal has to sit in the same fetch call as the route, not merely
      // somewhere in the file.
      const call = tool.slice(tool.indexOf(`fetch(${route}`));
      assert.notEqual(call, "", `${file} no longer posts to ${route}`);
      assert.match(
        call.slice(0, 400),
        new RegExp(`signal: AbortSignal\\.timeout\\(${constant}\\)`),
        `${file} must bound its ${route} request`,
      );
    }
    // Without this the user sees a raw "TimeoutError" instead of a sentence.
    assert.match(
      tool,
      /name === "TimeoutError"/,
      `${file} must name the timeout in its error copy`,
    );
  }
});

test("the builder's client budget outlasts the server's own model deadline", () => {
  // A client timeout at or below LLM_REQUEST_TIMEOUT_MS turns a slow success
  // into an error the user cannot distinguish from a real failure. /api/linkedin
  // calls chat() and shares premiumAction's budget, so this is not theoretical.
  const declared = /const TOOL_TIMEOUT_MS = ([\d_]+);/.exec(
    source("app/build/page.tsx"),
  );
  assert.ok(declared, "app/build/page.tsx must declare TOOL_TIMEOUT_MS");
  const clientBudget = Number(declared[1].replace(/_/g, ""));
  const serverCeiling = /LLM_REQUEST_TIMEOUT_MS = ([\d_]+);/.exec(
    source("lib/request-deadline.ts"),
  );
  assert.ok(
    serverCeiling,
    "lib/request-deadline.ts must declare LLM_REQUEST_TIMEOUT_MS",
  );
  assert.ok(
    clientBudget > Number(serverCeiling[1].replace(/_/g, "")),
    `client budget ${clientBudget}ms must exceed the server's model deadline`,
  );
});

test("every resume tool offers the full country list, not the former ten", () => {
  // The builder was migrated off the hardcoded list first; the checker and fixer
  // kept their copies, so those two scored non-listed markets against US norms
  // while their own copy promised "adapts to local hiring norms".
  for (const file of ["app/checker/page.tsx", "app/resume-fixer/page.tsx"]) {
    const tool = source(file);
    assert.doesNotMatch(
      tool,
      /const COUNTRIES = \[/,
      `${file} still hardcodes a country list`,
    );
    assert.match(
      tool,
      /<CountryPicker/,
      `${file} must use the shared CountryPicker`,
    );
  }
});

test("shared layout rules prevent orphaned right columns", () => {
  const globals = source("app/globals.css");
  assert.match(globals, /:only-child/);
  assert.match(globals, /grid-column: 1 \/ -1/);
  assert.match(
    globals,
    /@media \(max-width: 1024px\)[\s\S]*?\.tool-workspace-grid[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important/,
  );
  for (const path of [
    "app/linkedin-checker/page.tsx",
    "app/checker/page.tsx",
    "app/resume-fixer/page.tsx",
    "app/resume-maker/page.tsx",
  ]) {
    assert.match(source(path), /tool-workspace-grid/);
    assert.match(source(path), /has-result/);
    assert.match(source(path), /is-onboarding/);
  }
});

test("billing, account, and security have stable entry routes", () => {
  assert.match(
    source("app/billing/page.tsx"),
    /redirect\("\/settings\?tab=billing"\)/,
  );
  assert.match(
    source("app/account/page.tsx"),
    /redirect\("\/settings\?tab=account"\)/,
  );
  assert.match(
    source("app/security/page.tsx"),
    /redirect\("\/settings\?tab=security"\)/,
  );
});

test("representative product families use shared shells without replacing route behavior", () => {
  const dashboard = source("app/dashboard/page.tsx");
  const settings = source("app/settings/page.tsx");
  const login = source("app/login/page.tsx");
  const learn = source("app/learn/page.tsx");

  assert.match(dashboard, /<WorkspaceShell/);
  assert.match(dashboard, /<MetricCard/);
  assert.match(dashboard, /<SegmentedControl/);
  assert.match(dashboard, /fetch\("\/api\/resumes"\)/);
  assert.match(dashboard, /method: "DELETE"/);
  assert.match(settings, /<WorkspaceShell/);
  assert.match(settings, /window\.history\.pushState/);
  assert.match(settings, /\/login\?next=\/settings/);
  assert.match(login, /<AuthShell/);
  assert.match(login, /safeInternalPath\(params\.get\("next"\)\)/);
  assert.match(login, /<form[\s\S]{0,120}onSubmit=/);
  for (const path of [
    "app/forgot-password/page.tsx",
    "app/reset-password/page.tsx",
  ]) {
    const authPage = source(path);
    assert.match(authPage, /<AuthShell/);
    assert.match(authPage, /<form[\s\S]{0,160}onSubmit=/);
  }
  assert.match(
    source("app/forgot-password/page.tsx"),
    /If an account with that email exists/,
  );
  assert.match(
    source("app/reset-password/page.tsx"),
    /password\.length < 10 \|\| password\.length > 256/,
  );
  // Billing moved into its own lazily-loaded panel; the copy is asserted where
  // it now lives. It is also rendered and read for real by the settings leg of
  // "settings, support, and tracker expose the signed-in account essentials".
  const settingsBilling = source("app/settings/panels/billing.tsx");
  assert.match(settingsBilling, /fixed-term pass paid once/);
  assert.match(settingsBilling, /never auto-renews/);
  assert.match(settingsBilling, /aria-pressed=\{selected\}/);
  assert.match(settingsBilling, /Continue with crypto/);
  assert.match(settingsBilling, /Continue to secure payment/);
  assert.doesNotMatch(
    settingsBilling,
    /Subscription & billing|Extend monthly|Extend yearly|>Monthly \$|>Yearly \$/,
  );
  assert.match(source("app/support/page.tsx"), /<WorkspaceShell/);
  assert.match(source("app/support\/\[id\]\/page.tsx"), /<WorkspaceShell/);
  assert.match(
    source("app/daily-matches/daily-matches-client.tsx"),
    /\/login\?next=\/daily-matches/,
  );
  assert.match(
    source("app/application-queue/queue-panel.tsx"),
    /\/login\?next=\/application-queue/,
  );
  assert.match(
    source("app/email-connection/connection-panel.tsx"),
    /\/login\?next=\/email-connection/,
  );
  assert.match(
    source("app/campaign-settings/campaign-settings-client.tsx"),
    /\/login\?next=\/campaign-settings/,
  );
  assert.match(learn, /<MarketingShell/);
  assert.match(learn, /<PageHeader/);
  assert.match(learn, /<SectionHeader/);
  assert.match(learn, /alternates: \{ canonical: "\/learn" \}/);
  assert.match(learn, /<JsonLd data=\{FAQ_LD\}/);
});

test("public marketing, directory, locale, and detail routes share the marketing shell without losing data or SEO contracts", () => {
  for (const path of [
    "app/pricing/page.tsx",
    "app/resume-templates/page.tsx",
    "app/resume-examples/page.tsx",
    "app/resume-translator/page.tsx",
    "app/compare/page.tsx",
    "app/companies/page.tsx",
    "app/roles/page.tsx",
    "app/internships/page.tsx",
    "app/students/page.tsx",
    "app/about/page.tsx",
    "app/contact/page.tsx",
    "app/careers/page.tsx",
    "app/cover-letter-examples/page.tsx",
    "app/prompts/page.tsx",
    "app/resume-builder/page.tsx",
    "app/cover-letter-generator/page.tsx",
    "app/resume-tailoring/page.tsx",
    "app/blog/[slug]/page.tsx",
    "app/compare/[slug]/page.tsx",
    "app/companies/[company]/page.tsx",
    "app/roles/[role]/page.tsx",
    "app/jobs/[country]/page.tsx",
    "app/internships/[country]/page.tsx",
    "app/internship-reports/page.tsx",
    "app/checker/help/page.tsx",
    "app/linkedin-checker/help/page.tsx",
    "app/resume-fixer/help/page.tsx",
    "app/resume-maker/help/page.tsx",
    "app/resume-keyword-report-2026/page.tsx",
    "app/resume/[company]/[role]/page.tsx",
  ]) {
    assert.match(source(path), /<MarketingShell/);
  }
  assert.match(source("app/interview-prep/page.tsx"), /<ToolShell/);
  assert.match(source("app/interview-prep/page.tsx"), /<ResumeToolPanel/);

  const locale = source("app/[locale]/page.tsx");
  const examples = source("app/resume-examples/page.tsx");
  const companies = source("app/companies/[company]/page.tsx");
  const competitor = source("app/compare/[slug]/page.tsx");
  const jobs = source("app/jobs/[country]/page.tsx");
  const internships = source("app/internships/[country]/page.tsx");
  const companyRole = source("app/resume/[company]/[role]/page.tsx");
  const seoMetadata = source("lib/seo-metadata.ts");
  // Routing through the shared shell is the invariant; its className is styling.
  assert.match(locale, /<MarketingShell/);
  assert.match(locale, /generateStaticParams/);
  assert.match(locale, /dynamicParams = false/);
  assert.match(examples, /dynamic = "force-dynamic"/);
  assert.match(examples, /seoRoleList\(80\)/);
  for (const path of ["app/companies/page.tsx", "app/roles/page.tsx"]) {
    const directory = source(path);
    assert.match(directory, /<DirectoryMethodCard/);
    assert.match(directory, /<RelatedWorkflow/);
    assert.match(
      directory,
      /real job posting|live job posting|actual job description|real job description/,
    );
  }
  assert.equal((companies.match(/<MarketingShell\b/g) ?? []).length, 2);
  assert.match(companies, /getCompanyBySlug/);
  assert.match(companies, /<DirectoryEvidenceNote/);
  assert.match(companies, /<DirectoryMethodCard/);
  assert.doesNotMatch(companies, /hiring expectations|ATS keyword set/);
  const roleHub = source("app/roles/[role]/page.tsx");
  assert.match(roleHub, /hasDatabaseSkills/);
  assert.match(roleHub, /deterministic role-themed fallback prompts/);
  assert.match(roleHub, /<DirectoryMethodCard/);
  assert.doesNotMatch(
    roleHub,
    /matches its keywords and skills|job description and ATS/,
  );
  assert.match(competitor, /dynamicParams = false/);
  assert.match(competitor, /generateStaticParams/);
  assert.match(jobs, /jobMarketIndexability/);
  assert.match(jobs, /initialCountry=\{country\.code\}/);
  assert.match(internships, /initialJobType="internship"/);
  assert.match(internships, /lockJobType/);
  assert.match(companyRole, /isPairAllowed/);
  // 7deef71 (2026-10-06, owner-approved thin-content pruning): the 911
  // company×role pages are noindex,follow — the pair pages were diluting the
  // domain's quality signal so nothing ranked. The pair pages stay reachable
  // (follow) for users arriving from the hub directories, but Google is told
  // not to index them; crawl authority concentrates on the core pages.
  assert.match(companyRole, /robots: \{ index: false, follow: true \}/);
  assert.match(companyRole, /hasDatabaseSkills/);
  assert.match(companyRole, /<DirectoryMethodCard/);
  assert.match(companyRole, /private ATS settings/);
  assert.match(companyRole, /deterministic role-themed fallback prompts/);
  assert.doesNotMatch(
    companyRole,
    /hundreds of applicants|recruiters spend seconds|what .* actually measures|candidates who advance|recruiters at .* reward|screeners scan|applicant tracking system scans for|reviewers prioritize relevance/,
  );
  assert.doesNotMatch(
    seoMetadata,
    /ATS-ready|right skills and examples|tailored to the job's ATS keywords/,
  );
});

test("the Jobs and application journey shares product shells without weakening safety semantics", () => {
  assert.match(
    source("app/jobs/page.tsx"),
    /<MarketingShell className="jobs-page\b/,
  );
  for (const path of [
    "app/daily-matches/page.tsx",
    "app/application-queue/page.tsx",
    "app/email-connection/page.tsx",
    "app/campaign-settings/page.tsx",
    "app/tracker/page.tsx",
  ]) {
    assert.match(source(path), /<WorkspaceShell/);
  }

  const autoApply = source("app/auto-apply/page.tsx");
  const queue = source("app/application-queue/queue-panel.tsx");
  const connection = source("app/email-connection/connection-panel.tsx");
  const campaigns = source(
    "app/campaign-settings/campaign-settings-client.tsx",
  );
  assert.match(autoApply, /<MarketingShell>/);
  assert.match(autoApply, /never mass ATS submission/);
  assert.match(autoApply, /delivery unverified/);
  assert.match(queue, /do not resend automatically/);
  assert.match(queue, /No approval or provider call was made/);
  assert.match(connection, /send-only permission/);
  assert.match(connection, /cannot read, search, or modify your inbox/);
  assert.match(campaigns, /const authorizationMode = "review_each"/);
  assert.match(campaigns, /const consent = false/);
  assert.match(campaigns, /Math\.min\(currentApply\.daily_limit, 5\)/);
});

test("editorial pages have a local prose rhythm and nested nav states stay active", () => {
  const globals = source("app/globals.css");
  const registry = source("app/navigation-registry.ts");
  const legalDocumentPage = source("components/LegalDocumentPage.tsx");
  for (const path of ["app/privacy/page.tsx", "app/terms/page.tsx"]) {
    const page = source(path);
    assert.match(page, /<LegalDocumentPage/);
    assert.match(page, /alternates: \{ canonical:/);
  }
  assert.match(legalDocumentPage, /<EditorialShell/);
  const refund = source("app/refund/page.tsx");
  assert.match(refund, /<EditorialShell/);
  assert.match(refund, /alternates: \{ canonical:/);
  for (const path of [
    "app/help/page.tsx",
    "app/blog/page.tsx",
    "app/learn/page.tsx",
  ]) {
    assert.match(source(path), /<MarketingShell/);
  }
  assert.match(source("app/blog/page.tsx"), /<JsonLd data=\{blogLd\}/);
  assert.match(globals, /\.prose\s*\{/);
  assert.match(globals, /\.prose\s+h2/);
  assert.match(globals, /\.prose\s+pre/);
  assert.match(registry, /href\.split\(\/\[\?\#\]\//);
  assert.match(registry, /pathname\.startsWith\(`\$\{route\}\/`\)/);
});

test("admin workspace exposes one live command bar and real operator actions", () => {
  const panel = source("app/admin/admin-panel.tsx");
  const bar = source("app/admin/workspace-bar.tsx");
  const login = source("app/admin/login.tsx");
  const stats = source("app/api/admin/stats/route.ts");
  const adminBundle = [
    panel,
    source("app/admin/views/overview-view.tsx"),
    source("app/admin/views/system-view.tsx"),
    source("app/admin/views/settings-view.tsx"),
  ].join("\n");
  assert.match(panel, /<AdminWorkspaceBar active=/);
  assert.match(adminBundle, /\/api\/admin\/queue/);
  assert.match(adminBundle, /\/api\/admin\/job-listings/);
  assert.match(adminBundle, /\/api\/admin\/cache/);
  assert.match(panel, /credentials: "same-origin"/);
  assert.match(login, /credentials: "same-origin"/);
  assert.match(panel, /setNeedLogin\(false\)/);
  assert.match(adminBundle, /if \(!r\.ok\)/);
  assert.doesNotMatch(stats, /round\(avg\([^)]+\)\)\s+filter/i);
  assert.match(adminBundle, /useAdminConfirm/);
  assert.match(bar, /Jump to a workspace/);
  assert.match(bar, /metaKey \|\| event\.ctrlKey/);
  assert.match(bar, /adminNavigationItemsForPermissions\(permissions\)/);
  assert.match(source("app/admin/navigation.ts"), /Internship reports/);
  assert.match(
    source("app/api/admin/logs/route.ts"),
    /rolesharp-auto-apply-agent/,
  );
});

test("shared buttons cannot accidentally submit a surrounding form", () => {
  const button = source("components/ui/primitives/Button.tsx");
  assert.match(button, /type = "button"/);
  assert.match(button, /<button[\s\S]*type=\{type\}/);
});

test("the product design system enforces accessible motion, touch targets, and shared shells", () => {
  const button = source("components/ui/primitives/Button.tsx");
  const card = source("components/ui/primitives/Card.tsx");
  const segmented = source("components/ui/primitives/SegmentedControl.tsx");
  const shells = source("components/ui/primitives/Shells.tsx");
  const globals = source("app/globals.css");
  const layout = source("app/layout.tsx");

  assert.equal((button.match(/min-h-\[(?:44|52)px\]/g) ?? []).length, 3);
  assert.doesNotMatch(card, /transition-all/);
  assert.match(card, /rs-interactive-lift/);
  assert.match(segmented, /role="group"/);
  assert.match(segmented, /aria-pressed=\{selected\}/);
  assert.match(segmented, /min-h-11/);
  for (const shell of [
    "MarketingShell",
    "WorkspaceShell",
    "EditorialShell",
    "AuthShell",
  ]) {
    assert.match(shells, new RegExp(`export function ${shell}`));
  }
  assert.match(layout, /className="rs-product-root"/);
  assert.match(globals, /--space-section-lg:/);
  assert.match(globals, /--surface-glass:/);
  assert.match(globals, /--motion-spring:/);
  assert.match(globals, /@media \(prefers-contrast: more\)/);
  assert.match(
    globals,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.rs-interactive-lift:hover[\s\S]*?transform: none/,
  );
});

test("route loading and recovery states are branded, accessible, and retryable", () => {
  const loading = source("components/ui/RouteLoading.tsx");
  const error = source("app/error.tsx");
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(loading, /motion-reduce:animate-none/);
  assert.match(error, /"use client"/);
  assert.match(error, /role="alert"/);
  assert.match(error, /onClick=\{reset\}/);
  assert.match(error, /href="\/"/);
  for (const path of [
    "app/build/loading.tsx",
    "app/checker/loading.tsx",
    "app/resume-maker/loading.tsx",
    "app/resume-fixer/loading.tsx",
    "app/linkedin-checker/loading.tsx",
    "app/dashboard/loading.tsx",
    "app/pricing/loading.tsx",
  ]) {
    assert.match(source(path), /RouteLoading/);
  }
});

test("builder fields retain unique IDs and explicit accessible names", () => {
  const build = source("app/build/page.tsx");
  const experiences = source("app/build/experience-cards.tsx");
  const ids = [...build.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(
    new Set(ids).size,
    ids.length,
    `Duplicate literal IDs: ${ids.join(", ")}`,
  );
  for (const id of [
    "bp-career-level",
    "bp-email",
    "bp-phone",
    "bp-linkedin",
    "bp-city",
    "bp-state",
    "bp-links",
    "bp-summary",
    "bp-jd",
    "bp-education",
    "bp-projects",
    "bp-certs",
    "bp-languages",
    "bp-achievements",
  ]) {
    assert.match(
      build,
      new RegExp(`htmlFor="${id}"`),
      `Missing label for ${id}`,
    );
    assert.match(build, new RegExp(`id="${id}"`), `Missing field ID ${id}`);
  }
  const skills = source("app/build/skill-fields.tsx");
  assert.match(skills, /htmlFor="bp-skills"/);
  assert.match(skills, /id=\{fieldId\(index\)\}/);
  assert.match(skills, /aria-label=\{index > 0 \? `Skill/);
  assert.doesNotMatch(build, /id="step-extras"[\s\S]*id="step-extras"/);
  assert.match(experiences, /htmlFor=\{`experience-\$\{e\.id\}-title`\}/);
  assert.match(experiences, /aria-label=\{`Achievement \$\{bi \+ 1\}/);
});

test("pricing and global footer headings do not skip from h1 to h3", () => {
  assert.doesNotMatch(source("app/pricing-toggle.tsx"), /<h3/);
  assert.doesNotMatch(source("components/StudentOfferCard.tsx"), /<h3/);
  assert.doesNotMatch(source("app/footer.tsx"), /<h3/);
});

test("shared SVG icons are typed and forward caller accessibility and styling props", () => {
  const icons = source("app/icons.tsx");
  assert.match(icons, /SVGProps<SVGSVGElement>/);
  assert.match(icons, /\.\.\.props/);
  assert.match(icons, /props\["aria-label"\]/);
  assert.doesNotMatch(icons, /\(p: any\)/);
});

test("the navigation and application metadata share the production RoleSharp mark", () => {
  const nav = source("app/nav.tsx");
  const mark = source("components/RoleSharpMark.tsx");
  const icon = source("app/icon.svg");
  const globals = source("app/globals.css");
  // 30px marks the compacted 64px nav shell (owner: "nav too tall"); the mark
  // component, favicon, and brand-mark CSS all stay in lockstep with it.
  assert.match(nav, /<RoleSharpMark size=\{30\}/);
  assert.match(mark, /viewBox="0 0 64 64"/);
  assert.match(mark, /M16 51V13/);
  assert.match(mark, /rs-mark-accent/);
  assert.match(mark, /stopColor="#F59E0B"/);
  assert.doesNotMatch(mark, /<circle/);
  assert.match(icon, /rolesharp-bg/);
  assert.match(icon, /aria-label="RoleSharp"/);
  assert.doesNotMatch(globals, /\.rs-nav-brand-mark::after/);
});

test("brand faces are self-hosted, so a production build never calls out to Google", () => {
  const globals = source("app/globals.css");
  const layout = source("app/layout.tsx");
  const shipped = new Set(
    readdirSync(new URL("../public/fonts", import.meta.url)),
  );

  // The build failed twice on fonts.gstatic.com before these were vendored.
  assert.doesNotMatch(layout, /next\/font\/google/);
  // A bare mention in a comment is fine; a URL that the build has to fetch is not.
  // Not just Google: the approved ink-instrument-v3 specimen pulls Satoshi from
  // api.fontshare.com, and that fails the same way on the same build step.
  assert.doesNotMatch(globals, /url\(\s*["']?https?:\/\//);
  assert.doesNotMatch(globals, /@import\s+url\(\s*["']?https?:\/\//);
  for (const host of [
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "api.fontshare.com",
    "cdn.fontshare.com",
  ]) {
    assert.ok(
      !layout.includes(host),
      `${host} is referenced in layout.tsx; self-host the face instead`,
    );
  }

  const referenced = [
    ...globals.matchAll(/url\(\/fonts\/([\w.-]+\.woff2)\)/g),
  ].map((m) => m[1]);
  assert.equal(
    referenced.length,
    6,
    "latin + latin-ext for each of the three faces",
  );
  for (const file of referenced) {
    assert.ok(
      shipped.has(file),
      `${file} is declared in globals.css but missing from public/fonts`,
    );
  }

  // Preloading the latin files is what lets the display face, which is
  // font-display: optional, arrive before the swap deadline.
  for (const file of [
    "plus-jakarta-sans-latin",
    "dm-sans-latin",
    "geist-mono-latin",
  ]) {
    assert.ok(
      layout.includes(`/fonts/${file}.woff2`),
      `${file} is not preloaded in layout.tsx`,
    );
  }

  // Metric overrides keep CLS at zero while the real face loads.
  for (const family of [
    "Plus Jakarta Sans Fallback",
    "DM Sans Fallback",
    "Geist Mono Fallback",
  ]) {
    assert.ok(
      globals.includes(family),
      `${family} metric override was dropped`,
    );
  }
});

// Phase 1b. The proof strip's whole argument is that the catalogue is checkable,
// so the search has to be a real query and the strip must not grow a slot for
// proof RoleSharp does not have. Verified in a browser against the dev
// catalogue: typing "goo" returns Google and the option links to
// /companies/google, with "1 company guide available." announced politely.
test("the proof strip proves the catalogue and invents no other proof", () => {
  const finder = source("components/marketing/CompanyFinder.tsx");
  const band = source("app/social-proof-band.tsx");
  const home = source("app/page.tsx");

  // A real request, not a decorative input.
  assert.match(finder, /\/api\/companies\/search\?q=\$\{encodeURIComponent/);
  assert.match(finder, /useAutocomplete<Company>/);
  // Options navigate, so they are links; a button here loses middle-click.
  assert.match(finder, /<a\s+href=\{`\/companies\/\$\{company\.slug\}`\}/);
  // A list that appears silently is invisible to a screen reader.
  assert.match(finder, /aria-live="polite"/);
  // DESIGN.md §5: never use the placeholder as the label.
  assert.match(finder, /<label\s+htmlFor=\{inputId\}/);

  // Every number is read from the catalogue at request time.
  assert.match(band, /getSiteStats\(\)/);
  assert.match(band, /job markets available/);
  assert.match(band, /How RoleSharp verifies claims/);
  assert.match(band, /Verifiable product coverage/);
  // No hardcoded count may creep back in beside the real ones. "200+" is the
  // documented no-database fallback for country contexts and is allowed.
  assert.doesNotMatch(
    band,
    /\b\d{1,3}(,\d{3})+\b/,
    "a literal count is hardcoded in the proof strip",
  );

  // The gap report's H2 in layout form: no slot for ratings or user counts.
  // Checked against code with comments stripped — the comment above this very
  // component explains why there are no testimonials, and matching that would
  // fail the test for saying the right thing.
  const withoutComments = code("app/social-proof-band.tsx");
  for (const banned of [
    /TrustScore/i,
    /\btestimonial/i,
    /\bstar rating/i,
    /trusted by [\d,]+/i,
    /\d[\d,]*\s+reviews?\b/i,
  ]) {
    assert.doesNotMatch(
      withoutComments,
      banned,
      `the proof strip grew a slot for proof that does not exist: ${banned}`,
    );
  }

  // The proof strip is the one band the owner's full-white/full-dark landing
  // keeps as a distinct act: a hairline-bordered section immediately before
  // the marquee.
  assert.match(home, /<RoleSharpLanding \/>/);
});

// Phase 3. Eleven pages rendered the same breadcrumb trail six different ways —
// two Tailwind link treatments, one unstyled, a .page-breadcrumb compat class, a
// .note class, and a bare font-semibold — and not one of them was navigation.
test("every directory breadcrumb goes through one navigable component", () => {
  const crumb = source("components/ui/primitives/Breadcrumb.tsx");

  // The thing that was actually missing: structure a screen reader can use.
  assert.match(crumb, /<nav aria-label="Breadcrumb"/);
  assert.match(crumb, /<ol\b/);
  assert.match(crumb, /aria-current=\{last \? "page" : undefined\}/);
  // Separators are decoration; the list already conveys order.
  assert.match(crumb, /aria-hidden="true"/);

  // No page may hand-roll the trail again. walkSurfaces already covers app/,
  // components/ and lib/, which is exactly the surface this can regress on.
  const handRolled = walkSurfaces().filter((path) =>
    /Home<\/a>\s*\//.test(source(path)),
  );
  assert.deepEqual(
    handRolled,
    [],
    `these still hand-roll a breadcrumb: ${handRolled.join(", ")}`,
  );

  // The compat class it replaced must stay gone.
  assert.doesNotMatch(
    source("app/compat/legacy-bridge.css"),
    /\.page-breadcrumb/,
  );
});

// Phase 3. The root cause behind three separate bugs this redesign hit, caught
// generically instead of one class at a time.
//
// app/globals.css opens with a bare, UNLAYERED rule:
//   h1, h2, h3, h4, h5, h6 { font-family; font-weight; line-height;
//                            letter-spacing; margin; color }
// Unlayered declarations beat everything in @layer utilities regardless of
// specificity, so EVERY Tailwind utility for one of those properties is a
// silent no-op on a heading. font-bold looked applied and rendered 700;
// leading-[1.04] rendered 1.15; tracking-[-0.03em] rendered -0.02em. Nothing
// throws, nothing greps, and it was only ever caught by measuring in a browser.
//
// Until Phase 6 moves those base rules into @layer base, the fix is Tailwind's
// trailing !. This asserts every heading in the design-system components either
// carries it or does not set the property at all.
test("heading utilities that the unlayered base rule also sets carry the important modifier", () => {
  const files = [
    "components/ui/primitives/PageHeader.tsx",
    "components/ui/primitives/ToolShell.tsx",
    "components/marketing/ModernHeroAndMethod.tsx",
    "components/marketing/MethodBento.tsx",
  ];
  // Narrowed by the compat retirement: the heading rule's font-family,
  // font-weight, letter-spacing, margin and colour now live in @layer base, so
  // utilities for those win on their own and their bangs are redundant rather
  // than load-bearing. line-height is the one property still unlayered — see
  // the split guard below for why — so it is the one that still needs a bang.
  const contested = /(?:^|\s)(leading-\[[^\]]+\])(?!!)/g;

  const base = source("app/globals.css");
  assert.match(
    base,
    /h1, h2, h3, h4, h5, h6 \{\s*\n\s*line-height/,
    "the unlayered heading line-height moved; revisit this guard",
  );

  for (const file of files) {
    const src = source(file);
    for (const match of src.matchAll(
      /<h[1-6][^>]*className=\{?[`"]([^`"]+)[`"]/g,
    )) {
      const classes = match[1];
      const offenders = [...classes.matchAll(contested)].map((m) => m[1]);
      assert.deepEqual(
        offenders,
        [],
        `${file}: ${offenders.join(", ")} will be silently overridden by the unlayered h1-h6 rule — add a trailing !`,
      );
    }
  }
});

// Phase 2b. The tool header was a three-stop surface -> primary-50 -> amber
// gradient, which DESIGN.md §1 forbids in as many words: "Marketing flourishes
// must not enter task surfaces."
test("the tool shell is a task surface, not a marketing one", () => {
  const shell = source("components/ui/primitives/ToolShell.tsx");
  const globals = source("app/globals.css");

  assert.doesNotMatch(
    code("components/ui/primitives/ToolShell.tsx"),
    /linear-gradient/,
  );
  assert.match(shell, /desk-tool-header/);
  // Ink is the marketing voice. Tools stay on the light canvas.
  assert.doesNotMatch(shell, /data-canvas/);
  // Same unlayered-base-rule problem as every other heading.
  assert.match(shell, /font-bold!/);
  assert.match(shell, /sr-only">\{eyebrow\}/);

  // The signature is two marks, not a box.
  assert.match(globals, /\.rs-scan-frame::before,\s*\n\.rs-scan-frame::after/);
  // Offsets must stay non-negative. At -1px the mark hangs a pixel past a
  // full-bleed section and shows up as a 1px document overflow that reports no
  // element as the offender, because a pseudo-element is not in the DOM.
  const frame = globals.slice(globals.indexOf(".rs-scan-frame::before {"));
  const offsets = [
    ...frame
      .slice(0, 400)
      .matchAll(/\b(top|left|right|bottom):\s*(-?[\d.]+)(?:px)?\s*;/g),
  ];
  assert.ok(
    offsets.length >= 4,
    `scan frame offsets not found (matched ${offsets.length})`,
  );
  for (const [, side, value] of offsets) {
    assert.ok(
      Number(value) >= 0,
      `scan frame ${side} is ${value}px; negative offsets overflow full-bleed sections`,
    );
  }
});

// Phase 2a. 258 of 274 signups never generate anything, and before this only
// /build had any instrumentation — two events, both fired AFTER validation
// passed. The four sibling tools had none at all, including /resume-fixer,
// which the landing hero's primary CTA points at. A blocked attempt looked
// exactly like never having tried.
test("every tool reports the wall it turns people away at", () => {
  const tools = {
    "app/build/page.tsx": "builder",
    "app/checker/page.tsx": "checker",
    "app/resume-fixer/page.tsx": "fixer",
    "app/linkedin-checker/page.tsx": "linkedin",
    "app/resume-maker/page.tsx": "maker",
  } as const;

  const allowlist = source("lib/product-analytics.ts");
  assert.match(allowlist, /"tool_start_blocked"/);

  for (const [path, prefix] of Object.entries(tools)) {
    const tool = source(path);
    for (const event of [
      "tool_start_blocked",
      "tool_meaningful_start",
      "first_value_view",
    ]) {
      assert.match(
        tool,
        new RegExp(`trackProductEvent\\("${event}"`),
        `${path} never fires ${event}`,
      );
    }

    // Every context must survive sanitizeAnalyticsContext, which drops anything
    // outside ^[A-Za-z0-9:_-]+$ — a context that fails silently becomes an
    // unlabelled event, which is worse than no event because it looks measured.
    // Match the prefixed string literals themselves rather than what follows
    // `context:` — some are chosen by a ternary, so the quote is not adjacent.
    const ours = [...tool.matchAll(new RegExp(`"(${prefix}:[^"]*)"`, "g"))].map(
      (m) => m[1],
    );
    assert.ok(
      ours.length >= 2,
      `${path} has fewer than two ${prefix}: contexts`,
    );
    for (const context of ours) {
      assert.match(
        context,
        /^[A-Za-z0-9:_-]+$/u,
        `${path} context "${context}" will be dropped by the sanitizer`,
      );
      assert.ok(
        context.length <= 80,
        `${path} context "${context}" exceeds 80 chars`,
      );
    }

    // DESIGN.md §8 prohibits the content being worked on. These are the field
    // names that hold it; none may be interpolated into an event.
    for (const forbidden of ["resumeText", "jdText", "profileText", "email"]) {
      assert.doesNotMatch(
        tool,
        new RegExp(`trackProductEvent\\([^)]*\\$\\{[^}]*${forbidden}`),
        `${path} interpolates ${forbidden} into an analytics event`,
      );
    }
  }
});

// Deleting an orphaned rule left a stray closing brace in globals.css. tsc,
// eslint and every test here passed while the whole stylesheet failed to parse
// and the site rendered unstyled — these read CSS as text, so none of them can
// see it. This is the cheapest check that would have caught it.
test("every stylesheet has balanced braces", () => {
  const sheets = [
    "app/globals.css",
    "app/animations.css",
    "app/landing-motion.css",
    "app/company-marquee.css",
    "app/globals-compat.css",
    ...readdirSync(new URL("../app/compat", import.meta.url)).map(
      (f) => `app/compat/${f}`,
    ),
  ].filter((f) => f.endsWith(".css"));

  for (const sheet of sheets) {
    const css = source(sheet).replace(/\/\*[\s\S]*?\*\//g, "");
    const open = (css.match(/\{/g) ?? []).length;
    const close = (css.match(/\}/g) ?? []).length;
    assert.equal(
      close,
      open,
      `${sheet} has ${open} { and ${close} } — it will not parse`,
    );
  }
});

// Phase 1c. Two acts that both turn on showing the real artifact.
test("the method act reads on paper and the templates are real exports", () => {
  // MethodAct was deleted with the duplicate-component cleanup; the live
  // method surface is MethodBento (same #method anchor), with the concrete
  // blocked-evidence marker living in the hero.
  const method = source("components/marketing/MethodBento.tsx");
  const studio = source("components/marketing/TemplateStudio.tsx");
  const home = source("app/page.tsx");
  const shipped = new Set(
    readdirSync(new URL("../public/templates", import.meta.url)),
  );

  // The canvas attributes are gone — the owner's full-white/full-dark landing
  // makes every act follow the page theme. The act itself and its evidence
  // pair are the invariant now.
  assert.match(method, /<section id="method"/);
  // The 2026-10 rebuild: MethodBento carries the #method anchor on the landing
  // now; MethodAct's evidence pair lives on in its component file.
  assert.match(home, /<RoleSharpLanding \/>/);
  // The pair of examples is the product's whole claim; losing either half
  // turns the act into a feature blurb.
  // The old evidence pair (Grounded edit / No supporting evidence) became the
  // hero's blocked-evidence marker plus MethodBento's refuse-to-invent copy.
  assert.match(method, /No fabricated percentages or metrics/);
  assert.match(method, /strictly refuses to invent evidence/);
  // Headings need the important modifier for the same unlayered-base-rule
  // reason the hero does; without it this h2 silently renders at 700.
  assert.match(method, /font-extrabold!/);

  // Every template image must be a real render that actually ships, and must
  // name a template id lib/pdf.tsx accepts — not one of the six invented
  // marketing names that map to nothing.
  const ids = [...studio.matchAll(/id: "([\w-]+)"/g)].map((m) => m[1]);
  assert.ok(
    ids.length >= 4,
    "the template act shows fewer than four templates",
  );
  const enginePalettes = source("lib/pdf.tsx");
  for (const id of ids) {
    assert.ok(
      shipped.has(`${id}.webp`),
      `public/templates/${id}.webp is referenced but not shipped`,
    );
    assert.ok(
      enginePalettes.includes(id),
      `"${id}" is not a template lib/pdf.tsx knows about`,
    );
  }
  for (const invented of [
    "Clarity",
    "Momentum",
    "Ledger",
    "Studio",
    "First Step",
    "Borderless",
  ]) {
    assert.ok(
      !ids.includes(invented),
      `the landing act reintroduced the invented name ${invented}`,
    );
  }
  // Real renders of fictional people still need to say so.
  assert.match(studio, /<SampleProvenance/);
  assert.match(studio, /invented/);
  assert.doesNotMatch(
    code("components/marketing/TemplateStudio.tsx"),
    /TemplateThumb/,
    "the grey-bar illustration came back",
  );
});

// ink-instrument-v3, Phase 0. A canvas is opt-in per section, so the failure
// mode is silent: a component reads --muted-fg inside an ink act, gets the
// light-mode grey because ink forgot to override it, and renders #52647A on
// #0A1220 — 1.9:1, unreadable, and nothing throws. Dark mode already worked out
// which aliases have to move; ink and paper must cover the same set.
test("every canvas overrides the full alias set that dark mode does", () => {
  const globals = source("app/globals.css");

  const declaredIn = (selector: string) => {
    const start = globals.indexOf(`\n${selector} {`);
    assert.notEqual(start, -1, `${selector} block is missing from globals.css`);
    const body = globals.slice(start, globals.indexOf("\n}", start));
    return new Set([...body.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
  };

  // Parity is required of ink and not of paper, and the asymmetry is the point:
  // a token only has to move when the background it was contrast-checked
  // against moves. Ink flips to #0A1220, so every one of them does. Paper stays
  // light, so the light values it inherits are already correct — forcing it to
  // restate them would be noise that drifts.
  const dark = declaredIn('[data-theme="dark"]');
  const ink = declaredIn('[data-canvas="ink"]');
  const missing = [...dark].filter((token) => !ink.has(token));
  assert.deepEqual(
    missing,
    [],
    `[data-canvas="ink"] does not override ${missing.join(", ")} — components inside an ink act will fall through to values chosen against a light page`,
  );

  const paper = declaredIn('[data-canvas="paper"]');
  for (const token of ["--bg", "--fg", "--surface", "--muted-fg", "--border"]) {
    assert.ok(paper.has(token), `[data-canvas="paper"] does not set ${token}`);
  }

  // A canvas that resolves tokens but never paints is the "it did nothing" bug.
  assert.match(globals, /\[data-canvas\]\s*\{[^}]*background:\s*var\(--bg\)/);
  assert.match(globals, /\[data-canvas\]\s*\{[^}]*color:\s*var\(--fg\)/);

  // Canvas is a separate axis from the user's light/dark preference. If these
  // ever collapse onto data-theme, an ink marketing act drags the whole app dark.
  assert.doesNotMatch(globals, /\[data-theme="dark"\]\[data-canvas/);
  assert.match(
    globals,
    /\[data-canvas="ink"\]\s*\{[\s\S]*?color-scheme:\s*dark/,
  );
  assert.match(
    globals,
    /\[data-canvas="paper"\]\s*\{[\s\S]*?color-scheme:\s*light/,
  );
});

// Verified in a browser, not reasoned about: Tailwind v4 drops @theme variables
// nothing references yet, and a font-family reading an undefined custom property
// does NOT fall back to the rest of the stack — the declaration is invalid at
// computed-value time and the element inherits sans instead. --font-serif is
// referenced by nothing until Phase 1 adds the pull quote, so declaring it in
// @theme would have shipped a serif that silently renders as Plus Jakarta Sans.
test("--font-serif is declared outside @theme so it survives with no consumers", () => {
  const globals = source("app/globals.css");
  const themeStart = globals.indexOf("@theme {");
  const themeEnd = globals.indexOf("\n}", themeStart);
  const theme = globals.slice(themeStart, themeEnd);
  const serif = /--font-serif:/;

  assert.doesNotMatch(
    theme,
    serif,
    "--font-serif is inside @theme and will be tree-shaken until something uses it",
  );
  assert.match(globals, serif, "--font-serif is not declared at all");
  // Georgia is the fallback that has to hold until the woff2 lands in Phase 0b.
  assert.match(globals, /--font-serif:[^;]*Georgia/);
});

// The blank form is the likeliest reason 94% of signups never generated a
// resume. This is the affordance that removes it, so it has to stay wired.
test("the maker can be filled from a LinkedIn export", () => {
  const maker = source("app/resume-maker/page.tsx");
  const route = source("app/api/linkedin/import/route.ts");

  assert.match(maker, /Import from LinkedIn/);
  // The file goes through the hardened upload route first, not a second
  // bespoke parser.
  assert.match(maker, /\/api\/check-resume\/upload/);
  assert.match(maker, /\/api\/linkedin\/import/);
  assert.match(maker, /resumeContentToFormFields/);
  // The instruction has to name the exact LinkedIn menu path or people upload
  // the wrong file and see a failure they cannot act on.
  assert.match(maker, /Save to PDF/);

  // Fact safety is the product's whole claim; the importer states it too.
  assert.match(maker, /Nothing is invented/);
  assert.match(route, /looksLikeLinkedinExport/);
  assert.match(route, /rateLimit/);
});

// /api/cover keys off a saved resume and needs no form, so reaching it should
// not require opening the resume and hunting for the card.
test("a saved resume writes its cover letter in one click", () => {
  const dashboard = source("app/dashboard/page.tsx");
  const detail = source("app/resumes/[id]/page.tsx");

  assert.match(dashboard, /href=\{`\/resumes\/\$\{r\.id\}\?tool=cover`\}/);
  // v2 UI pass: the label is the compact "Cover" (icon + short word keeps four
  // controls on one card row); the title attr carries the full description.
  assert.match(dashboard, />\s*Cover\s*</);
  assert.match(dashboard, /Generate a cover letter from this resume/);

  // The deep link is only one click if the target acts on it.
  assert.match(detail, /searchParams|location\.search/);
  assert.match(detail, /runTool\(requested as ToolKey\)/);
  // Regenerating something already written would spend an allowance for a
  // result already on screen.
  assert.match(detail, /if \(resultFor\(requested as ToolKey\)\) return;/);
  // And it must not re-fire on every render.
  assert.match(detail, /autoRan/);
});

// Four free, logged-out tools. They exist because 94% of signups never
// generated anything: a visitor has to be able to produce something useful
// before deciding whether to sign up.
test("the free generators are reachable without an account and promise nothing they cannot keep", () => {
  const pages = [
    ["app/resume-summary-generator/page.tsx", "summary"],
    ["app/resume-bullet-points-generator/page.tsx", "bullets"],
    ["app/work-experience-generator/page.tsx", "experience"],
    ["app/career-summary-generator/page.tsx", "career"],
  ] as const;

  for (const [path, tool] of pages) {
    const page = source(path);
    assert.match(
      page,
      new RegExp(`tool=\{"${tool}"\}`),
      `${path} must render the ${tool} tool`,
    );
    // Each exists to answer one search, so each needs its own canonical.
    assert.match(
      page,
      /alternates: \{ canonical: "\//,
      `${path} needs a canonical`,
    );
    assert.match(page, /faqs=\{\[/, `${path} needs its own FAQ`);
  }

  const shell = source("components/tools/MicroGeneratorTool.tsx");
  assert.match(shell, /No account needed/);
  assert.match(shell, /The draft uses the details you provide\./);
  // A stalled request has to fail visibly rather than spin.
  assert.match(shell, /AbortController/);
  assert.match(shell, /REQUEST_TIMEOUT_MS/);

  const route = source("app/api/tools/generate/route.ts");
  assert.match(route, /rateLimit/);
  // Only the legacy Premium analyzer branch authenticates. The experience
  // generator falls through after it; the other free generators return above it.
  const freeRoute = route.replace(
    /if \(body\.tool === "letter-analyzer"\) \{[\s\S]*?\n  \}/,
    "",
  );
  assert.doesNotMatch(
    freeRoute.replace(/import \{ currentUser \}[^\n]*\n/, ""),
    /currentUser/,
  );
});

test("every spacing token the compat stylesheets use is actually defined", () => {
  // The July 2026 redesign rewrote the token block in globals.css and dropped
  // the spacing scale, but the stylesheets extracted from the old globals kept
  // referencing it. 186 declarations resolved to nothing for a month —
  // .quick-win computed to padding: 0px — and nothing failed, because an
  // undefined custom property is not a CSS error. This is that alarm.
  const globals = source("app/globals.css");
  const defined = new Set(
    [...globals.matchAll(/--space-(\d+)\s*:/g)].map((match) => match[1]),
  );
  assert.ok(
    defined.size >= 9,
    "the spacing scale is missing from app/globals.css",
  );

  const used = new Map<string, string[]>();
  for (const name of readdirSync(new URL("../app/compat", import.meta.url))) {
    if (!name.endsWith(".css")) continue;
    for (const match of source(`app/compat/${name}`).matchAll(
      /var\(--space-(\d+)\)/g,
    )) {
      used.set(match[1], [...(used.get(match[1]) ?? []), name]);
    }
  }
  assert.ok(
    used.size > 0,
    "expected the compat sheets to use the spacing scale",
  );

  for (const [step, files] of used) {
    assert.ok(
      defined.has(step),
      `--space-${step} is used in ${[...new Set(files)].join(", ")} but defined nowhere`,
    );
  }
});

test("no page title carries the brand suffix the root template already appends", () => {
  // app/layout.tsx sets template: "%s | RoleSharp". A page metadata.title that
  // already ends in "| RoleSharp" renders "... | RoleSharp | RoleSharp", which
  // is what all four generator pages shipped with. openGraph.title is exempt:
  // it does not go through the template, so it has to carry the brand itself.
  const offenders: string[] = [];
  for (const path of walkSurfaces()) {
    if (!/\/page\.tsx$|\/layout\.tsx$/.test(path)) continue;
    const text = source(path);
    const metadata = text.match(/export const metadata[\s\S]*?\n\};/)?.[0];
    if (!metadata) continue;
    // The first title: in the metadata object, before any openGraph/twitter block.
    const head = metadata.split(/openGraph|twitter/)[0];
    const title = head.match(/\btitle:\s*"([^"]+)"/)?.[1];
    if (title && /\|\s*RoleSharp\s*$/.test(title))
      offenders.push(`${path}: ${title}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `these render "| RoleSharp | RoleSharp":\n${offenders.join("\n")}`,
  );
});

test("no page that can 404 sits under a loading.tsx boundary", () => {
  // A loading.tsx wraps every route at or below it in a Suspense boundary, so
  // the shell — status line and root <head> included — is flushed before the
  // route renders. notFound() then arrives too late to change anything: the
  // response lands as 200 carrying the root layout's canonical and
  // `index, follow`, a soft 404 pointing crawlers at "/".
  //
  // This is not fixable from inside the page. Measured against a dev server on
  // 2026-08-16: /jobs/<unknown> stayed 200 with notFound() in generateMetadata,
  // and stayed 200 with dynamicParams=false + generateStaticParams (which
  // `dynamic = "force-dynamic"` opts out of). It returned 404 the moment
  // app/jobs/loading.tsx was removed, while its four siblings with no boundary
  // — /internships, /blog, /compare, /companies — 404'd correctly throughout.
  //
  // So the boundary and the 404 cannot coexist. Keep loading.tsx off any
  // segment that has a notFound()-capable page below it.
  const surfaces = walkSurfaces();
  const boundaries = surfaces
    .filter((path) => path.endsWith("/loading.tsx"))
    .map((path) => path.slice(0, -"loading.tsx".length));
  assert.ok(
    boundaries.length > 0,
    "expected at least one loading.tsx boundary",
  );

  const offenders: string[] = [];
  for (const path of surfaces) {
    if (!path.endsWith("/page.tsx")) continue;
    if (!/\bnotFound\(\)/.test(code(path))) continue;
    const boundary = boundaries.find((dir) => path.startsWith(dir));
    if (boundary) offenders.push(`${path} under ${boundary}loading.tsx`);
  }
  assert.deepEqual(
    offenders,
    [],
    `these soft-404 with a 200:\n${offenders.join("\n")}`,
  );
});

test("the breadcrumb trail is the primitive everywhere, never hand-rolled markup", () => {
  // Twelve pages rendered `<p><Link href="/">Home</Link> / Label</p>`: a run of
  // links with no nav landmark, no list, and no aria-current, so a screen-reader
  // user got no signal that it was a hierarchy or where in it they were. The
  // Breadcrumb primitive already existed and eleven other pages used it.
  const offenders = walkSurfaces().filter((path) =>
    /Home<\/Link>\s*\/|Home<\/a>\s*\//.test(code(path)),
  );
  assert.deepEqual(
    offenders,
    [],
    `hand-rolled breadcrumb trail — use <Breadcrumb items={...} />:\n${offenders.join("\n")}`,
  );
});

test("the free generators route their header and fields through the design system", () => {
  const page = source("components/tools/micro-generator-page.tsx");
  const tool = source("components/tools/MicroGeneratorTool.tsx");
  // One layout for all seven routes. Since 2026-10-18 the header lives in
  // ToolShell (its h1 carries the unlayered-base-rule override), the FAQ is
  // the compact card grid, and the PremiumPanel/cross-sell buttons are gone.
  assert.match(page, /<ToolShell /);
  assert.doesNotMatch(page, /<h1/);
  assert.doesNotMatch(page, /PremiumPanel/);
  for (const path of [
    "app/resume-summary-generator/page.tsx",
    "app/resume-bullet-points-generator/page.tsx",
    "app/work-experience-generator/page.tsx",
    "app/career-summary-generator/page.tsx",
    "app/resignation-letter-generator/page.tsx",
  ]) {
    assert.match(source(path), /<MicroGeneratorPage/);
  }
  // `.alert` and `.alert-error` are defined in no stylesheet in this repo, so
  // the error and warning blocks rendered as unstyled body text. Class names
  // fail silently; a primitive that does not exist fails the build.
  for (const dead of [
    /className="alert/,
    /className="field"/,
    /className="label"/,
    /className="[^"]*soft-card/,
  ]) {
    assert.doesNotMatch(
      tool,
      dead,
      `${dead} is compat markup — use the Form/Notice/Card primitives`,
    );
  }
  assert.match(tool, /<Notice variant="danger"/);
  assert.doesNotMatch(
    tool,
    /style=\{\{/,
    "inline styles here were how the compat layer leaked back in",
  );
});

test("no primitive is named after a JavaScript global it would shadow", () => {
  // The form error component was exported as `Error`. Importing it silently
  // rebinds the global in that module, so `err instanceof Error` and
  // `new Error(...)` stop meaning what they say — no type error, no lint
  // warning, just a branch that never runs. Two of the eight call sites had
  // already worked around it with `Error as FormError` / `as ErrorMessage`,
  // which is the tell. It is `FieldError` now.
  const shadowed = [
    "Error",
    "Object",
    "Array",
    "Map",
    "Set",
    "Promise",
    "Number",
    "String",
    "Boolean",
    "Date",
    "Symbol",
    "Proxy",
    "Range",
    "Event",
    "Image",
    "Option",
    "Text",
    "Comment",
    "Selection",
  ];
  const index = source("components/ui/primitives/index.ts");
  const exported = [...index.matchAll(/export\s*\{([^}]+)\}/g)]
    .flatMap((match) => match[1].split(","))
    .map((name) =>
      name
        .replace(/\btype\b/, "")
        .split(" as ")[0]
        .trim(),
    )
    .filter(Boolean);
  assert.ok(
    exported.length > 10,
    "the primitives barrel stopped listing named exports; revisit this guard",
  );
  const offenders = exported.filter((name) => shadowed.includes(name));
  assert.deepEqual(
    offenders,
    [],
    `these primitives shadow a global when imported: ${offenders.join(", ")}`,
  );
});

// Directories whose headings have been through a redesign phase. Phase 6 moved
// the base rules into @layer base, so only the heading line-height still needs
// a bang; this list stays as the boundary between "done" and "not looked at
// yet", and it only ever grows.
const REDESIGNED = [
  "components/ui/primitives/",
  "components/marketing/",
  "components/tools/",
  "app/career-map/",
  "app/skill-gap/",
  "app/u/",
  "app/job-search-guide/",
  "app/cover-letter-templates/",
  "app/cover-letter-generator/",
  "app/dashboard/",
  "app/settings/",
  "app/tracker/",
  "app/application-queue/",
  "app/daily-matches/",
  "app/notifications/",
  "app/billing/",
  "app/account/",
  "app/resumes/",
  "app/campaign-settings/",
  "app/email-connection/",
];

test("every redesigned surface carries the important modifier on contested heading utilities", () => {
  // Same unlayered rule as the guard above, applied to whole directories rather
  // than four hand-listed components. 68 utilities were silently dead across
  // these files before Phases 4 and 5: font-semibold rendering 700,
  // font-extrabold rendering 700, tracking-[-0.025em] rendering -0.02em. Those
  // properties are layered now and win on their own; `leading-` is the only one
  // the unlayered rule still beats.
  const contested = /(?:^|\s)(leading-\[[^\]]+\])(?!!)/g;
  const offenders: string[] = [];
  for (const path of walkSurfaces()) {
    if (!REDESIGNED.some((dir) => path.startsWith(dir))) continue;
    for (const match of source(path).matchAll(
      /<(?:h[1-6]|Heading)[^>]*className=\{?[`"]([^`"]+)[`"]/g,
    )) {
      const bad = [...match[1].matchAll(contested)].map((m) => m[1]);
      if (bad.length) offenders.push(`${path}: ${bad.join(", ")}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `silently overridden by the unlayered heading line-height:\n${offenders.join("\n")}`,
  );
});

test("Card can be the semantic element DESIGN.md asks for, and does not swallow its label", () => {
  const card = source("components/ui/primitives/Card.tsx");
  // DESIGN.md §5 wants the queue row and the attempt entry to be an <article>.
  assert.match(card, /as: Tag = "div"/);
  assert.match(card, /<Tag/);
  // TypeScript does NOT check hyphenated JSX attributes on a component, so
  // `<Card aria-label="…">` compiles clean even when the prop does not exist
  // and the label is dropped. It has to be declared and forwarded explicitly.
  assert.match(card, /"aria-label": ariaLabel/);
  assert.match(card, /aria-label=\{ariaLabel\}/);
});

test("every /build deep link names the param the builder actually reads", () => {
  // app/build/page.tsx prefills from `jobId` (query or fragment). Daily Matches
  // shipped `/build?job=<uuid>`, which navigates fine and silently drops the job
  // context — the user lands in an empty builder with no error. Nothing failed
  // loudly, so nothing caught it. Assert the param name repo-wide, not just at
  // the one site that was wrong.
  const offenders = walkSurfaces().filter((path) =>
    /\/build[?#]job=/.test(code(path)),
  );
  assert.deepEqual(
    offenders,
    [],
    `use /build?jobId= — 'job' is not read by the builder: ${offenders.join(", ")}`,
  );
  assert.match(
    source("app/build/page.tsx"),
    /const jobId = prefill\("jobId"\)/,
  );
});

test("the queue row and digest keep the wording that stops them overclaiming", () => {
  // DESIGN.md §5: provider success is acceptance, never delivery, and an
  // unknown outcome deliberately offers no resend action. This is a
  // claim-integrity constraint, not copy — a refactor must not soften it.
  const queuePath = "app/application-queue/queue-panel.tsx";
  const matchesPath = "app/daily-matches/daily-matches-client.tsx";
  const queue = source(queuePath);
  const matches = source(matchesPath);
  assert.match(
    queue,
    /Application email accepted by provider — delivery unverified/,
  );
  assert.match(queue, /Provider outcome unknown — do not resend automatically/);
  assert.match(queue, /provides no resend action for an unknown outcome/);
  assert.doesNotMatch(code(queuePath), /\bdelivered\b/i);
  assert.match(matches, /Notification accepted by provider/);
  assert.match(matches, /Notification outcome unknown; snapshot preserved/);
  assert.doesNotMatch(code(matchesPath), /\bdelivered\b/i);

  // DESIGN.md §5 connection status names exactly three labels. The real panel
  // had drifted to "Reconnect" and "Not connected" while /dev/jobs-primitives
  // showed the correct ones — the gallery was right and the product was wrong,
  // which is the failure mode a spec page invites if nothing checks the product.
  const connection = source("app/email-connection/connection-panel.tsx");
  for (const label of ["Connected", "Reconnect required", "Disconnected"]) {
    assert.match(
      connection,
      new RegExp(`"${label}"`),
      `missing the §5 status label "${label}"`,
    );
  }
  assert.doesNotMatch(
    code("app/email-connection/connection-panel.tsx"),
    /"Not connected"/,
  );
  assert.match(connection, /never grants sending access/);
});

test("the campaign field group is fieldset, legend, and explicit label pairs", () => {
  // DESIGN.md §5: "explicit label/control pairs" and "never use placeholder as
  // the label". Every control here used to be wrapped in an implicit <label>
  // with a raw .input class, which is neither.
  const campaign = source("app/campaign-settings/campaign-settings-client.tsx");
  assert.doesNotMatch(campaign, /className="input"/);
  assert.doesNotMatch(campaign, /className="btn/);
  assert.match(campaign, /<fieldset/);
  assert.match(campaign, /<legend/);

  const labels = [...campaign.matchAll(/htmlFor="([^"]+)"/g)].map((m) => m[1]);
  const controls = [
    ...campaign.matchAll(/<(?:Input|Select|input) id="([^"]+)"/g),
  ].map((m) => m[1]);
  assert.ok(
    labels.length >= 20,
    `expected the full campaign form, saw ${labels.length} labels`,
  );
  assert.deepEqual(
    labels.filter((id, i) => labels.indexOf(id) !== i),
    [],
    "duplicate id: both labels would point at the first control",
  );
  assert.deepEqual(
    labels.filter((id) => !controls.includes(id)),
    [],
    "label points at no control",
  );
});

test("a Suspense fallback never adds a second main landmark", () => {
  // Next streams the loading fallback and the resolved page into ONE document,
  // so a <main> in loading.tsx sits alongside the page's own <main> in the
  // served HTML. RouteLoading did exactly that and it reached seven routes at
  // once; app/{settings,tracker,billing,login,admin}/loading.tsx each did it
  // for one more. Error boundaries are exempt: they REPLACE the page.
  const offenders = walkSurfaces()
    .filter(
      (path) =>
        path.endsWith("/loading.tsx") || path.endsWith("RouteLoading.tsx"),
    )
    .filter((path) => /<main\b/.test(code(path)));
  assert.deepEqual(
    offenders,
    [],
    `two <main> landmarks in the served HTML:\n${offenders.join("\n")}`,
  );
});

test("every btn and badge class named in TSX is defined in a stylesheet", () => {
  // The Phase 4 lesson generalized: a missing component is a build error, a
  // missing CLASS is silence. Seven admin tables built their status pill name by
  // interpolation — `badge-${"success"}`, `badge-${tone}`, `badge-bad` — and the
  // compat sheet only ever defined good/mid/free/premium/model. Every one of
  // them rendered the same neutral grey, including the workflow health table,
  // whose entire job is showing which queues have failed.
  const css = [
    cssSource(),
    ...["globals.css", "admin/admin-workflows.css", "admin/analytics.css"].map(
      (f) => source(`app/${f}`),
    ),
  ].join("\n");
  const declared = new Set(
    [...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]),
  );
  const missing: string[] = [];
  for (const path of walkSurfaces()) {
    // Repo-wide on purpose. Admin is off these classes now, so scoping this to
    // admin would make it a test that can no longer fail; the ~60 usages left
    // on other surfaces are exactly what it still needs to protect.
    // Only what is actually rendered as a class. Scanning whole files also
    // catches import paths like ./admin-types, which are not classes at all.
    for (const attr of code(path).matchAll(
      /className=(?:"([^"]*)"|\{`([^`]*)`\})/g,
    )) {
      // The families this repo has actually shipped undefined: badge-* (seven
      // admin tables), btn-*, .input and .field-label (every admin authoring
      // form), .alert (five generator pages, Phase 4), and the admin-* layout
      // classes. Not a general class checker — Tailwind utilities live in the
      // same attribute and are generated, not declared here.
      // (?<![\w-]) rather than \b: a hyphen is a word boundary, so \binput
      // matches inside `bullet-input` and `file-input-hidden`, both of which
      // are defined and neither of which is this class.
      // Strip ${...} first: reports-board builds its class from a local
      // `const input = "..."`, and the identifier is not a class name.
      const classes = (attr[1] ?? attr[2] ?? "").replace(/\$\{[^}]*\}/g, " ");
      for (const m of classes.matchAll(
        /(?<![\w-])(badge|btn|input|alert|field-label|card|field|label|note|muted|hint|form-grid|admin-[a-z]+)(-[a-z0-9]+)*(?![\w-])/g,
      )) {
        if (!declared.has(m[0])) missing.push(`${path}: .${m[0]}`);
      }
    }
  }
  assert.deepEqual(
    missing,
    [],
    `class named in TSX but defined in no stylesheet:\n${missing.join("\n")}`,
  );
});

test("admin takes its buttons and badges from the design system", () => {
  // Phase 6 step one. `.btn`/`.badge` still exist for the 60-odd non-admin
  // usages, so this guard is directory-scoped like the heading one and widens
  // as later steps land.
  const offenders = walkSurfaces()
    .filter((path) => path.startsWith("app/admin/"))
    // Not \b: that treats the hyphen in `admin-refresh-btn` as a boundary and
    // reports a class this phase never touched.
    .filter((path) =>
      /className=(\{`|")[^"`]*(?<![\w-])(btn|badge)(-[a-z]+)*(?![\w-])/.test(
        code(path),
      ),
    );
  assert.deepEqual(
    offenders,
    [],
    `admin still on the compat button/badge classes:\n${offenders.join("\n")}`,
  );
});

test("Button offers the 36px compact size DESIGN.md allows, and nothing smaller", () => {
  // §4: "Touch targets are at least 44px except compact, non-primary controls
  // that remain keyboard accessible and at least 36px high." Button had no such
  // size, so admin's dense rows stayed on `.btn-sm`. `.admin-row-actions .btn`
  // shrank them to 30px, which was below the floor the spec sets.
  const button = source("components/ui/primitives/Button.tsx");
  assert.match(button, /compact: "[^"]*min-h-\[36px\]/);
  const heights = [...button.matchAll(/min-h-\[(\d+)px\]/g)].map((m) =>
    Number(m[1]),
  );
  assert.ok(
    heights.length >= 3,
    "expected a size scale, saw " + heights.length,
  );
  assert.deepEqual(
    heights.filter((h) => h < 36),
    [],
    "a button size below the 36px floor",
  );
});

test("a status tone helper returns a Badge variant, not a class name", () => {
  // This is what made the undefined badge classes survivable: the helpers were
  // typed Record<string, string>, so any name at all type-checked. Typed against
  // BadgeVariant, a name that is not a variant is a compile error.
  for (const path of walkSurfaces()) {
    if (!path.startsWith("app/admin/")) continue;
    const src = code(path);
    if (!/Badge/.test(src)) continue;
    assert.doesNotMatch(
      src,
      /Record<string, string>\s*=\s*\{[^}]*"badge-/,
      `${path}: tone map still keyed to class names`,
    );
  }
});

test("the shared building-block classes still have a base rule, not just modifiers", () => {
  // Phase 6 step 3 deleted `.card`, `.field`, `.label`, `.note`, `.ok`, `.err`
  // and `.success` from shared.css by accident: the hand-written deletion
  // spanned from the "Buttons" comment to the "Badges" comment and took
  // everything between them. The whole suite still passed, and the
  // defined-in-a-stylesheet guard could not see it either, because every one of
  // these names is also declared in globals.css or legacy-bridge.css by some
  // modifier or descendant rule. A name-existence check cannot catch a missing
  // BASE rule. This pins the base rules themselves.
  const css = cssSource() + source("app/globals.css");
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Literal regexes, not new RegExp(`...${name}...`) — the escaping needed to
  // build these dynamically silently matched nothing twice while I was writing
  // this, which makes an assertion vacuous rather than wrong.
  // Match EVERY base rule for the class and check the declarations together:
  // `.card { min-width: 0 }` in globals.css is a real base rule but carries none
  // of the paint, so an existence check alone passes with the paint deleted.
  const bases: Array<[string, RegExp, string[]]> = [
    [
      "card",
      /^[ 	]*\.card[ 	]*\{([^}]*)\}/gm,
      ["background", "border-radius", "padding"],
    ],
    ["field", /^[ 	]*\.field[ 	]*\{([^}]*)\}/gm, ["border", "border-radius"]],
    ["label", /^[ 	]*\.label[ 	]*\{([^}]*)\}/gm, ["font-weight"]],
    // `.note` and `.muted` were here until Phase 6 step 4 converted all 199
    // usages to tokens and deleted every rule keyed on them. They are pinned
    // the other way round now, below.
  ];
  for (const [name, rule, required] of bases) {
    const body = [...withoutComments.matchAll(rule)].map((m) => m[1]).join(";");
    assert.ok(body.trim(), `.${name} has no base rule left — only modifiers`);
    for (const prop of required) {
      assert.ok(
        body.includes(prop),
        `.${name} base rule no longer sets ${prop}`,
      );
    }
  }
});

// Phase 6 step 4b/4c. The compat sheets were declaring the same components
// twice. `.admin-table` was defined in app/compat/admin.css AND again in a
// later "ADMIN PANEL v2" block in legacy-bridge.css, the two disagreed — 14px
// vs 13.5px, `th` weight 700 vs 400, padding 12px 16px vs 8px 10px — and the
// later sheet won every contested property, so the block that read as the
// definition of the admin table rendered nothing. 150 declarations across four
// sheets were in that state.
//
// A stylesheet that says one thing and does another is the failure mode this
// whole phase keeps hitting, and it is worse than dead code: it is a trap for
// whoever writes the primitive next.
//
// Property-level, not selector-level. Two sheets may both mention a selector as
// long as they do not set the same property on it — that is how
// `.admin-table-card` keeps its surface in one sheet and its padding in
// another, and it is why this cannot be a "selector appears twice" check.
function compatDeclarations(file: string) {
  // A character walk, not a regex. Two regex attempts at this silently skipped
  // every other rule, because consuming the previous `}` as the delimiter means
  // the next rule has no delimiter left to match.
  const css = source(`app/compat/${file}`).replace(/\/\*[\s\S]*?\*\//g, " ");
  const out: Array<{
    at: string;
    sel: string;
    prop: string;
    important: boolean;
  }> = [];
  const atStack: string[] = [];
  let buf = "",
    prelude = "",
    inBlock = false,
    body = "";
  const flush = () => {
    for (const decl of body.split(";")) {
      const colon = decl.indexOf(":");
      if (colon < 0) continue;
      const prop = decl.slice(0, colon).trim();
      if (!prop) continue;
      out.push({
        at: atStack.join(" "),
        sel: prelude.replace(/\s+/g, " "),
        prop,
        important: /!\s*important/i.test(decl),
      });
    }
  };
  for (const ch of css) {
    if (ch === "{") {
      const p = buf.trim();
      buf = "";
      if (p.startsWith("@")) atStack.push(p);
      else {
        prelude = p;
        inBlock = true;
        body = "";
      }
      continue;
    }
    if (ch === "}") {
      if (inBlock) {
        flush();
        inBlock = false;
      } else atStack.pop();
      buf = "";
      continue;
    }
    if (inBlock) body += ch;
    buf += ch;
  }
  return out.filter((d) => d.sel && !d.at.startsWith("@keyframes"));
}

test("the element defaults are layered, except the heading line-height", () => {
  // Phase 6, the compat retirement. Unlayered rules beat every Tailwind utility
  // regardless of specificity, which is what made `font-bold`,
  // `tracking-[-0.03em]` and every heading and paragraph margin a silent no-op.
  //
  // Everything a utility should be able to override is now in @layer base. The
  // ONE exception is the heading line-height, and it is not an oversight:
  // Tailwind's `text-{size}` utilities set a line-height as well as a size, so
  // layering it hands every heading carrying `text-xl`/`text-2xl`/… Tailwind's
  // paired leading in place of the 1.15 the design system picked. Measured on
  // /pricing before it was split back out: 42 headings out of 42 changed, with
  // `text-xl` going 23px to 28px. Keeping that one property unlayered gets the
  // whole benefit of the move with no visual change at all.
  const globals = source("app/globals.css");

  const layered = [...globals.matchAll(/@layer\s+base\s*\{/g)].map((m) => {
    let depth = 0;
    for (let i = m.index! + m[0].length - 1; i < globals.length; i++) {
      if (globals[i] === "{") depth++;
      else if (globals[i] === "}" && --depth === 0)
        return [m.index!, i] as const;
    }
    return [m.index!, globals.length] as const;
  });
  const inALayer = (at: number) =>
    layered.some(([from, to]) => at > from && at < to);

  const pRule = globals.search(/^\s*p\s*\{\s*\n\s*margin:/m);
  assert.notEqual(pRule, -1, "the bare p rule moved; revisit this guard");
  assert.ok(
    inALayer(pRule),
    "p { margin } left @layer base — 299 paragraph margin utilities stop applying again",
  );

  const headingBlock = globals.search(
    /^\s*h1, h2, h3, h4, h5, h6 \{\s*\n\s*font-family/m,
  );
  assert.notEqual(
    headingBlock,
    -1,
    "the layered heading rule moved; revisit this guard",
  );
  assert.ok(
    inALayer(headingBlock),
    "the heading defaults left @layer base — font-weight, tracking and margin utilities stop applying to headings",
  );

  const headingLeading = globals.search(
    /^h1, h2, h3, h4, h5, h6 \{\s*\n\s*line-height/m,
  );
  assert.notEqual(
    headingLeading,
    -1,
    "the unlayered heading line-height is gone; revisit this guard",
  );
  assert.ok(
    !inALayer(headingLeading),
    "the heading line-height moved into @layer base — every heading with a text-{size} utility silently takes Tailwind's leading instead of 1.15",
  );

  // The layered block must not carry line-height back in by another door.
  const blockEnd = globals.indexOf("}", headingBlock);
  assert.doesNotMatch(
    globals.slice(headingBlock, blockEnd),
    /line-height/,
    "line-height is back inside the layered heading rule",
  );
});

test("no compat sheet re-declares a property a later sheet already sets", () => {
  // Import order, from app/globals-compat.css. Later wins at equal specificity,
  // and an identical selector string is identical specificity by definition.
  const ORDER = [
    "shared.css",
    "admin.css",
    "marketing.css",
    "auth.css",
    "tool.css",
    "legacy-bridge.css",
  ];
  const owner = new Map<string, { file: string; important: boolean }>();
  const shadowed: string[] = [];
  for (const file of ORDER) {
    for (const d of compatDeclarations(file)) {
      const key = `${d.at} | ${d.sel} | ${d.prop}`;
      const prior = owner.get(key);
      // An earlier !important beats a later normal declaration, so that pair is
      // not shadowing — it is the earlier one still winning.
      if (prior && prior.file !== file && prior.important === d.important) {
        shadowed.push(`${key} — ${prior.file} loses to ${file}`);
      }
      owner.set(key, { file, important: d.important });
    }
  }
  assert.deepEqual(
    shadowed,
    [],
    `compat declarations that never render:\n${shadowed.join("\n")}`,
  );
});

test("legacy-bridge.css styles nothing that no longer exists", () => {
  // The sheet being retired had 300 rules — 878 lines, 30% of it — keyed on
  // classes nothing in the repo can produce: a whole superseded admin chrome
  // (`.admin-sidebar`, `.admin-brand`, `.admin-avatar`, while the live console
  // renders `admin-pro-*`), the `.auth-card` shell, `.resume-card`, `.dash-stat`,
  // `.geo-bar`, `.st-card`, `.compare-table`, the skeletons. Deleting a
  // component and leaving its CSS is how it got there, and a ratchet is what
  // keeps it at zero.
  //
  // Two things this has to get right, both learned the hard way here:
  //  - Boundary matching, not substring. `page-head` "appears" inside
  //    `admin-page-head` and `admin-sidebar` inside `admin-sidebar-close`;
  //    treating those as uses keeps dead rules alive forever.
  //  - Interpolation. `t-compact`, `tone-blue`, `toast-success` and
  //    `photo-rule-customary` are named nowhere and are all LIVE, built as
  //    `t-${template}` and friends. A checker blind to that deletes real CSS.
  const corpus = walkSurfaces()
    .map((p) => source(p))
    .join("\n");
  const prefixes = new Set<string>();
  for (const m of corpus.matchAll(
    /[`"']([a-z][a-z0-9]*(?:-[a-z0-9]+)*-)(?:\$\{|"\s*\+|'\s*\+)/g,
  ))
    prefixes.add(m[1]);
  for (const m of corpus.matchAll(/([a-z][a-z0-9]*(?:-[a-z0-9]+)*-)\$\{/g))
    prefixes.add(m[1]);
  assert.ok(
    prefixes.has("t-"),
    "the interpolation scan found no `t-${...}` — it has stopped working, and would report live CSS as dead",
  );

  const cache = new Map<string, boolean>();
  const isNamed = (cls: string) => {
    if (!cache.has(cls)) {
      cache.set(
        cls,
        new RegExp(`(?<![\\w-])${cls}(?![\\w-])`).test(corpus) ||
          [...prefixes].some((p) => cls.startsWith(p)),
      );
    }
    return cache.get(cls)!;
  };

  const css = source("app/compat/legacy-bridge.css").replace(
    /\/\*[\s\S]*?\*\//g,
    " ",
  );
  const orphans: string[] = [];
  for (const rule of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const selector = rule[1].trim().replace(/\s+/g, " ");
    if (!selector || selector.startsWith("@")) continue;
    const branches = selector
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // A selector list survives if ANY branch can still match something.
    const allDead = branches.every((branch) => {
      const classes = [...branch.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(
        (m) => m[1],
      );
      return classes.length > 0 && classes.some((c) => !isNamed(c));
    });
    if (allDead) orphans.push(selector.slice(0, 90));
  }
  assert.deepEqual(
    orphans,
    [],
    `legacy-bridge.css rules for classes nothing can produce:\n${orphans.join("\n")}`,
  );
});

test("no keyframes name is defined in two compat sheets", () => {
  // Keyframes do not cascade per declaration: a later @keyframes of the same
  // name replaces the earlier one whole, so the earlier block is dead in full.
  // `dropdown-in` was defined in marketing.css with a scale() the page never
  // played, because legacy-bridge redefined it without one.
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const file of [
    "shared.css",
    "admin.css",
    "marketing.css",
    "auth.css",
    "tool.css",
    "legacy-bridge.css",
  ]) {
    for (const m of source(`app/compat/${file}`).matchAll(
      /@keyframes\s+([\w-]+)/g,
    )) {
      const prior = seen.get(m[1]);
      if (prior && prior !== file)
        dupes.push(`${m[1]} — in both ${prior} and ${file}`);
      seen.set(m[1], file);
    }
  }
  assert.deepEqual(
    dupes,
    [],
    `a keyframes name is defined twice, so the earlier one never plays:\n${dupes.join("\n")}`,
  );
});

test("the compat typography classes stay retired", () => {
  // Phase 6 step 4. `.muted` (132 usages) and `.note` (67) are gone from every
  // stylesheet, so a TSX file that names one now renders unstyled text rather
  // than muted text — silent, and exactly the failure mode `.input` had. The
  // defined-in-a-stylesheet guard above already fails on the TSX side, because
  // neither name is declared any more; this pins the CSS side so a rule cannot
  // quietly come back and make that guard vacuous again.
  const css = (cssSource() + source("app/globals.css")).replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const revived = [
    ...css.matchAll(/^[^\n{}]*\.(muted|note)(?![\w-])[^\n{}]*\{/gm),
  ].map((m) => m[0].trim());
  assert.deepEqual(
    revived,
    [],
    `a rule keyed on .muted/.note is back:\n${revived.join("\n")}`,
  );
});

test("a logged-in user can always reach their own workspace", () => {
  // The complaint this fixes: log in, land on /build, and there is no visible
  // way to your resumes. Three separate causes, so three assertions.

  // 1. Login with no `next` lands on the workspace, and that destination is a
  //    real route rather than a string that only looks like one.
  assert.equal(DEFAULT_AUTH_DESTINATION, "/dashboard");
  assert.ok(
    readdirSync(
      new URL(`../app${DEFAULT_AUTH_DESTINATION}`, import.meta.url),
    ).includes("page.tsx"),
  );

  // 2. A persistent Dashboard link on both breakpoints. It sits outside the
  //    Workspace dropdown on purpose — inside it, it needs a click to find.
  const nav = source("app/nav.tsx");
  const desktop = nav.slice(nav.indexOf("rs-nav-member-actions"));
  assert.match(
    desktop,
    /href="\/dashboard"[\s\S]{0,200}?className=\{`rs-nav-link/,
  );
  const mobile = nav.slice(nav.indexOf("rs-mobile-account-summary"));
  assert.match(
    mobile,
    /href="\/dashboard"[\s\S]{0,200}?className=\{`rs-mobile-nav-link/,
  );

  // 3. /resumes/[id] is a page, so /resumes must not 404. No loading.tsx in
  //    that directory: one under app/billing/ streamed a shell and committed a
  //    200 before redirect() could issue its 307, which is the same bug again.
  const resumes = readdirSync(new URL("../app/resumes", import.meta.url));
  assert.ok(resumes.includes("page.tsx"));
  assert.ok(!resumes.includes("loading.tsx"));
  assert.match(source("app/resumes/page.tsx"), /redirect\("\/dashboard"\)/);
});

test("a student account is never labelled Premium", () => {
  // Student Premium has its own allowance, its own credit rules and its own
  // win-back pricing, so "Premium" on a student account is the wrong tier.
  assert.equal(
    planLabel({ premium: true, premiumSource: "student" }),
    "Student",
  );
  assert.equal(planLabel({ premium: true, premiumSource: "paid" }), "Premium");
  assert.equal(planLabel({ premium: true, premiumSource: null }), "Premium");
  assert.equal(planLabel({ premium: false, premiumSource: "student" }), "Free");
  assert.equal(planLabel(null), "Free");

  // The label is useless if /api/me does not send the field.
  assert.match(
    source("app/api/me/route.ts"),
    /premiumSource: user\.premiumSource \?\? null/,
  );

  // Every surface that paints a plan badge from the session goes through the
  // helper. Without this the next one added quietly reintroduces the mix-up.
  for (const path of [
    "app/nav.tsx",
    "app/dashboard/page.tsx",
    "app/settings/page.tsx",
    "app/build/page.tsx",
  ]) {
    assert.match(
      code(path),
      /planLabel\(/,
      `${path} paints a plan badge without planLabel`,
    );
    assert.doesNotMatch(
      code(path),
      /\?\s*"Premium"\s*:\s*"Free"/,
      `${path} still hardcodes the Premium/Free label`,
    );
  }
});

test("the template catalogue only advertises templates the export engine renders", () => {
  // /resume-templates shipped six invented names (Clarity, Momentum, Ledger,
  // Studio, First Step, Borderless) that mapped to no template anywhere in the
  // repo, on a product whose whole pitch is not overclaiming — and the homepage
  // links here five times. Names are marketing and will change; the constraint
  // is that every advertised id is one the exporter can actually produce.
  const palettes =
    source("lib/pdf.tsx").match(/const PALETTES[\s\S]*?\n\};/)?.[0] ?? "";
  const real = new Set(
    Array.from(palettes.matchAll(/^\s{2}(\w+):\s*\{/gmu), (m) => m[1]),
  );
  assert.ok(
    real.size >= 4,
    `could not parse PALETTES from lib/pdf.tsx (got ${real.size})`,
  );

  const catalog = source("app/resume-templates/template-catalog.tsx");
  // The catalogue keeps marketing names and carries the engine id alongside
  // them, so the id to check is `engineId`, not the display name.
  const advertised = Array.from(
    catalog.matchAll(/^\s{4}engineId: "([^"]+)"/gmu),
    (m) => m[1],
  );
  assert.ok(advertised.length > 0, "no template ids found in the catalogue");
  const invented = advertised.filter((id) => !real.has(id));
  assert.deepEqual(
    invented,
    [],
    `advertised templates that the export engine cannot render: ${invented.join(", ")}`,
  );

  // The manual builder is where "Use this template" lands, so anything the
  // catalogue advertises has to be selectable once the visitor arrives.
  const maker = source("app/resume-maker/page.tsx");
  const offered = new Set(
    (maker.match(/const TEMPLATES = \[([^\]]*)\]/u)?.[1] ?? "")
      .match(/"([^"]+)"/gu)
      ?.map((s) => s.replaceAll('"', "")) ?? [],
  );
  const unreachable = advertised.filter((id) => !offered.has(id));
  assert.deepEqual(
    unreachable,
    [],
    `advertised but not selectable in /resume-maker: ${unreachable.join(", ")}`,
  );
  // ...and the CTA has to carry the choice, or the visitor re-picks by hand.
  assert.match(
    maker,
    /new URLSearchParams\(window\.location\.search\)\.get\("template"\)/,
  );

  // The introduction and methodology must match the catalogue.
  const spelled = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
  ][advertised.length];
  const marketing = source("app/resume-templates/page.tsx");
  assert.match(
    marketing,
    new RegExp(`${spelled} focused starting styles`, "iu"),
  );
  assert.match(marketing, new RegExp(`${spelled} layouts selected`, "iu"));
});

test("user-facing pages ask with the app's own dialogs, not the browser's", () => {
  // The workspace asked for deletes, renames, and mailbox disconnects through
  // native confirm/prompt/alert — including renaming a resume via window.prompt
  // — while AccessibleDialog and Toast already shipped in the same bundle.
  // Native dialogs cannot name what they are acting on beyond one line, block
  // the thread, and can be suppressed by the browser after the first one.
  // Admin is deliberately out of scope: it is an internal staff console.
  const offenders = walkSurfaces()
    .filter((path) => !path.startsWith("app/admin/"))
    .filter((path) => path !== "components/ui/ConfirmDialog.tsx")
    .filter((path) =>
      /(?:^|[^.\w])(?:window\.)?(?:confirm|alert|prompt)\s*\(/u.test(
        code(path),
      ),
    );
  assert.deepEqual(
    offenders,
    [],
    `use ConfirmDialog/Toast instead of native dialogs: ${offenders.join(", ")}`,
  );
});

test("the journey loop line stays one thin line, not a demo panel", () => {
  // The four-panel interactive demo was cut at the owner's direction — it
  // rendered fictional ATS widgets that read as filler. If ProductDemo or a
  // SegmentedControl ever reappears in the landing composition, this fails.
  const home = source("app/page.tsx");
  assert.doesNotMatch(home, /<ApplicationJourney \/>/);
  const loop = source("components/marketing/ApplicationJourneyLoopLine.tsx");
  assert.doesNotMatch(loop, /ProductDemo/);
  assert.doesNotMatch(loop, /SegmentedControl/);
});

test("the dashboard header does not re-implement the workspace nav", () => {
  // Eleven identical outline pills stood above the fold as pseudo-navigation,
  // nine of them already rendered by WorkspaceContextNav on the same page.
  // Scoped to the header block, not the file: an EmptyState CTA deeper in the
  // page is the same markup and is legitimately a link to one place.
  const meta =
    code("app/dashboard/page.tsx").match(
      /const workspaceMeta = me \? \([\s\S]*?\n  \) : undefined;/u,
    )?.[0] ?? "";
  assert.ok(meta, "could not find workspaceMeta in app/dashboard/page.tsx");
  const pills = (meta.match(/<Button as="a" href="\//gu) ?? []).length;
  assert.ok(
    pills <= 1,
    `dashboard header is re-growing its pill nav (${pills} links; workspace nav already covers these)`,
  );
});

test("the notification count is fetched once per load, not once per consumer", () => {
  // NotificationBell and NotificationCenter are both mounted app-wide and both
  // need this endpoint — the bell reads unreadCount, the banner reads banner —
  // so every page load by a logged-in user paid for the same auth check and the
  // same two database queries twice.
  const callers = walkSurfaces().filter((path) =>
    /"\/api\/notifications\/count"/.test(code(path)),
  );
  assert.deepEqual(
    callers,
    ["lib/notification-summary.ts"],
    `only the shared single-flight may call this endpoint: ${callers.join(", ")}`,
  );
  for (const consumer of [
    "components/NotificationBell.tsx",
    "components/NotificationCenter.tsx",
  ]) {
    assert.match(source(consumer), /fetchNotificationSummary\(\)/);
  }
});

test("admin rows that open a version are reachable without a mouse", () => {
  // Four views selected a version by putting onClick on the <tr> and nothing
  // else, so opening — and therefore inspecting, scheduling, or publishing —
  // any immutable version was impossible from the keyboard.
  const views = ["offers", "notifications", "communications", "legal"].map(
    (n) => `app/admin/views/${n}-view.tsx`,
  );
  const bare = views.filter((path) => /<tr[^>]*onClick=/.test(code(path)));
  assert.deepEqual(
    bare,
    [],
    `these still have a mouse-only row: ${bare.join(", ")}`,
  );
  for (const path of views) assert.match(code(path), /rowActivation\(/);
  // tabIndex + Enter/Space, without role="button": overriding the row role
  // would strip the table semantics screen readers use for column headers.
  const helper = source("app/admin/row-activation.ts");
  assert.match(helper, /tabIndex: 0/);
  assert.match(helper, /event\.key !== "Enter" && event\.key !== " "/);
  assert.doesNotMatch(code("app/admin/row-activation.ts"), /role: "button"/);
});

test("irreversible admin actions all ask the same way", () => {
  // Publishing an immutable offer once required typing "PUBLISH OFFER", while
  // the legal view published the document users are held to behind a single
  // OK, and permanently deleting a user used the same one-click confirm as
  // adding five credits. Every admin destructive flow now goes through the
  // one staged type-to-confirm dialog (useAdminConfirm → ConfirmDialog), with
  // a word derived from the action so the operator must read what they agree
  // to. Native confirm()/prompt() is banned from the admin surface.
  const legal = code("app/admin/views/legal-view.tsx");
  assert.match(legal, /word: "PUBLISH LEGAL"/);
  assert.match(legal, /word: "SCHEDULE LEGAL"/);
  assert.match(code("app/admin/views/users-view.tsx"), /word: "DELETE USER"/);
  assert.match(code("app/admin/views/offers-view.tsx"), /"PUBLISH OFFER"/);
  // The shared hook must render the staged dialog, not a native prompt.
  assert.match(
    code("app/admin/confirm-dialog.tsx"),
    /export function useAdminConfirm/,
  );
  assert.match(code("app/admin/confirm-dialog.tsx"), /confirmWord/);
});

test("controlled dialogs honour their open prop", () => {
  // app/admin/ConfirmDialog accepted `open` and then ignored it, so the
  // permanent-delete prompt mounted on every /admin/users load with an empty
  // email in the body and no Cancel could dismiss it. A controlled dialog
  // must render nothing while closed.
  const dialog = code("app/admin/confirm-dialog.tsx");
  // The gate is only real when `open` is actually destructured from props:
  // the first shipped fix added `if (!open) return null` but left `open` out
  // of the destructure, so the expression read window.open (always truthy)
  // and the dialog still mounted. Both halves must be present.
  assert.match(dialog, /^export function ConfirmDialog\(\{\s*open,/mu);
  assert.match(dialog, /if \(!open\) return null;/u);
});

test("premium surfaces keep the uniform 402 upgrade contract", () => {
  // Every gated route answers with {error:"premium_required"|"limit_reached",
  // upgrade:true} at HTTP 402 so clients can render one shared upgrade panel.
  // The newer gates (resume import, document export, cover-letter analyzer,
  // recruiter deep-read, cover letter tones) must not invent their own shape.
  assert.match(
    code("app/api/resume/import/route.ts"),
    /premiumRequired: true/u,
  );
  const docExport = code("app/api/tools/export-pdf/route.ts");
  assert.match(docExport, /error: "premium_required", upgrade: true/u);
  const analyzer = code("app/api/cover-letter-analyzer/route.ts");
  assert.match(analyzer, /error: "premium_required", upgrade: true/u);
  // New premium features (2026-08 attraction batch):
  const deepRead = code("app/api/recruiter-deep/route.ts");
  assert.match(deepRead, /error: "premium_required", upgrade: true/u);
  // Cover letter tones: warm/direct gate inside the premium-only route; free
  // users are already stopped by the route-level premium check above it.
  const coverRoute = code("app/api/cover/route.ts");
  assert.match(coverRoute, /tone === "warm" \|\| tone === "direct"/u);
  assert.match(coverRoute, /error: "premium_required", upgrade: true/u);
  // The tone picker is a premium surface on the resume detail page.
  const detail = source("app/resumes/[id]/page.tsx");
  assert.match(detail, /Cover letter tone/u);
});

test("free import previews stay a teaser, never the full draft", () => {
  // The format-wise import is premium. Free callers get counts and a small
  // sample to prove parsing worked — the structured content object itself must
  // not leave the server without an entitlement check.
  const route = code("app/api/resume/import/route.ts");
  assert.match(route, /currentUser\(\)/u);
  assert.match(route, /user\?\.premium/u);
  assert.match(route, /skillsSample: content\.skills\.slice\(0, 6\)/u);
  // The generic parser is only reachable after the LinkedIn detector runs, so
  // a LinkedIn export keeps its dedicated stricter anchors.
  assert.match(route, /looksLikeLinkedinExport/u);
});

test("the builder's resume import fills empty fields only after a full parse", () => {
  // Client-side pin: the builder applies imported fields rather than showing a
  // dead-end preview, and reports what came across.
  const build = code("app/build/page.tsx");
  assert.match(build, /\/api\/resume\/import/u);
  assert.match(build, /resumeContentToFormFields/u);
  assert.match(build, /Import from existing resume/u);
});

test("announcement rails stay slim theme-following rule-lines, not colored slabs", () => {
  // REDESIGN-SPEC.md §3.2: the promo and student rails are announcement
  // rule-lines. The 2026-08 slabs (purple/amber 105deg gradients plus diagonal
  // stripe overlays) predated the full-white/full-dark landing and read as
  // broken bands stacked on top of it. The shared anatomy paints only a
  // whisper of accent tint over the theme surface; identity comes from the
  // mono badge, never from a painted background or white slab text.
  const globals = source("app/globals.css");
  const start = globals.indexOf("Announcement rails");
  assert.notEqual(
    start,
    -1,
    "the shared announcement-rail block is missing from globals.css",
  );
  const rails = globals.slice(
    start,
    globals.indexOf("Primary site navigation", start),
  );

  assert.doesNotMatch(
    rails,
    /linear-gradient|radial-gradient|repeating-linear-gradient/,
  );
  // Theme-following: the rails and their copy resolve through tokens.
  assert.match(rails, /\.rs-promo-banner,\n\.rs-student-banner \{/);
  assert.match(
    rails,
    /\.rs-promo-banner,\n\.rs-student-banner \{[^}]*border-bottom: 1px solid var\(--hairline\)/,
  );
  assert.match(
    rails,
    /\.rs-promo-banner,\n\.rs-student-banner \{[^}]*background: var\(--rail-wash\)/,
  );
  assert.match(
    rails,
    /\.rs-promo-offer,\n\.rs-student-offer \{[^}]*color: var\(--color-text\)/,
  );
  // The two rails keep their distinct accents: amber for the promo rail
  // (premium emphasis only), primary blue for the student rail. The promo ink
  // is the brand amber-ink on light because secondary-hover measured 4.12:1
  // on the tinted chip and axe failed it; dark flips to bright amber.
  assert.match(
    rails,
    /\.rs-promo-banner \{[^}]*--rail-ink: var\(--color-brand-amber-ink\)/,
  );
  assert.match(
    rails,
    /\[data-theme="dark"\] \.rs-promo-banner \{[^}]*--rail-ink: var\(--color-secondary-hover\)/,
  );
  assert.match(
    rails,
    /\.rs-student-banner \{[^}]*--rail-ink: var\(--color-primary-hover\)/,
  );
  // One CTA color across both rails: the solid action blue every landing CTA
  // uses. White appears only there — on the solid fill, never as slab text.
  assert.match(
    rails,
    /\.rs-promo-offer-cta,\n\.rs-student-offer-cta \{[^}]*background: var\(--color-primary-solid\)/,
  );

  // Dismissal never flashes: the rails render in the server paint, so a stored
  // dismissal resolved only at hydration made the banner appear and then
  // vanish on every load — reported as a bug. layout.tsx must re-derive the
  // dismissal before first paint (same pattern as the theme script) and CSS
  // must hide on the pre-paint attributes; the components' post-hydration
  // check only converges the DOM. Window literals must stay in sync with the
  // components (promo 7d, student 14d).
  const layout = source("app/layout.tsx");
  assert.match(layout, /rs-promo-banner-dismissed/);
  assert.match(layout, /n-p<=7\*864e5/);
  assert.match(layout, /rs-student-banner-dismissed/);
  assert.match(layout, /n-s<=14\*864e5/);
  assert.match(
    rails,
    /html\[data-promo-off\] \.rs-promo-banner[^{]*\{[^}]*display: none/,
  );
  assert.match(
    rails,
    /html\[data-student-off\] \.rs-student-banner[^{]*\{[^}]*display: none/,
  );
  const studentBanner = source("app/student-banner.tsx");
  assert.match(studentBanner, /RETURN_AFTER_DAYS = 14/);
  const promoClient = source("app/promo-banner-client.tsx");
  assert.match(promoClient, /RETURN_AFTER_DAYS = 7/);
});

test("RoleSharp 2.0 multi-skill UX, review-step contracts, and payload shape", () => {
  const skillFields = source("app/build/skill-fields.tsx");
  const reviewStep = source("app/build/generation-review.tsx");
  const buildPage = source("app/build/page.tsx");
  const typesSource = source("lib/types.ts");

  // 1. SkillFields contracts: discrete rows, Enter/keyboard add, duplicate detection, reorder & remove
  assert.match(skillFields, /\+ Add another skill/);
  assert.match(skillFields, /Duplicate .* detected/);
  assert.match(skillFields, /Move skill \$\{index \+ 1\} up/);
  assert.match(skillFields, /Move skill \$\{index \+ 1\} down/);
  assert.match(skillFields, /Remove skill \$\{index \+ 1\}/);
  assert.match(skillFields, /event\.key === "Enter"/);
  assert.match(skillFields, /event\.key === "ArrowDown"/);
  assert.match(skillFields, /event\.key === "ArrowUp"/);
  assert.match(skillFields, /event\.key === "Backspace"/);

  // 2. ReviewStep contracts: dedicated in-flow step, exact safety principle, explicit CTA
  assert.match(reviewStep, /id="step-review-confirm"/);
  assert.match(
    reviewStep,
    /Only details you provide are used\. Review them before generating\./,
  );
  assert.match(reviewStep, /Confirm & generate resume/);
  assert.match(reviewStep, /← Back to edit form/);
  assert.match(reviewStep, /Edit section/);

  // 3. Builder page wiring & StepProgress
  assert.match(buildPage, /steps=\{.*"Review & Confirm".*\}/);
  assert.match(buildPage, /skills\.map\(\(skill\) => skill\.trim\(\)\)\.filter\(Boolean\)/);
  assert.match(buildPage, /<GenerationReview/);

  // 4. Backend schema: ProfileSchema enforces array of strings for skills
  assert.match(typesSource, /skills:\s*z\.array\(z\.string\(\)\)\.default\(\[\]\)/);
});

