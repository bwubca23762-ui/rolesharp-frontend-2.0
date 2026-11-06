# Full-Site Redesign — Tracker

**Spec:** `REDESIGN-SPEC.md` (Ink & Signal, ~90 routes, 8 batches)
**Ran:** 2026-08-22 · **Status:** shipped, with named gaps

All eight batches ran and are on `main`. Four of them shipped their core change
and deferred the rest; those deferrals are listed at the bottom and are not
forgotten. "Done" below means the batch's commit landed with every gate green
(typecheck, lint, node suite, production build) — not that the batch's whole
wishlist is built.

## Batches

| # | Batch | Commit | Landed | Deferred from it |
|---|---|---|---|---|
| 1 | Foundation — motion, editorial tokens, 12px type floor | `905100e` | full | fixed-element slot (moved into b6) |
| 2 | Landing rebuilt to 7 acts | `e36c511` | full | — |
| 3 | Pricing, students, auth pages | `8c8f343` | full | student card keeps its box (it is a form surface) |
| 4 | Tool shells | `5c47ef7` | field contract sitewide: 16px floor, focus ring, token radius | per-page Form primitives, GeneratedOutput unification, builder inline validation, sticky mobile CTA |
| 5 | Jobs + directories | `22434f1` | job rows unboxed to hairline; "Original" link 44px | hub header reskins |
| 6 | Workspace | `436650e` | dashboard 11-button meta row removed | `resumes/[id]` LivePreview reuse |
| 7 | Settings family | `436650e` | tab bar rebuilt as a segmented bar, labels at every width | staged destructive dialogs |
| 8 | Content + admin restrained pass | `8953c2e` | admin hex → tokens, 12px floor | blog/compare/about prose reskins |

Follow-up sweep `aef5e2a`: template catalogue → real engine ids + `?template=`
handoff, notification mark-all-read, sortable admin users + type-to-confirm
delete, "Coming soon" → "Access by request", footer Careers → `/careers`.
(Admin sorting later became server-side in `e42c477`; the client-side helper
that sweep added is gone.)

## Defects the batches shipped, found by the e2e suite and fixed

The batches were gated on typecheck/lint/node/build, and all four were green.
None of them look at a rendered page, so two real regressions went out:

- **Horizontal overflow on every workspace page** — the settings tab scroller
  forced a 1341px document inside a 390px viewport, because its `<nav>` grid item
  had no `min-w-0` and so was sized by intrinsic content width.
- **44 contrast failures at 1.19:1 and 1.41:1 on the landing page** — the ink
  canvas remapped the alias tokens but not the `--color-*` family, and two
  separators used a border token as a text colour.

Both fixed at the token/layout level rather than per component. The lesson for
the next batch: **add `npx playwright test` to the per-batch gate list.** The four
gates the batches ran cannot see a page.

## Still open

None. (2026-09-04: the editorial batch — blog index unboxed date-grouped
list, 68ch + hairline-underlined headings on post bodies, about sticky TOC —
closed the last items. Compare tables and legal pages were verified already
compliant. See ROLESHARP-PROGRESS.md, "editorial reskins" entry.)

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Ink & Signal, whole site, spec first | user-approved |
| D2 | No animation library — CSS plus one IntersectionObserver hook | the site had zero animation deps; keep it that way (<3KB JS) |
| D3 | `ScrollReveal` retired for `Reveal` | the old component had a reveal that could never fire |

## Rollback

One batch, one commit. `git revert <commit>` from the table above restores that
batch alone.

## If you change a class name

`tests/frontend-regression.test.ts` and `tests/performance-refactor.test.ts`
grep for class names and inline patterns. `tests/e2e/landing-redesign.spec.ts`
and `tests/e2e/account-admin-workspaces.spec.ts` pin real copy and real markup.
All four are meant to break when the page changes — realign them to what the page
claims now, in the same commit, and say so in the message. Deleting the assertion
instead is how the landing spec ended up describing a page that no longer existed.
