# RoleSharp frontend UI/UX audit — 2026-11-05

## Scope and method

This is a review and improvement plan, not an implementation or redesign.

I reviewed the product contract in `DESIGN.md`, the public-page composition and
shared navigation/motion code, and live local-browser states for `/`,
`/checker`, `/build` (signed out), `/resume-templates`, `/jobs`, and `/pricing`.
The route inventory contains 139 `page.tsx` entries, including public,
authenticated, dynamic, internal/admin, and development-only routes.

The repository's screenshot runner covers 30 representative public routes in
desktop light, mobile light, and desktop dark. It could not be run in this
working tree because it intentionally invokes `next start` and there is no
production build in `.next`; the local site available for review is `next dev`.
The all-route HTTP audit also did not complete within a safe review window
because it probes 187 handlers in addition to every page. Neither result is a
product failure. Signed-in, payment, application-sending, and admin flows were
not exercised because doing so requires real account/data state and could create
or change user data.

## Product understanding

RoleSharp is not just a resume editor. It is an evidence-led career workspace:
candidate evidence + a specific company/role/job description becomes an
ATS-aware resume, then connects to checking, interview preparation, job search,
tracking, and follow-up. Its strongest positioning is precise tailoring without
inventing experience, country-aware guidance, fixed-term pricing, and user
control before consequential actions.

That product model is well represented by the public information architecture:
free checking is the lowest-risk entry, tailored creation is the primary action,
and jobs/tracker/preparation are downstream workflows.

## What is already strong

1. **A real design system, not a skin.** Semantic light/dark tokens, defined
   type roles, a 4px spacing scale, shared shells, and motion constraints are
   documented and mostly visible in the reviewed screens.
2. **Clear visual identity.** Deep blue actions, quiet paper-like surfaces,
   scan-frame corner marks, restrained amber, DM Sans/Plus Jakarta Sans, and
   evidence-oriented language make the product feel more trustworthy than a
   generic AI tool.
3. **Good task framing.** The checker begins with one named job target and one
   resume source. Templates say why each is appropriate and clearly mark sample
   content as fictional. The signed-out builder offers a clear start path rather
   than a dead editor.
4. **Good accessibility foundations.** Reviewed pages expose a skip link,
   a labelled main navigation, meaningful page headings, labelled controls, and
   structured FAQ content. Motion code explicitly honours reduced-motion.
5. **Pricing is unusually clear.** Fixed term, no auto-renewal, allowance, and
   return-to-Free language are consistently prominent.

## Findings and prioritized improvements

### P0 — Reduce top-of-funnel competition on the landing page

The home page composes ten acts: promotion, hero, product demo, proof marquee,
tool suite, testimonials/comparison/templates, methodology, journey, plans,
referral, and FAQ. Each is individually defensible, but together they create a
long, multi-goal page before a job seeker gets to the essential decision.

**Improve:** preserve the evidence-led hero, but establish one conversion path
above the fold: `Check a resume` as the primary path and `Tailor to a job` as
the secondary path. Move referral and detailed comparison below FAQ or into
their own destination. Treat the product demo as the proof mechanism; do not
make it compete with tool discovery, pricing, and rewards in the first scroll.

**Why it matters:** a job seeker under time pressure needs one current action,
not a catalogue of valid next actions.

### P0 — Make anonymous vs member-only access explicit before interaction

`/jobs` visually presents search as the hero action but the live local state
settles into “Members-only jobs search.” The builder is clearer: it renders
purpose and immediately offers `Log in / Sign up` or the free checker.

**Improve:** on member-only pages, put the access condition adjacent to the
first action before users type. Use a compact, stable access card with: what is
available after sign-in, why account continuity matters, and one primary CTA.
Keep a useful public preview (for example, country coverage and a sample
listing), but do not let the search box look ready when results require an
account.

### P1 — Simplify route and navigation taxonomy

The public footer exposes 40+ links and the application has 139 page entries.
The depth is good for SEO and feature reach, but people cannot infer the
canonical path from the product vocabulary alone: “build,” “resume builder,”
“resume maker,” “checker,” “resume match,” and “fixer” overlap in intent.

**Improve:** make the top-level system four durable jobs-to-be-done:

- Assess: checker, match, fixer, parser.
- Create: tailored builder, manual maker, templates, cover letter.
- Prepare: interview, LinkedIn, salary, career guidance.
- Organize/apply: jobs, tracker, daily matches, auto-apply.

Use this taxonomy in the desktop mega menu, mobile drawer, tool workspace
breadcrumb, and footer. Retain SEO routes, but designate a single canonical
destination for every intent and cross-link from alternates.

### P1 — Turn motion into feedback rather than spectacle

The custom motion layer is technically considerate: it uses transforms and
opacity and disables effects under `prefers-reduced-motion`. However, the
landing includes multiple independent, always-on decorative loops (hero float,
back-card float, badges, glow pulse, sheen, marquee). This can dilute the calm,
technical workspace character and consume compositing budget on low-end devices.

**Improve:** retain one signature motion moment in the hero and one stateful
motion treatment in tool cards. Remove or pause decorative loops after first
view, especially sheen/glow/badge bobbing. Do not use magnetic hover for core
CTAs. Reserve motion for state changes: score progress, upload accepted,
keyword gap resolved, section saved, and export ready.

### P1 — Replace broad transition declarations

There are 69 `transition-all` usages across 22 TS/TSX files. It makes later
visual changes harder to reason about and can animate layout-affecting
properties unintentionally.

