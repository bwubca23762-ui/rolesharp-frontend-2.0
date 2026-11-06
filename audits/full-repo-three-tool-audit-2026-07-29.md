# RoleSharp three-tool audit

Date: 2026-07-29

Scope: local RoleSharp source, production deployment layout, and `https://rolesharp.com`

Mode: read-only audit; no product source or production data was changed

## Tools actually run

### LazyCodex 4.19.3

- Installed from the official `code-yeongyu/lazycodex` Codex marketplace as `omo@sisyphuslabs`.
- Ran the `init-deep` discovery/scoring workflow in read-only mode.
- Three independent explorer passes mapped architecture, build/test conventions, and high-confidence runtime bugs.
- Inventory: 441 project files; 368 TypeScript/JavaScript/Python files; 36,079 code lines; 73 pages; 86 API route files; 28 SQL migrations.
- The harness did not generate `AGENTS.md` because this directory incorrectly resolves Git to `C:\Users\hyper`, not to a RoleSharp repository. Auto-writing within that boundary would be unsafe.

### Ultimate Bug Scanner

- Cloned `Dicklesworthstone/ultimate_bug_scanner`.
- `ubs doctor --fix` completed and installed its pinned ast-grep 0.40.1 runtime.
- Full JavaScript/TypeScript and Python scan ran with auto-update disabled and module timeouts enabled.
- Raw output: `audits/rolesharp-ubs-console.txt`.
- UBS headline: 60 critical, 729 warning. Manual source validation found the headline heavily inflated by rule false positives:
  - 843 standalone JSX components were incorrectly labelled “list item missing key”.
  - ordinary `===` comparisons were labelled secret comparisons.
  - `credentials: "same-origin"` was labelled a hardcoded credential.
  - server-only environment access was labelled client-side secret access.
  - `value == null` was labelled critical although it intentionally matches both `null` and `undefined`.
- The development HMAC fallback in `lib/student.ts:110` is a real defense-in-depth concern, but production currently has `AUTH_SECRET` set. The deploy preflight still fails to require it explicitly.

### Microsoft Playwright MCP

- Installed the official `@playwright/mcp@latest` server in Codex.
- Configured isolated, headless Google Chrome with bounded navigation and action timeouts.
- Live desktop/mobile route and interaction results are recorded in the Playwright section below.

## Confirmed findings

### P0 — A private SSH key is deployed and readable by the web service account

Evidence:

- Local artifact: `CUsershyper/.ssh/vps_freellmapi`, 419 bytes. Key contents were not opened.
- `deploy.sh:36-40` excludes `.env`, `.git`, `node_modules`, and build caches, but does not exclude nested `.ssh` paths or the malformed drive-path directory.
- Production contains `/opt/resume-ai/C:Usershyper/.ssh/vps_freellmapi`.
- Production permissions are `0777 root:root`.
- A read-only check confirmed `rolesharp` can read it: `SERVICE_ACCOUNT_CAN_READ_KEY=yes`.

Impact: compromise of the web process can expose a root-capable SSH credential. The key is also likely copied into backups and deployment snapshots.

Required response:

1. Rotate/revoke the affected SSH key immediately.
2. Remove both local and VPS copies after confirming the exact target.
3. Add deployment exclusions for `.ssh`, private-key patterns, malformed drive-path artifacts, audit outputs, and other non-application files.
4. Replace “sync the entire working directory” with an explicit deployment manifest or immutable release artifact.
5. Search VPS backups and CI/deployment caches for the exposed key without printing its contents.

### P1 — Deployment is non-atomic and can destroy the currently runnable build

Evidence: `deploy.sh:35-67`.

- `rsync --delete` mutates `/opt/resume-ai` in place.
- Database migrations run before application build verification.
- Remote install uses `npm install`, not lockfile-strict `npm ci`.
- `.next` is deleted before `npm run build`.
- There is no release directory, atomic symlink switch, rollback path, or compatibility/rollback migration strategy.

Impact: a failed install or build can leave production without `.next`; a migration/build mismatch can make rollback impossible.

### P1 — RoleSharp is not a standalone Git repository

`git rev-parse --show-toplevel` resolves to `C:\Users\hyper`. Git status from the RoleSharp directory exposes unrelated home-directory state and reports unrelated deletions/untracked personal files.

