# RoleSharp — Full-Site Redesign Specification
## "Ink & Signal" — Editorial Motion System for ~90 Routes

**Version:** 1.0 · 2026-08-22
**Direction (user-approved):** Entire site (~90 routes) · Ink & Signal editorial · no box-type design · best-in-class weighted motion
**Execution:** After spec approval. Batched commits per phase, live-reviewable at each step.

---

## 0. WHAT THIS IS AND IS NOT

This is a **visual and motion system replacement** for every user-facing page.
It is **not** a rewrite of functionality: all routes, APIs, auth, data flows,
SEO metadata, JSON-LD, canonicals, hreflang, and business logic stay exactly as they are.

Three laws govern every change:

1. **NO FUNCTIONAL REGRESSION.** Every form still submits, every gate still gates,
   every test that asserts behavior keeps passing. Static-grep tests asserting old
   class names WILL break — each batch updates them deliberately, never blindly.
2. **NO BOX-TYPE DESIGN.** Bordered rounded rectangles as the default content unit
   are abolished. Content units separate by whitespace, type scale, hairline rules,
   and alignment. Cards survive ONLY where a boundary is functionally required:
   interactive list rows, dialogs, the kanban board, code/pre blocks, embedded media frames.
3. **MOTION HAS MEANING.** Every animation communicates hierarchy, state, or
   causality. Nothing decorates. Everything respects `prefers-reduced-motion`.

---

## 1. FOUNDATION — TOKENS (extend, don't replace)

The existing token system (`app/globals.css`, documented in DESIGN.md §2) stays
canonical. We ADD an "editorial layer":

```css
/* ── Editorial layer (new) ── */
--ink: var(--bg);                       /* page canvas */
--paper: color-mix(in oklab, var(--surface) 55%, var(--bg)); /* raised canvas, used ≤2×/page */
--hairline: color-mix(in oklab, var(--border) 55%, transparent);
--rule-strong: var(--border);
--glow-primary: color-mix(in oklab, var(--primary) 16%, transparent);
--ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
--dur-micro: 180ms;
--dur-reveal: 600ms;
```

### Typography contract (fixes the 16-arbitrary-sizes chaos)
| Role | Spec | Replaces |
|---|---|---|
| Display XL (hero H1 only) | `clamp(2.75rem, 6.4vw, 5rem)` / 800 / -0.03em / 0.98 | ad-hoc clamps |
| Display L (section heads) | `clamp(1.85rem, 3.4vw, 3rem)` / 750 | text-2xl/3xl drift |
| Title (card/page titles) | `1.35rem` / 700 | mixed |
| Body | `1.0625rem` (17px) / 1.65 / max 62ch | 13px/0.85rem sprawl |
| Meta/eyebrow | `0.8125rem` mono / uppercase / 0.14em tracking | 7–11px sizes |
| Data/tabular | mono, tabular-nums | inline styles |

**Hard floor: nothing below 12px anywhere.** A codemod replaces `text-[Npx]` < 12.

---

## 2. THE MOTION SYSTEM — one file, one hook, three primitives

New file `components/motion.tsx` ("use client", <2KB gzipped):

```tsx
Reveal      — IntersectionObserver wrapper (threshold 0.15, rootMargin -40px,
              fires once, unobserves). Props: delay (stagger ms), variant
              ("rise" | "fade" | "rule" | "clip").
RuleReveal  — hairline scaleX 0→1 origin-left on visible.
CountUp     — existing AnimatedCounter re-wrapped to fire on visibility.
```

CSS lives in ONE appended `@layer components` block in `globals.css`
(`.rvl-*` classes). Keyframes:

- rise: translateY(18px)+opacity → 0/1, var(--dur-reveal), ease-out-quint
- rule: scaleX 0→1, 700ms, origin-left
- clip (media only): clip-path inset(0 0 100% 0)→inset(0)
- float: ambient ±8px 9s alternate infinite (hero media ONLY)

