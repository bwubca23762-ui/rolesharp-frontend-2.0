# RoleSharp Performance and Refactor TODO

Started: 27 July 2026

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed and verified
- `[!]` Blocked or requires production data

## Wave 0 — Baseline and safety

- [x] Record the current typecheck, lint, test, dependency-audit, route-audit, and production-build baseline in an ACL-safe clean build workspace. Direct installation inside the extracted source folder still stalls under the Windows shell ACL, but the verified dependency tree and deployed build are clean.
- [x] Add regression checks for the performance-sensitive behavior changed below.
- [x] Keep all source changes contained inside the extracted `rolesharp` project.

## Wave 1 — Immediate performance fixes

### CSS delivery

- [x] Disable Next.js experimental inline CSS.
- [x] Confirm the production build emits cacheable CSS assets.
- [x] Add a guard that prevents accidentally enabling full inline CSS again.
- [x] Add a repeatable `audit:css` inventory for `globals-compat.css` (302 candidates require route coverage before deletion).

### Session state

- [x] Add a shared session provider to the application shell.
- [x] Make navigation consume shared session state.
- [x] Make session expiry/visibility refresh use the shared provider.
- [x] Migrate all page-level `/api/me` consumers.
- [x] Verify source contains one `/api/me` request owner.

### Admin loading

- [x] Separate lightweight admin authentication from overview statistics.
- [x] Stop non-overview, non-payment, and non-resume admin routes from requesting full statistics.
- [x] Split admin views behind route-specific lazy boundaries.
- [x] Preserve admin authorization and error behavior.

### Autocomplete

- [x] Add request cancellation and stale-response protection.
- [x] Reuse one autocomplete hook for role and company lookup.
- [x] Add a small bounded server cache for repeated company searches.
- [x] Preserve rate limiting and country filtering.

## Wave 2 — Modularization

- [x] Extract shared resume education/project parsing.
- [ ] Extract the shared resume preview modal.
- [ ] Split the resume builder into state, persistence, autocomplete, generation, and view modules.
- [ ] Split settings sections into focused components.
- [x] Split `lib/db.ts` into core, companies, roles, resumes, applications, and support domains behind stable exports; the compatibility facade is now small.
- [~] Split tailoring normalization, evidence, scoring, prompts, repair, and orchestration. Provider-output normalization is separated.
- [ ] Split resume-checker parsing, scoring, and result assembly.
- [~] Extract confirmed shared page components without changing page output. Authentication gates and country display logic are shared.

## Wave 3 — Backend optimization

- [x] Consolidate public analytics summary queries.
- [x] Parallelize independent analytics queries.
- [x] Reduce admin overview query count and parallelize independent detail queries.
- [x] Return generation jobs asynchronously without holding requests for 90 seconds.
- [x] Preserve retry safety, referral credit behavior, and polling behavior.
- [!] Profile company alias search with production-like PostgreSQL data.
- [!] Benchmark LLM repair-pass changes against quality and evidence rules.

## Wave 4 — Verification and cleanup

- [x] Add dependency-free regression tests for CSS, sessions, admin loading/cache, async generation, autocomplete, shared parsing, country display, stable facades, accessibility, metadata, route recovery, and dependency remediation (87 passing).
- [ ] Add API tests for session, autocomplete, generation, payments, and admin authorization.
- [~] Add browser smoke coverage for critical public and authenticated flows. Production public-route smoke coverage is complete; repeatable authenticated browser automation remains.
- [~] Add CSS/page-weight/request-count guardrails. CSS growth is capped at 240 KB; per-route request budgets remain.
- [x] Run typecheck, lint, all tests, dependency audit, route audit, and production build.
- [x] Record completed work and production-only follow-ups.

## Platform-parity follow-ups

- [ ] Expand the ATS-safe template gallery without compromising parser reliability.
- [ ] Add a browser bookmarklet/extension that saves jobs from external boards into the existing tracker.
- [ ] Add repeatable authenticated end-to-end tests for resume creation, generation, export, jobs, tracker, billing, and support.
- [ ] Evaluate live interview coaching separately from the existing resume-aware preparation flow, including privacy and disclosure safeguards.
- [!] Keep mass auto-apply out of scope: it risks mismatched submissions and job-board terms violations.
