# RoleSharp Design System

> **Read `REDESIGN-SPEC.md` alongside this file.** The Ink & Signal redesign
> (2026-08-22, eight batches, all on `main`) sits on top of the system described
> here: editorial tokens, a motion layer in `components/motion.tsx`, a 12px type
> floor, a 16px input floor, and hairline separators in place of boxes. Where the
> two disagree about a surface the redesign touched, the spec is current and this
> file is the layer underneath. `REDESIGN-TRACKER.md` says which surfaces those are.

This contract records the visual system implemented across `app/globals.css`,
`app/globals-compat.css`, shared page-family shells, UI primitives, navigation,
public directories, tool workspaces, authentication, and the signed-in product.
New surfaces must reuse these decisions before proposing additions.

## 1. Atmosphere & Identity

RoleSharp is a calm, technical career workspace: warm paper surfaces in light
mode, deep-navy surfaces in dark mode, compact product typography, and deep-blue
actions. Amber is reserved for Premium merchandising and selected brand emphasis;
success, warning, danger, and neutral states remain independent semantic colors.
Its signature is the “scan frame”: restrained corner marks, score rings, and
evidence rows that make the product feel like it is checking a document rather
than decorating one.

The primary journey is evidence → explanation → user-controlled action.
Information density is welcome when hierarchy remains obvious. Marketing
flourishes must not enter task surfaces, and application workflows must never imply
that fit is a hiring probability or that a provider acceptance is delivery.

Inclusive use cases are binding:

- A keyboard-only applicant must reach every tab, field, queue action, and
  dialog control in reading order, with visible focus and reliable return focus.
- A screen-reader user must hear a page purpose, field labels, status changes,
  score meaning, and recovery actions without visual-only color or position.
- A user with vestibular sensitivity must receive the same information and
  state changes with reduced motion enabled.
- A user under time pressure or with limited working memory must see one current
  state, one consequence, and one recovery action in plain language.

## 2. Color

### Palette

The canonical implementation tokens live in `app/globals.css`. Components use
semantic aliases so light/dark behavior remains automatic.

| Role | Token | Light | Dark | Usage |
| --- | --- | --- | --- | --- |
| Brand action | `--color-primary` / `--primary` | `#123B7A` | `#2F6FBD` | Primary actions and selected state |
| Brand hover/focus | `--color-primary-hover` / `--ring` | `#0B2D61` / primary | `#9FC3F2` | Hover and visible focus |
| Premium brand | `--color-brand-amber-solid` / `--accent` | `#D97706` | `#D97706` | Fixed-term Premium emphasis and selected brand details |
| Premium highlight | `--color-brand-amber` | `#F59E0B` | `#F6C75B` | Restrained decorative highlight; never warning state |
| Page background | `--bg` | `#F7F9FC` | `#061426` | Document background |
| Primary surface | `--surface` | `#FFFFFF` | `#0B1D34` | Cards, controls, dialogs |
| Secondary surface | `--surface-2` | `#F0F4F9` | `#112943` | Grouping and hover |
| Offset surface | `--surface-offset` | `#E6EDF5` | `#112943` | Skeletons and nested rows |
| Primary text | `--fg` | `#10243E` | `#F4F7FB` | Headings and body |
| Secondary text | `--muted-fg` | `#52647A` | `#B2C0D1` | Explanations and metadata |
| Border | `--border` | `#D5DFEA` | `#294361` | Dividers and control outlines |
| Success | `--success` / `--success-bg` | `#047857` / `#ECFDF5` | semantic dark surface | Connected, eligible, accepted |
| Warning | `--warning` / `--warning-bg` | `#C2410C` / `#FFF7ED` | semantic dark surface | Expiring, low confidence, review |
| Danger | `--danger` / `--danger-bg` | `#B91C1C` / `#FEF2F2` | `#F87171` / `#1A0F0F` | Error, disconnected, blocked |

### Rules

