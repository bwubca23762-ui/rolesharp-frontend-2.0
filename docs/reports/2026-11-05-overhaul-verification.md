# RoleSharp overhaul verification — 2026-11-05

## Release state

This report records the verified release candidate and its testing boundaries.
Deployment activation and source commit are recorded on the VPS in
`data/deploy-evidence/<release>`, `.release-metadata.json`, and `current-release`.
The previous production release was `d3afb8a`; all five checked web/worker
services were healthy before deployment preparation.

## Repairs in this checkpoint

- Fixed the shared admin Button's link composition. Optional icons and shortcuts
  had made Radix Slot reject the children and crash `/admin/flags`.
- Replaced Fragment-based breadcrumb composition with Slot, preserving link
  styling and eliminating recurring invalid-prop warnings.
- Added an authenticated communications outbox inspector with status filtering,
  exact-email suppression lookup, saved-campaign audience estimates, and recovery
  of at most 100 expired claims per action. Recovery excludes all provider attempts,
  failed/unknown outcomes, and live leases; it is audited transactionally.
- Preserved dirty communications, notification, legal, and settings forms on
  refresh. Failed confirmation actions stay open for retry. Campaign operations
  cannot silently publish unsaved email content.
- Kept support reply drafts attached to their ticket and ignored stale thread
  responses when operators switch tickets. Added an accessible reply-field label.
- Added split-view internship review, accurately labeled social attestation and
  profile links, and safer shared fetch handling across remaining admin views.
- Fixed analytics CSV SQL aliases and added six labeled overview sparklines.
  Current premium/verified/open-ticket cohorts are labeled by creation date rather
  than presented as historical transitions.
- Displayed Razorpay paid invoice totals separately by currency. Paise conversion
  happens once; failed, refunded, and merely created orders are excluded.
  Existing crypto totals are labeled as crypto USD totals, not all-provider revenue.
- Rejected malformed admin request bodies and invalid blog dates/campaign IDs.
  Premium and verification actions require explicit supported action names.
  Missing or incomplete settings payloads cannot reset platform allowances.
- Made feature-flag updates and their single staff-attributed audit record atomic.
- Added persisted percentage rollouts for the four job workflow flags. Stable
  account cohorts are enforced at match, package, digest, and provider boundaries;
  master switches, environment gates, permissions, and caps still apply. Global
  maintenance, signup, and OAuth switches remain binary.
- Added staff approval/rejection for social claims, with reasons and status
  filtering. New claims default to pending and earn no credits or trial eligibility
  before approval. Existing awards stay approved. Concurrent approval awards once;
  rejection and replay cannot award credits. Configuration updates and review
  actions have transactional staff-attributed audit entries.
- Fixed builder preview scaling at 1280px and 1366px, stable paper wrapping while
  zooming, A4-height preview space, paper contrast in dark mode, and active zoom
  contrast while hovered.
- Added shared typography tokens, provider-key comparison rendering, and removed
  the unused duplicate `app/compat/admin-workflows.css` stylesheet. The imported
  admin workflow stylesheet remains in place.
- Updated vulnerable transitive audit/lint tooling through constrained overrides:
  brace-expansion 5.0.12, js-yaml 5.5.0, affected minimatch 11.0.4, and
  puppeteer-core 25.16.0. The older minimatch 3 consumers retain their API.

## Verification

| Check | Result |
| --- | --- |
| TypeScript and ESLint | Passed |
| Production build | Passed |
| Node test suite with local PostgreSQL checks enabled | 682 passed; no failures or skips |
| Database integrity harness on a newly created disposable local database | Passed, including all ordered migrations |
| Admin write smoke, development and production builds | 63 HTTP assertions passed in each run |
| Expanded admin write smoke against real local PostgreSQL | 79 HTTP assertions passed, including transactional configuration audit, concurrent review and public pending claims |
| Workflow rollout database test | Stable, monotonic cohorts; 0%, 25%, 75%, 100%, disabled/unknown/null guards passed |
| New browser flows | Rollout confirmation/persistence; reward approval and pending filter; no page overflow at 1280px |
| Authenticated admin GET boundaries | 41 checked; no unexpected results |
| Catalogue page route check | 28/28 HTTP 200 |
| Desktop admin rendering at 1440px | 27/27 without render errors or page overflow after repair |
| Production-build admin rendering at 375px | 27/27 without render errors or page overflow |
| Sidebar expanded/collapsed at 1280px | No page overflow |
| Builder at 1280px / 1366px | Stable paper layout and live name update; zoom changes scale without reflow |
| Manual maker mobile preview at 375px | Drawer opened correctly; no page overflow |
| Production dev-confirm endpoint | HTTP 404 with a valid same-origin request |
| `/overview` | HTTP 307 to `/dashboard` |
| Full dependency audit | 0 vulnerabilities after remediation; 17 before remediation |
| Credential literal check of tracked diff additions | No private key or Razorpay credential literals found |
| Live Razorpay order creation | Created INR order for 99,900 paise (₹999); yearly configuration 649,900 paise (₹6,499); no charge |
| One authorized email to support@rolesharp.com | Submitted once through production transport; provider reported queued |

The GET boundary checks correctly returned local infrastructure-unavailable
responses for the privileged backup/service bridge and Redis rate-limit inspector.
Those facilities are not installed in the disposable Mac test environment.
Missing-ID endpoints returned their expected 400 responses. Unauthorized and
cross-origin inspector requests were rejected; invalid filters returned 400.

The write smoke checks used synthetic local accounts and an attributed local
staff session. They verified credit ledgers, permission grants, support status
changes, report moderation/deletion, settings, flag restoration/audit counts,
legal and offer immutability, student release/reclaim behavior, protection of paid
plans, notices, communications state transitions, and staff-role controls.
No recipients were admitted and no provider sending was enabled.

The database tests verify that recovery preserves sending, failed, unknown,
provider-accepted, and already-attempted records. They also verify INR and USD
accounting separately, including ₹999 from 99,900 paise.

## Evidence and repeatable commands

Local evidence is kept under `.omo/evidence/2026-11-05-admin-overhaul/` (Git ignored).
It includes API/layout results, test/build logs, before/after dependency audits,
and screenshots. The test database is disposable; production data was not copied.

```sh
npm run check
npm run build
ROLESHARP_TEST_DATABASE_URL=postgresql://localhost/YOUR_DISPOSABLE_DATABASE npm test
npm audit
```

`scripts/admin-write-smoke.mjs` requires a loopback server and an explicitly
named disposable QA database. It proves that the server reads its exact fixture
before executing writes. Do not run it against production.

## Verification limits

- No live Razorpay charge/capture was performed. Successful live order creation
  does not prove capture or webhook delivery. The single authorized email was
  queued; no independent inbox delivery confirmation is available.
- The browser sweep verifies rendering and targeted flows, not every possible
  record/state combination or the quality of every external AI response.
- Lighthouse was not executed in this pass. The Mac uses Node 22.18.0, below
  the existing Lighthouse requirement of Node 22.19 or later. The updated audit
  libraries import, and the application check/build gates pass.
- Social profile links and attestation are not proof of following. Staff review
  is an application moderation decision, not social-provider verification.
- `/admin/campaigns` and `/admin/auto-mail` manage the existing jobs/application
  pipeline. Email content, preview, estimates, and scheduling belong under
  Communications. Mailbox expiry/quota values not stored by the application were
  not invented for display.

Production application-provider sending remains disabled. The deployment pauses
job workflows for migration and restores the pre-existing Daily Matches setting
only after release verification. Queued mail is not labeled confirmed inbox delivery.
