# RoleSharp senior code review and release-readiness report

**Review date:** 2026-08-02  
**Scope:** jobs recommendation and auto-apply workflows, database migrations, provider boundaries, queues/workers, UI gates, deployment/release wiring, security, and cleanup risk.

## Executive conclusion

The repository-level implementation is **conditionally release-ready with production workflow flags off**. All locally executable quality gates passed after fixes: TypeScript, ESLint, 163 unit/contract/security tests, destructive PostgreSQL integrity checks, Redis/BullMQ round trip, six Playwright workflow tests, desktop Lighthouse, mobile Lighthouse, production dependency audit, production build, shell syntax, and systemd unit syntax.

The release-host deployment was subsequently exercised on the VPS with production workflow flags off. The active release passed manifest and live-schema verification, retained pre-migration backup and isolated smoke evidence, served every audited route with HTTP 200, and kept all six production services active. A corrective release is being produced for the deployment-hygiene findings documented below. Real provider accounts, firewall/SSH changes, off-host backup encryption, and restore drills remain owner-operated gates and are not silently assumed successes.

## Confirmed fixes from this review

### 1. High: stale work-item owner could finish after lease expiry

**Location:** `lib/jobs-workflow/claims.ts`

`completeWorkItem` and the preflight in `failWorkItem` previously checked only `status='claimed'` and `lease_owner`. An old worker could complete or fail work after its lease expired but before a replacement claim changed ownership. That violated the lease boundary and could commit a result after ownership was lost.

**Fix:** both paths now require `lease_expires_at > now()`. A contract regression test verifies the live-lease predicates.

### 2. QA reliability: Lighthouse resolved Next.js from caller directory

**Location:** `scripts/run-lighthouse.mjs`

The runner used `resolve("node_modules/next/dist/bin/next")` and `process.cwd()`, so launching it from another workspace failed before the QA server started.

**Fix:** project root and Next.js CLI are resolved relative to `import.meta.url`; the spawned server uses the project root. Desktop Lighthouse then passed.

### 3. Database migration compatibility

**Locations:** `db/migrations/038_resume_package_deletion.sql`, `scripts/verify-db-integrity.ts`

The resume deletion migration now drops both legacy and current foreign-key names before installing the cascading key. The migration-043 fixture now respects the five-call admin cap. Full migration replay and destructive integrity testing passed.

### 4. Truthful five-per-day boundary

**Locations:** database migration 043, campaign/package contracts, UI, Playwright, documentation

Stale ten-item UI/test copy was corrected. A concurrent final-slot race proves exactly one winner, and the sixth provider invocation is blocked before network access.

### 5. Deployment provenance and artifact hygiene

**Locations:** `deploy.sh`, `scripts/verify-jobs-release.sh`, `tests/security-remediation.test.ts`

The first hardened release recorded the dirty working tree's base commit as `sourceSha` even though the deployed files were identified by a separate manifest, and it unintentionally included `.workbuddy-ai/` plus `outputs/`. The metadata also contained a misspelled legacy `maifestDigest` field. The deployment now records `sourceCommit` separately from the authoritative `sourceManifestDigest`; release verification recomputes and checks that digest. Deployment explicitly excludes `.workbuddy-ai/`, `outputs/`, every `.next*` build directory, and other non-runtime artifacts. Regression assertions cover these boundaries.

### 6. Job-ingestor restart drain

**Locations:** `scripts/job_ingestor.py`, `deploy/rolesharp-jobs.service`

VPS journal review showed a previous restart reached the 15-second stop timeout while the process was sleeping between polls. The poll/reconnect waits are now interruptible at one-second intervals, and the service stop allowance is 45 seconds. This prevents ordinary deploy restarts from requiring SIGKILL while preserving bounded shutdown.

## Architecture assessment

### Strong boundaries

- PostgreSQL is authoritative for workflow states, immutable package/approval records, invocation ordinals, daily counters, and ownership.
- Queue payloads are strict, versioned identifier-only messages; secrets and message bodies are not placed in Redis.
- Immediate enqueue failures are recoverable because durable rows are committed first and schedulers reconcile them.
- Queue ownership is disjoint between the two agents, and mailbox dispatch concurrency is one.
- Work-item claims use row locks, skip-locked selection, bounded retries, 90-second leases, 30-second heartbeats, and now live-lease completion/failure checks.
- Provider dispatch revalidates user, campaign, connection, package, approval, scores, recipient provenance, scopes, hashes, feature flags, and quota immediately before provider access.
- Unknown send outcomes are not automatically retried.
- Account and resume deletion serialize or cascade through workflow records.

