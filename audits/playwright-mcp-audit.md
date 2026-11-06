# RoleSharp Playwright MCP live audit

Date: 2026-07-29

Target: `https://rolesharp.com`

Browser: official Microsoft `@playwright/mcp@latest`, isolated headless Google Chrome

## Configuration

The MCP server was configured with:

- `--browser chrome`
- `--headless`
- `--isolated`
- `--console-level warning`
- `--snapshot-mode none`
- `--image-responses omit`
- 10-second action and 45-second navigation timeouts

Disabling automatic full snapshots was necessary because the 8,000-pixel landing page generated an oversized accessibility snapshot. Explicit shallow snapshots still worked.

## Routes and viewports tested

| Route | Desktop 1440×900 | Mobile 390×844 | Result |
|---|---:|---:|---|
| `/` | Yes | Yes | Pass |
| `/build` | Yes | Yes | Pass |
| `/resume-fixer` | Yes | Yes | Pass |
| `/checker` | Yes | Yes | Pass; file input scanner false positive rejected |
| `/jobs` | Yes | Yes | Pass |
| `/pricing` | Navigation/title pass | MCP DOM call stalled | Page independently responsive; see harness note |
| `/login` | Yes | Yes | Pass |
| `/admin` | Navigation/title pass | Not completed in MCP | Unauthenticated login state independently verified |

## Confirmed behavior

- Homepage Products menu opens on hover and exposes its six intended application links.
- Homepage Resources menu opens on hover and exposes templates, examples, academy, and student links.
- Theme toggle changed from “Switch to dark mode” to “Switch to light mode”.
- Primary CTA destinations are correct: `/build` and `/resume-fixer`.
- Homepage has no horizontal overflow at 1440×900 or 390×844.
- `/jobs` correctly renders the Jobs link with `aria-current="page"` and class `rs-nav-link is-active`.
- `/build`, `/resume-fixer`, `/checker`, and `/jobs` had no horizontal overflow at either tested viewport.
- `/login` rendered its form, had no visible errors, no unlabeled controls, and no horizontal overflow at either viewport.
- Console checks returned `0 errors, 0 warnings` across the completed route checks.
- Dynamic network requests completed successfully. The only non-200 observation was an expected Cloudflare JavaScript challenge redirect; `/api/me`, `/api/geo`, RSC route prefetches, and Cloudflare RUM completed successfully.

## Accessibility triage

The automated DOM query initially flagged the `/checker` file input as unnamed. Source validation rejected this as a false positive: `app/checker/page.tsx:336-354` nests the input inside a visible label containing the upload instruction.

## Harness issue, not a website issue

Playwright MCP twice timed out while running DOM evaluation on `/pricing` and once on unauthenticated `/admin`, although navigation and page titles completed. The timed-out MCP calls continued running server-side and blocked later calls.

Independent in-app Playwright checks showed:

- `/pricing`: `document.readyState="complete"`, correct h1, 45 controls, no horizontal overflow, immediate DOM response.
- `/admin`: after the normal loading state, the unauthenticated RoleSharp Admin form appeared with username, password, authenticator code, and submit action; no console errors and no horizontal overflow.

Therefore the stalls are MCP cancellation/serialization defects, not confirmed RoleSharp main-thread freezes. Mobile DOM assertions for `/pricing` and `/admin` remain an evidence gap, not a product finding.

## Confirmed live product bugs

No new reproducible frontend runtime bug was confirmed in these public/unauthenticated critical flows.

The live UI pass does not cover authenticated dashboards, real resume upload/generation, payments, destructive admin actions, or account creation because the audit was intentionally read-only.