**Timing law:** micro 150–220ms · reveals 500–700ms · stagger 60–90ms ·
hero total ≤900ms. Easing: entrances `--ease-out-quint`, hovers `--ease-standard`.

**Reduced motion:** single media block zeroes every `.rvl-*` transform and makes
reveals instant-opacity. ScrollReveal (old component) is RETIRED — replaced by Reveal.

**SSR/LCP law:** above-fold content renders VISIBLE server-side (hero never hides
behind JS). Below-fold sections start hidden via CSS only when JS has mounted
(`html.js .rvl-wait` pattern) so no-JS users see everything.

---

## 3. PAGE-FAMILY BLUEPRINTS

Every family gets: new layout skeleton, unboxing rules, motion assignments,
and the specific pages in scope.

### 3.1 LANDING (app/page.tsx + components/marketing/*)
Per the approved landing prompt: 13 acts → 7 acts. Hero (outcome headline,
server-rendered, glow, bleed screenshot with unboxed floating readout chips),
proof strip (marquee + counts as one 120px line), Method (sticky head +
unboxed strikethrough→grounded rows), Journey (reskinned tabs w/ progress rail,
aria-live scoped), Plans (three columns split by vertical hairlines, middle
emphasized scale 1.02 + glow — borderless), merged FAQ+stats, Close statement.
CUT: ProductEcosystem, CountryIntelligence, TemplateStudio section, StartingPaths
(intents fold into hero links). Trust claims appear ONCE (plans). One CTA verb
per destination. Copy changes from the approved landing prompt apply verbatim.

### 3.2 PRICING + STUDENTS (pricing, students, refund)
Same borderless plan columns as landing Act 5 (shared component `PlanColumns`).
Comparison table becomes a definition-list on mobile (CompareTable pattern already
proves this). FAQ stays native details. Student banner restyled as a slim
announcement rule-line, dismissible, not a colored slab.

### 3.3 TOOL SHELLS (checker, resume-fixer, build, resume-maker, linkedin-checker,
cover-letter-generator, interview-prep, skill-gap, resume-translator, 5 generators)
**One ToolShell v2**: eyebrow + display title + one-line promise + hairline rule.
Two-column workbench ≥1024px (form left 7fr / result right 5fr sticky), stacked
below with results in a full-width reveal band. All compat `.field/.label` markup
migrates to Form primitives IN THIS PASS (kills generation #1 styling).
Upload zones: dashed hairline frame, focus-within ring, drag-over fill animation.
Builder wizard: steps become a real segmented progress rail (current step labeled,
others numbered); validation moves inline per-section (aria-describedby), the
aggregate error string dies; generate button sticks to viewport bottom on mobile.
Result surfaces unified into one `GeneratedOutput` component (mono-readable block,
copy button, export row) replacing textarea-result/extra-box/pre variants.

### 3.4 JOBS + INTERNSHIPS + COMPANIES + ROLES directories
Directory pages lose their card wrappers: listings become full-width rows divided
by hairlines (existing job-row anatomy kept, reskinned). Filters become a single
inline row on desktop / disclosure on mobile (pattern exists). Hub headers get
the eyebrow+display treatment. Job detail actions keep buttons but lose boxes.

### 3.5 AUTH PAGES (login, forgot-password, reset-password)
AuthShell v2: centered single column, display headline, form fields full-width,
no side card — benefits become three hairline-separated lines under the form.
Motion: form rises once; field focus rings animate width. Terms checkbox row
restyled inline.

### 3.6 WORKSPACE (dashboard, tracker, daily-matches, application-queue,
notifications, email-connection, campaign-settings, support, resumes/[id])
WorkspaceShell header simplifies: eyebrow + title + ONE primary action + meta
line. The 11-button dashboard meta row DIES (nav covers it; quick stats remain).
Dashboard cards become unboxed stat rows (huge numeral + label + delta) separated
by rules; overview link-cards become full-width hairline rows with hover-slide.
Tracker kanban KEEPS its board boxes (functional requirement) but column headers
lose chrome; add-form opens inline. resumes/[id] gains the real LivePreview reuse
+ print stylesheet (from audit fix list).