### Residual architecture risks

- Live VPS inspection confirmed the new agents are enabled and active; release restart behavior is checked again as part of the corrective activation. Rollback intentionally retains expanded database schema, so old application releases must remain compatible with additive schema changes.
- Redis unavailability during DB-disabled Lighthouse produced expected local rate-limit fallback warnings. Production readiness still depends on monitored Redis availability.

## Security and reliability assessment

No unresolved critical or high application-code vulnerability was found after the stale-lease fix.

Validated controls include multi-tenant ownership joins, same-origin mutation checks, strict Zod payloads, OAuth PKCE/nonce and signed identity verification, send-only scopes, encrypted and row-bound refresh credentials, canonical callback origins, provider deadlines, immutable attachment hashing, fake-transport isolation, fail-closed flags, hardened service units, and zero production dependency vulnerabilities.

Remaining owner-operated risks:

- Direct origin HTTPS is not yet restricted to Cloudflare.
- Root SSH/password authentication remains enabled pending alternate-access validation.
- Pending OS security updates/reboot remain.
- Backups are not yet encrypted, off-host, and restore-tested.
- Real Gmail/Microsoft controlled-account sends were not run; isolated signed identity/refresh/send simulations passed.

## Validation evidence

| Gate | Result |
|---|---|
| TypeScript | Passed |
| ESLint | Passed |
| Unit/contract/security tests | 163 passed, 0 failed |
| PostgreSQL migration/integrity | Passed; schema SHA-256 `303fc66eae8ccabaff3aa76e485f23efdc247910b785e4e5b630bb50c996835c` |
| Redis/BullMQ | `PONG`; round trip passed |
| Playwright | 6 passed |
| Desktop Lighthouse | Passed all routes/budgets |
| Mobile Lighthouse | Passed all routes/budgets |
| Isolated Next.js production build | Passed; 200 static pages generated |
| Production dependency audit | 0 vulnerabilities |
| Deploy/smoke/release shell syntax | Passed |
| New systemd unit syntax | Passed |
| Active VPS release verification | Passed; production flags off and live schema digest matched |
| Public production routes | `/`, `/auto-apply`, `/daily-matches`, `/campaign-settings`, `/api/health`, `/robots.txt`, `/sitemap.xml`: HTTP 200 |
| Production services | Six active; zero failed units |
| Release evidence | Source manifests, pre-migration backup, release verification, and isolated smoke evidence present |

### Lighthouse medians

- Desktop: performance 1.00, accessibility 1.00, best practices 1.00; LCP 494–565 ms, TBT 0 ms, CLS 0–0.033.
- Mobile: performance 0.99, accessibility 1.00, best practices 1.00; LCP 1.85–2.00 s, TBT 56–74 ms, CLS 0–0.052.
- Private authenticated routes intentionally use `noindex`; their SEO score of 0.66 satisfies the explicit private-page SEO contract.

## Release decision and required external gates

**Repository decision:** approve a release candidate with `JOBS_WORKFLOWS_ENABLED=false`, `ROLE_APPLY_GMAIL_SEND_ENABLED=false`, and `ROLE_APPLY_MICROSOFT_SEND_ENABLED=false`.

Before enabling production workflows:

1. Keep the deployed source manifest, live-schema digest, pre-migration backup, and smoke evidence with each release.
2. Keep all workflow and provider feature flags disabled until credentialed provider validation is approved.
3. Use controlled Gmail and Microsoft accounts to validate real consent, sender identity, refresh rotation, and one non-production recipient per provider.
4. Complete Cloudflare-only origin restriction, SSH lockdown, OS updates, encrypted off-host backups, and restore drill under owner-approved runbooks.
5. Enable flags gradually with monitoring and a documented rollback trigger.

## Final verdict

- **Application code:** ready after the included fixes.
- **Local integration and UX gates:** passed.
- **Production website:** deployed and healthy with workflow/provider flags off; the corrective hygiene release must complete its final activation verification.
- **Workflow/provider enablement:** remains blocked only by credentialed-provider and owner-approved infrastructure operations.
- **Cleanup:** approved reproducible local build outputs were removed once, then regenerated by final validation; `.omo` evidence remains retained.