- Use color as reinforcement, never as the only carrier of status.
- Deep blue means an available action or selected state, not decoration.
- Amber means Premium or restrained brand emphasis. Warning orange remains a
  separate semantic token; green means verified positive evidence; red means
  blocked or failed. Unknown is neutral, not success.
- Do not add raw colors in product components. Add a semantic token here and in
  `app/globals.css` first.
- Body text targets WCAG 2.2 AA contrast (4.5:1); large text and UI boundaries
  target at least 3:1.

## 3. Typography

### Font stacks

- Display: `--font-display` (Space Grotesk through the application font
  variable, then the system sans stack).
- Body: `--font-body` (DM Sans through the application font variable, then
  system sans).
- Data: `--font-mono` (Geist Mono, then system monospace).

### Scale

| Level | Size | Weight | Line height | Usage |
| --- | --- | --- | --- | --- |
| Page title | `clamp(2rem, 4vw, 3.25rem)` | 700–800 | 1.08–1.15 | Marketing, tool, and workspace title |
| Section title | `1.5rem` | 700 | 1.2 | Primitive groups and major panels |
| Card title | `1.15rem–1.25rem` | 700 | 1.25 | Queue/job/card titles |
| Body large | `1.05rem` | 400 | 1.65 | Introductory copy |
| Body | `1rem` | 400 | 1.6 | Default content |
| Control | `0.9375rem` | 600 | 1.4 | Buttons and form values |
| Supporting | `0.875rem` | 400–600 | 1.5 | Explanations and row metadata |
| Label | `0.75rem` | 700 | 1.4 | Compact state labels |

Use tabular figures for fit, confidence, counts, limits, dates, and progress.
Use sentence case. Headings use balanced wrapping; prose uses pretty wrapping
and a maximum readable measure near 65–70 characters.

## 4. Spacing & Layout

The base unit is 4px. Existing layout intent maps to this scale:

| Token | Value | Usage |
| --- | --- | --- |
| `--jobs-space-1` | `0.25rem` | Tight inline separation |
| `--jobs-space-2` | `0.5rem` | Icon/label and compact metadata |
| `--jobs-space-3` | `0.75rem` | Control clusters |
| `--jobs-space-4` | `1rem` | Mobile card padding |
| `--jobs-space-5` | `1.25rem` | Standard card gaps |
| `--jobs-space-6` | `1.5rem` | Desktop card padding |
| `--jobs-space-8` | `2rem` | Primitive-group separation |
| `--jobs-space-12` | `3rem` | Major page separation |

- Content maximum: `--maxw` = `1200px`.
- Gutters: 16px narrow, 24px tablet, 32px desktop.
- Required QA widths: 375px, 768px, and 1280px.
- Marketing and workspace shells use document scroll. No nested scroll area is
  introduced unless its ownership and keyboard behavior are named.
- Intrinsic grids use `minmax(min(<floor>, 100%), 1fr)`; all flex/grid children
  that contain user text use `min-inline-size: 0`.
- At 375px, primary content reflows to one readable column with no horizontal
  page scroll. Labels and unbroken text wrap with `overflow-wrap: anywhere`.
- Touch targets are at least 44px except compact, non-primary controls that
  remain keyboard accessible and at least 36px high.

## 5. Components

### Page-family shells

- **MarketingShell:** full-bleed public storytelling with shared navigation,
  bounded content containers, evidence-led demonstrations, and truthful CTAs.
- **ToolShell:** compact tool header followed by a result-aware workspace. At
  widths up to 1024px, the desktop preview rail yields to an always-reachable
  preview/result action rather than removing generated documents or exports.
- **WorkspaceShell:** signed-in operational pages with one scoped header and the
  workspace context rail only on operational routes.
- **EditorialShell:** long-form guidance with a readable measure and optional
  sticky supporting navigation.
- **AuthShell:** authentication copy and form surface in one focused layout;
  safe internal destination continuity remains an application concern.

### Shared primitives

`Button`, `Card`, `Badge`, `Container`, `Section`, `PageHeader`, `SectionHeader`,
`Notice`, `SegmentedControl`, `MetricCard`, and `EmptyState` are the preferred
building blocks. Extend them before introducing a parallel button, card, badge,
header, notice, or empty-state system.