Impact: accidental commits, resets, cleans, diffs, or automation can operate on the whole user profile. CI/history/branch state for RoleSharp cannot be trusted from this snapshot.

### P2 — Account deletion can race a queued resume job and recreate deleted PII

Evidence:

- `app/api/generate/route.ts:172-191`
- `worker/index.ts:85-114`
- `lib/db.ts:34-48`
- `lib/db/resumes.ts:34-61`

Account deletion removes PostgreSQL rows but not BullMQ jobs. Queue jobs retain the full request/profile, and `resumes.user_id_text` has no foreign key. A queued or retried job can save an orphaned resume after deletion.

### P2 — Two concurrent same-plan invoices can collapse into one entitlement

Evidence:

- `app/api/pay/crypto/create/route.ts:34-48`
- `db/migrations/004_crypto.sql:3-13`
- `app/api/pay/crypto/webhook/route.ts:21-23,48-61`

`order_id` uses `Date.now()` and has only a non-unique index. Same-millisecond invoice requests can share an order ID; the webhook grants once by order ID and marks all matching rows granted.

### P2 — A credit can be permanently spent before queue insertion succeeds

Evidence: `app/api/generate/route.ts:115-127,172-192`.

The credit debit commits before `resumeQueue.add`. A queue failure or process crash leaves no job and no worker-driven refund.

### P2 — Refund idempotency can record a refund without restoring the credit

Evidence: `worker/index.ts:48-59,142-169`.

The refund event insert and user balance update are separate pool queries. If the insert succeeds and the balance update fails, retry sees the unique event and skips the balance change permanently.

### P2 — Student activation can be consumed before Premium is granted

Evidence:

- `lib/student.ts:90-105`
- `app/api/student/confirm/route.ts:17-32`

Token consumption, claim insertion, and entitlement grant are three independent commits. A failure between them makes normal retry impossible.

### P2 — No enforced pre-deploy quality gate

- No project-local CI workflow exists in this snapshot.
- `npm run check` excludes tests, build, route audit, CSS audit, benchmarks, and dependency audit.
- `deploy.sh` does not run typecheck, lint, or tests before touching production.
- Current local `node_modules` is empty, so `typecheck`, `lint`, `test`, and `build` cannot start.
- `npm run test:seo` is Windows-incompatible because it uses a POSIX inline environment assignment.

### P2 — Behavioral coverage is too shallow for the product surface

- 88 test declarations across 8 files.
- 54/88 tests read source and assert text/regex instead of exercising behavior.
- No test imports an API route handler.
- No disposable Postgres/Redis migration or transaction test.
- No worker tests and no Python JobSpy tests.
- No committed Playwright/component/accessibility test suite.
- `scripts/audit-routes.mjs` sends GET for every handler and treats most 4xx responses as passing.

### P3 — Complexity and documentation debt

- Hotspots: `app/build/page.tsx` (828 lines), `app/page.tsx` (733), `app/admin/admin-panel.tsx` (660), `app/settings/page.tsx` (580), `lib/tailor.ts` (524), `app/api/admin/analytics/route.ts` (515).
- `DOCS.md` is stale about generation behavior, job markets, and PM2 versus systemd.
- `.env.example` omits production-required `AUTH_SECRET` and many other used variables.
- CSS audit passes, but `app/globals-compat.css` is 238,010 bytes against a 240,000-byte budget: less than 1% headroom.

## Playwright MCP live-site findings

- Tested `/`, `/build`, `/resume-fixer`, `/checker`, `/jobs`, `/pricing`, `/login`, and `/admin`.
- Tested both 1440×900 and 390×844 on the homepage, builder, fixer, checker, jobs, and login.
- Products and Resources hover menus work.
- Theme state changes correctly.
- Primary CTAs point to `/build` and `/resume-fixer`.
- `/jobs` visibly exposes `aria-current="page"` and `rs-nav-link is-active`.
- No horizontal overflow was found on completed desktop/mobile checks.
- Console checks returned zero errors and warnings.
- No failed application network request was found; the only redirect was Cloudflare’s expected challenge script.
- `/checker` file input was initially flagged as unnamed by a naive DOM query, but source validation showed it is nested in a visible label; this is not a product defect.
- MCP DOM evaluation stalled on `/pricing` and unauthenticated `/admin` after successful navigation. Independent in-app Playwright checks confirmed both pages were responsive, overflow-free, and error-free; this is a Playwright MCP cancellation/serialization defect. Mobile pricing/admin DOM assertions remain an evidence gap.
- No new reproducible frontend runtime bug was confirmed in the public/unauthenticated flows.