### 3.7 SETTINGS (settings + panels, billing, account, security redirects)
Tab nav becomes a horizontal scrollable segmented bar on ALL viewports (kills the
icon-grid problem). Panels drop Card nesting: sections = heading + hairline +
rows. Billing table gains a <640px definition-list fallback. Every destructive
action standardizes: danger Button + staged confirm dialog (AccessibleDialog),
replacing confirm()/prompt() sitewide in this family.

### 3.8 CONTENT/EDITORIAL (blog, compare, learn, help, about, careers, contact,
legal pages, guides, report)
Prose rhythm: measure 68ch, drop-cap optional off, headings hairline-underlined.
Blog index: unboxed date-grouped list (title + dek + meta line), hover shifts
title color only. Compare pages keep tables (functional) inside a scroll frame.
About/legal get the two-column sticky-TOC layout where >1200px.

### 3.9 ADMIN (app/admin/**) — RESTRAINED PASS
Admin keeps its compact density (it's a tool) but inherits: tokens-only colors
(kill hex literals), 12px floor, Skeleton loading states, sortable table headers,
success Notice after every mutation, keyboard-accessible row activation, and the
type-to-confirm convention unified for high-blast actions. No structural redesign —
admin efficiency beats aesthetics.

### 3.10 SYSTEM WIDE FIXES ROLLED INTO THIS REDESIGN
- Fixed-element coordination: cookie consent + geo pill + FAB get shared
  bottom-slot logic (only one bottom-fixed element visible; safe-area insets added).
- `.field` font-size → 16px sitewide (iOS zoom fix).
- Focus-visible ring standardized (2px primary offset ring) globally.
- Dark-mode pairs audited per-component as each is touched.
- og:title = title enforced on touched pages.
- All `/build?job=` style deep links fixed as encountered.

---

## 4. EXECUTION PLAN — 8 BATCHES

| # | Batch | Pages | Commit gate |
|---|---|---|---|
| 1 | Foundation: motion.tsx + rvl-* CSS + typography codemod + fixed-element slot + field 16px | infra | typecheck+lint+tests+build green; visual smoke on landing |
| 2 | Landing rebuild (7 acts) + marketing component cuts | 1 page | live review vs current |
| 3 | Pricing + students + auth pages | 5 | live review |
| 4 | Tool shells v2 (10 tool pages + 5 generators) + GeneratedOutput + builder wizard fixes | 15 | live review + manual flow test of build/checker |
| 5 | Jobs + directories (jobs, internships, companies, roles, compare hubs) | ~12 | live review |
| 6 | Workspace (dashboard, tracker, daily-matches, queue, notifications, email-connection, campaign-settings, support, resumes/[id] + preview/print) | 9 | live review + flow tests |
| 7 | Settings family + destructive-dialog standardization | 6 | flow tests |
| 8 | Content/editorial + blog/compare/about/legal/help/careers/contact + admin restrained pass + static-test updates | ~30 | full suite green |

Each batch ends: `npm run typecheck && npm run lint && npm test && npm run build`
plus browse-based before/after screenshots of 3 representative pages at 1440 and 390.

## 5. RISKS & GUARANTEES

- **Static tests will fail loudly** (frontend-regression greps class names). Each
  batch updates assertions to the new structure — this is deliberate migration, reviewed per diff.
- **No SEO regression:** metadata exports untouched; only rendered DOM/classes change.
  Canonicals/hreflang/JSON-LD byte-identical.
- **Rollback:** per-batch commits mean any batch can be reverted alone.
- **Out of scope:** admin structural redesign, new features, backend changes, copywriting beyond the specified hero/CTA/trust edits.

## 6. DEFINITION OF DONE (whole effort)

A visitor can scroll the entire site and never see a content-bearing rectangle
that isn't functionally required; every scroll reveal is weighted and purposeful;
no text below 12px exists; the site passes contrast/focus/reduced-motion gates;
all 391 behavioral guarantees hold; and the page-family shells share one visual
voice instead of four generations.