### Mobile work continuity

- Generated previews, PDF/DOCX exports, and saved-resume handoffs remain
  reachable when the desktop preview rail is hidden.
- Device-local drafts are versioned, bounded, and disclosed. Manual resume-maker
  text drafts expire after 30 days and exclude photos or image data.
- Clearing a stored draft removes future return continuity without unexpectedly
  closing or erasing the current open form.
- Touch targets aim for 44px, long content wraps, and repeated work is validated
  at 375px, 390px, 768px, and desktop widths.

### Workspace tabs

- **Structure:** labelled `nav` containing links; current destination uses
  `aria-current="page"`.
- **Variants:** current, available, unavailable.
- **States:** default, hover, focus, active/current, disabled.
- **Accessibility:** horizontal wrapping is preferred to hidden overflow;
  keyboard follows normal link order.
- **Motion:** color/surface change only, `--transition-fast`; no sliding marker.

### Campaign field group

- **Structure:** `fieldset`, visible `legend`, explicit `label`/control pairs,
  help and error text connected with `aria-describedby`.
- **Variants:** text, select, checkbox/toggle, read-only summary.
- **States:** default, hover, focus, disabled, error, success, saving.
- **Accessibility:** never use placeholder as the label; errors use `role=alert`
  only when introduced after interaction.

### Score breakdown

- **Structure:** named fit and confidence values followed by signal rows with
  contribution, reliability, evidence, and missing-data explanation.
- **Variants:** eligible, low confidence, hard blocked, stale.
- **States:** static explanation; optional disclosure uses a native button.
- **Accessibility:** fit and confidence are separate terms; text names every
  status and explanations sum to the shown score.

### Connection status

- **Structure:** provider name, verified sender identity, scope summary, status
  label, consequence, and one next action.
- **Variants:** connected, needs attention, disconnected, expired, loading.
- **Language:** “Connected”, “Reconnect required”, “Disconnected”; never imply
  that the RoleSharp login grants mailbox sending permission.

### Queue row

- **Structure:** semantic `article` or list item with job/company, score pair,
  package/approval status, timing, and grouped actions.
- **Variants:** ready for review, approved, blocked, stale, provider accepted,
  unknown.
- **Language:** provider success is “Application email accepted by provider —
  delivery unverified.” Unknown has no resend action.
- **Layout:** row at wide widths, stack at narrow widths; long titles and
  recipient-like strings wrap without moving actions off-screen.

### Dialog

- **Structure:** modal dialog with labelled title, description, content, and
  cancel/confirm group.
- **States:** closed/open, destructive confirmation, busy, inline error.
- **Accessibility:** opening moves focus inside; Tab remains within; Escape and
  backdrop close when safe; closing returns focus to the trigger.
- **Motion:** backdrop opacity and surface transform only; reduced motion uses
  the settled state immediately.

### Empty, error, and loading state

- **Structure:** heading, concise explanation, and recovery action when one
  exists. Loading uses stable skeleton geometry and `aria-busy`.
- **Variants:** no matches, no queued applications, recoverable error, blocked
  policy, skeleton loading.
- **Language:** explain what is retained and what the user can do next. Avoid
  “Oops”, generic “Something went wrong”, or false empty results.

## 6. Motion & Interaction

| Token | Value | Usage |
| --- | --- | --- |
| `--transition-fast` | `150ms cubic-bezier(0.16,1,0.3,1)` | Focus/hover tint |
| `--transition-base` | `200ms cubic-bezier(0.16,1,0.3,1)` | Surface state |
| `--transition-slow` | `300ms cubic-bezier(0.16,1,0.3,1)` | Dialog entry/exit |
| `--jobs-loading-cycle` | `1500ms` | Non-essential skeleton pulse |

- Motion explains state or relationship. Decorative looping motion is excluded
  from task surfaces.
- Animate only `transform`, `opacity`, and `filter`. Press feedback may translate
  by one pixel.
