# Admin verification — 3 November 2026

## Result and scope

All 27 registered admin pages loaded on the live deployment at desktop and mobile sizes. Each returned HTTP 200, displayed its heading, and had no captured JavaScript page errors, failed admin API requests, or horizontal document overflow. This verifies page loading and read operations, not every business action.

Authenticated production checks used normal login. Browser requests were restricted to GET/HEAD after authentication; no production sends, account changes, publications, refunds, deletes, service restarts or backups were triggered.

38 top-level live GET endpoints were inspected: 36 returned 200; user-detail and resume-detail correctly returned 400 without required IDs. Follow-up requests with existing user, resume and support IDs all returned 200. Evidence records status and response shapes, not account records or authentication secrets.

## Local fixes

- Pricing now handles failed/malformed API responses with an explicit error and retry instead of a crash or indefinite loading.
- Job ingestion and rate-limit panels check HTTP errors and recover on retry.
- Log viewer checks HTTP errors, keys requests by service, and cancels obsolete requests when switching services.
- Integration health reports a failed read instead of presenting an error response as unconfigured providers; retry and global refresh reload it.

Affected files: `app/admin/views/pricing-view.tsx`, `app/admin/views/system-view.tsx`, `app/admin/panels/job-ingestion-panel.tsx`, `app/admin/panels/rate-limit-panel.tsx`, `app/admin/panels/log-viewer.tsx`.

Regression coverage is in `tests/e2e/account-admin-workspaces.spec.ts`. Earlier pending feature-access and user-ID changes remain part of the checkout, documented in `REPAIR-STATUS-2026-11-02.md`.

## Live page inventory

| Route | Visible heading | Desktop / mobile reads |
| --- | --- | --- |
| `/admin` | Business overview | Pass |
| `/admin/analytics` | Operational analytics | Pass |
| `/admin/users` | Users | Pass |
| `/admin/students` | Student Offer | Pass |
| `/admin/staff` | Staff access | Pass |
| `/admin/feature-access` | Workflow access | Pass |
| `/admin/jobs` | Job Listings | Pass |
| `/admin/workflows` | Workflow operations | Pass |
| `/admin/internship-reports` | Internship reports | Pass |
| `/admin/offers` | Offers | Pass |
| `/admin/resumes` | Resumes | Pass |
| `/admin/campaigns` | Campaigns | Pass |
| `/admin/auto-mail` | Auto Mail | Pass |
| `/admin/blog` | Blog generator | Pass |
| `/admin/notifications` | In-app notifications | Pass |
| `/admin/communications` | Communications | Pass |
| `/admin/emails` | Email Log | Pass |
| `/admin/payments` | Payments | Pass |
| `/admin/pricing-config` | Pricing Plans | Pass |
| `/admin/flags` | Feature Flags | Pass |
| `/admin/actions` | Admin actions | Pass |
| `/admin/legal` | Legal documents | Pass |
| `/admin/system` | System & Process | Pass |
| `/admin/settings` | Settings | Pass |
| `/admin/mail-connections` | Mail Connections | Pass |
| `/admin/customer-care` | Customer care desk | Pass |
| `/admin/support` | Support queue | Pass |

## Automated verification

- All 664 unit tests pass.
- All 28 account/admin browser tests pass in one complete run (4.2 minutes).
- 38 protected GET endpoints and 30 mutation method/route combinations reject anonymous requests with HTTP 403. Mutation requests use a valid same-origin header; action-based routes receive valid action payloads so the tests reach authorization rather than only input validation.
- TypeScript and ESLint pass; production build passes after the five admin fixes.
- All 27 admin page permission gates deny staff who lack the relevant permission.
- Pricing and system-panel tests simulate failed reads and confirm successful retry recovery.

## Evidence and limits

Sanitized live evidence: `.omo/evidence/admin-full/live-readonly.json`, `live-mobile.json`, `live-api-readonly.json`, `live-details.json`.

Local browser tests use mocked authenticated data for action dialogs, errors and permission visibility. Anonymous API tests exercise actual local handlers; the local environment uses the rate limiter's fallback when Redis is unavailable. These are distinct from database-backed, authorized write tests. Staff recovery-session restrictions are intentional: staff management requires an owner staff session.

Authorized production mutation paths, external delivery, payment processing, and all combinations of staff roles and data states have not been exercised end to end. Successful read checks do not prove those operations work. Razorpay remains deferred.

Fixes are local and have not been committed, pushed or deployed. Production observations describe the existing release, not these pending fixes.


## Follow-up

`REMAINING-WORK-2026-11-03.md` records a subsequent 47-request test against a disposable database with all real migrations, plus fixes for offer digest failures, credit ledger accuracy, moderation attribution and recovery-session controls. It supersedes the earlier statement that only anonymous/local mocked handler tests were available; production mutations remain untested.