**Improve:** replace them in shared/visible controls with explicit properties:
`color`, `background-color`, `border-color`, `box-shadow`, `opacity`, and
`transform`. Keep durations in the design-system tokens. This is a small
engineering change with a large predictability payoff.

### P1 — Audit high-stakes marketing assertions and comparative language

Pricing comparison content makes claims such as “90% ... get rejected” and
“guaranteed to parse 100%.” For a resume product, this undermines the otherwise
careful evidence-first promise if it cannot be substantiated in context.

**Improve:** replace absolute or unsourced claims with precise capability
language: “single-column, text-based export designed for ATS readability” and
“we flag common parser risks.” Where a benchmark exists, link the methodology,
sample size, date, and limitations. This is both a trust and conversion
improvement.

### P2 — Improve control semantics and scanning density in long marketing pages

The templates filter presents mutually exclusive categories as checkboxes;
pricing uses a visually segmented duration switch. Both are understandable, but
their interaction model should be unambiguous to keyboard and assistive-tech
users.

**Improve:** use a radiogroup/radio pattern for single-select template filters,
and either a radiogroup or well-described pressed toggle buttons for pass
duration. On mobile, reduce repeated all-caps mono labels and dense pill rows;
keep the label only where it helps scan a real decision.

### P2 — Make the public shell lighter on task surfaces

The checker is strong, but it inherits a complete multi-column footer and
repeated tool-shell framing. On long tools, the operational work area becomes a
small fraction of a very long document.

**Improve:** preserve the compact tool header and current-workspace context,
but use a reduced “task footer” for high-intent tools: trust links, support,
and a return to tool index. Keep the full discovery footer for editorial and
marketing surfaces.

### P2 — Establish a screenshot and route-coverage gate in CI

The repository already has excellent foundations: `capture:ui` and `audit:ui`.
They currently require a prebuilt production app, so they were unavailable to a
development-only review session.

**Improve:** make CI run `next build`, then run the 30-route visual capture and
sitemap audit. Store baseline screenshots for 1440px light/dark and 390px
light, and review diffs for public route families. Add authenticated fixtures
for builder, tracker, queue, billing, and error/empty/loading states without
using production data.

## Page-family recommendations

| Family | Preserve | Improve next |
| --- | --- | --- |
| Landing | Evidence inspector, clear blue CTA, visible product proof | Collapse conversion choices; cut campaign/referral competition above the fold; reduce decorative loops. |
| Checker/tools | Stepwise input, sample/reset, clear labels | Add a persistent progress/result handoff, concise task footer, and explicit outcome/recovery states. |
| Builder | Signed-out decision point and FAQ expectation-setting | Test signed-in editor at 375/768/1280 with long documents, save failures, exports, and keyboard-only section editing. |
| Templates | Six purposeful templates, fictional sample disclosure | Make category choice semantically single-select; show selected template's ATS/country suitability at point of selection. |
| Jobs | Country-specific intent and handoff to tailoring | Show access requirements before typed search; distinguish loading, no result, and sign-in-required states. |
| Pricing | Fixed-term, no-auto-renewal clarity | Tone down adversarial/absolute comparisons; define every allowance in a compact comparison and ensure one obvious checkout handoff. |
| Auth/workspace/admin | Existing shell separation | Review with fixtures: first-run, empty, offline, error, expired session, permission denied, and destructive confirmation. |

## 30/60/90-day improvement plan

### First 30 days — conversion clarity and risk reduction

1. Re-sequence the landing page around one primary and one secondary action.
2. Make membership gates explicit on jobs, tracker, and any protected tool.
3. Replace unsupported absolute ATS/comparison claims.
4. Replace `transition-all` in shared components and marketing primitives.
5. Add screenshot baselines for the six audited public routes.

### Days 31–60 — flow coherence and inclusive quality

1. Normalize navigation taxonomy and canonical task destinations.
2. Ship control-semantic fixes for filters, segmented switches, dialogs, and
   focus-return cases.
3. Add instrumented funnel events from check -> tailor -> create -> export,
   with privacy-appropriate product analytics.
4. Test mobile continuity for tool output, downloads, and saved-draft recovery.

### Days 61–90 — operational product quality

1. Add stable authenticated visual fixtures and a CI visual gate.
2. Measure Core Web Vitals on the landing, checker, builder, jobs, and pricing;
   use the result to trim nonessential animation and third-party work.
3. Conduct a keyboard/screen-reader pass of the authenticated workflow:
   resume draft -> score -> revision -> export -> job tracking.
4. Establish quarterly copy/proof review for pricing and outcome claims.

## Code evidence

- Home composition: `app/page.tsx:36-130`.
- Announcement priorities and truncation: `components/marketing/SmartTopBar.tsx:61-195`.
- Navigation focus, Escape, hover-close behavior: `app/nav.tsx:41-121`.
- Motion implementation and reduced-motion fallbacks: `app/landing-motion.css:1-198` and `components/motion.tsx:1-91`.
- Pricing information architecture and plan switcher: `components/marketing/ModernPlans.tsx:52-112`; comparison content exposed through `app/pricing/page.tsx:65-155`.
- System contract and accessibility requirements: `DESIGN.md:1-240`.

## Conclusion

RoleSharp already has a mature, differentiated frontend foundation. The largest
return is not a visual reinvention: it is disciplined prioritization. Make one
next action unmistakable, make access rules explicit before effort, reserve
motion for meaningful state, and back every high-stakes claim with evidence.
That would make the current calm, technical visual language feel even more
credible in a live job-search workflow.