## What passed

- No request-derived raw SQL construction was confirmed by UBS.
- No missing admin authorization guard was found among current admin API routes.
- Payment entitlement granting now has an atomic `premium_granted_at` marker.
- Production `AUTH_SECRET` is set.
- Nginx limits request bodies to 5 MB, reducing UBS’s unbounded-body warning severity for public production traffic.
- TypeScript strict mode, Next core-web-vitals lint presets, security headers, deployment health checks, k6 thresholds, and source-level regression contracts are useful foundations.

## Recommended fix order

1. Rotate and remove the exposed SSH key; block sensitive/unexpected paths from deployment.
2. Put RoleSharp in its own Git repository and verify a clean tracked baseline.
3. Replace in-place deploys with immutable releases, pre-cutover build/test, atomic switch, and rollback.
4. Make queue/credit/refund/student operations transactional or compensating and idempotent.
5. Bind account deletion to queue cancellation/purge and worker-side user existence checks.
6. Use collision-resistant unique payment order IDs and enforce uniqueness in PostgreSQL.
7. Add CI with pinned Node, `npm ci`, typecheck, lint, all tests, production build, and dependency audit.
8. Add request-level API tests, disposable DB/Redis migration tests, worker/Python tests, and repeatable Playwright critical flows.
9. Repair cross-platform scripts, route-audit semantics, environment schema/documentation, and large-module boundaries.

## Remediation completed — 2026-07-29

- Rotated the VPS deploy key, verified the replacement before revocation, removed
  the old authorized key, and deleted every confirmed local/remote copy. The old
  key now fails authentication and the replacement succeeds.
- Added credential exclusions to deployment and Git ignore rules. A post-deploy
  filename scan found zero `vps_freellmapi` files under the application or SSH
  directories.
- Initialized a project-local Git boundary on
  `codex/remediation-2026-07-29`. The supplied GitHub repository returns 404 to
  both anonymous Git and the connected GitHub account, so no upstream history
  was fetched and no commit or push was attempted.
- Replaced in-place deployment with isolated immutable releases, `npm ci`,
  build-before-migration, atomic `current` symlink activation, automatic health
  rollback, and systemd services pinned to the active release.
- Moved generation-credit spending into the worker after successful enqueue,
  made spend/refund operations idempotent and single-statement atomic, removed
  completed/failed BullMQ records immediately, and compensates failed queue
  admission by releasing the quota reservation.
- Serialized resume persistence against account deletion and added queue
  cancellation/sanitization so deleted accounts cannot be recreated by a late
  worker.
- Added UUID payment order IDs plus database uniqueness constraints.
- Made student token consumption, lifetime claim, Premium grant, profile update,
  and audit event one transaction.
- Added CI with pinned Node, clean install, Postgres/pgvector, Redis, strict
  typecheck, lint, all tests, dependency audit, production build, and runtime
  route exercising.
- Replaced the GET-only route audit with method-aware checks. The offline audit
  exercised 73 pages and all 115 exported API methods with zero failures; the
  production-safe audit checked 73 pages, 95 handler boundaries, and 424
  discovered internal links with zero failures.
- Added a disposable-database integrity test that applies the full schema and
  migration chain, then verifies concurrent credit spend/refund, atomic student
  activation, account-deletion/worker serialization, and payment-order
  uniqueness. It passed four consecutive runs, including one from the final
  deployed release.
- Final release `20260729062948-500` is active. Web, worker, jobs, and nginx are
  active; the worker is self-contained in the release with zero restarts; the
  two integrity indexes exist; production has zero duplicate order IDs and zero
  orphan resumes; admin login/session both returned HTTP 200; recent web/worker
  error journals are empty; and the database backup is non-empty.

Remaining items are engineering enhancements rather than confirmed live
defects: commit/push once the correct GitHub repository access is restored,
expand repeatable Playwright coverage to authenticated journeys, add isolated
Python JobSpy tests, and continue splitting the largest UI/analytics modules as
features change.