- Interactions remain interruptible and never delay input.
- `prefers-reduced-motion: reduce` removes non-essential animation, collapses
  transitions to an immediate settled state, and restores `scroll-behavior:auto`.
- Loading content remains announced without depending on animation.

## 7. Depth & Surface

RoleSharp uses a mixed but restrained depth strategy:

- Default task cards: primary surface, one semantic border, `--shadow-sm`.
- Sticky controls and elevated panels: `--shadow-md`.
- Dialogs: elevated surface and `--shadow-lg`.
- Hover elevation appears only on interactive cards.
- Nested rows use tonal surface shifts before adding another shadow.
- Radii follow the existing scale: 6px compact, 8–10px controls, 12–16px
  cards, 20px only for major feature shells, full radius only for buttons,
  status chips, and avatars.

## 8. Privacy-Safe Product Measurement

Product analytics measure meaningful workflow progression without collecting the
content being worked on.

- Event names are centrally allowlisted in `lib/product-analytics.ts`.
- Paths are same-origin route paths without query strings.
- Context keys are fixed or derived from predefined identifiers and match
  `^[A-Za-z0-9:_-]+$` with an 80-character limit.
- Page family, device class, and authentication state are bounded categories;
  the server derives page family again from the normalized path.
- Resume text, job-description text, email addresses, application notes, raw
  referrers, query strings, and persisted raw user agents are prohibited.
- Anonymous session IDs are per-tab UUIDs in `sessionStorage`; measurement
  failure must never interrupt product work.
- Raw product-event retention is bounded to 60 days unless an approved aggregate
  reporting requirement replaces the raw rows sooner.
- Instrumentation remains sparse: meaningful start, first value, demo steps,
  navigation selection, authentication continuation, and template intent—not
  every click or keystroke.

## 9. Accessibility Constraints & Accepted Debt

### Constraints

- Target WCAG 2.2 AA: 4.5:1 body contrast, 3:1 large text and component
  boundaries, visible focus on every control, and no keyboard trap.
- Page landmarks and headings follow a logical sequence; status and errors use
  appropriate live regions without announcing static content repeatedly.
- Controls retain accessible names at 200% zoom and in forced colors.
- Primary workflows work with keyboard, screen reader semantics, reduced motion,
  long labels, an unbroken string, stale data, and recoverable failure.
- The interface never relies on color, hover, animation, or pointer precision
  to convey required information.

### Accepted debt

| Item | Location | Why accepted | Owner / Exit |
| --- | --- | --- | --- |
| Legacy route rules remain layered and overridden in a large compatibility stylesheet. | `app/globals-compat.css` | Two accidentally repeated responsive layers and all exact duplicate rules were removed in Phase 6, reducing the file below 203 KB. Broader consolidation can change cascade behavior across many routes. | Do not grow the file. Migrate one route family at a time with source, browser, and visual regression coverage. |
| Shared dialog lives at `components/ui/AccessibleDialog.tsx` rather than under the primitive directory. | Shared dialog | It already provides focus trap, Escape, backdrop close, and return focus; moving it has no user-facing value. | Consolidate only when imports are migrated atomically with dialog regression coverage. |
| Existing raw color literals remain in legacy and older marketing rules. | Existing CSS | A site-wide token rewrite carries visual-regression risk and is not required for current behavior. | Remove opportunistically only with light/dark visual and contrast coverage. |
| Mobile work continuity is browser-local rather than installable. | Builder and resume maker | Repeated work is supported through responsive layouts, device-local drafts, and reachable exports. No evidence currently justifies PWA or native-app scope. | Revisit only from measured return-frequency, offline-use, or install-intent evidence. |
| The 60-day raw product-event boundary is documented and schema-bounded but requires an operations-owned deletion job in database-backed environments. | `db/migrations/044_privacy_safe_product_events.sql` | Product code does not assume a scheduler is available in every deployment mode. | Add and monitor a deployment-specific retention job before relying on long-running raw event storage. |
