# RoleSharp readiness and activation report

**Assessment date:** 2026-08-06  
**Repository:** `D:\CodexWork\rolesharp`  
**Branch:** `codex/remediation-2026-07-29` (ahead of its tracked remote by one commit at assessment time)  
**Source revision:** `a5e284707fb7` plus a large, intentionally uncommitted remediation worktree  
**Decision:** **Repository implementation is locally validated; production activation is DENIED until the external and operational gates in this report are completed.**

## 1. Executive status

The implementation milestones requested in this remediation pass are complete in the working tree:

1. Immutable, version-pinned student offers.
2. In-app notifications with immutable publication versions and user state.
3. Consent-aware communications outbox with durable attempts and an irreversible provider boundary.
4. Truthful Admin analytics, corrected Admin modules, and bounded aggregate CSV export.
5. Auto Apply and connected-mailbox readiness with posting-backed recipients, immutable approved packages, current legal acceptance, per-user feature grants, send-only provider scopes, quotas, idempotency, and unknown-outcome handling.
6. Repository quality and security gates.

The code is **not authorization to deploy or send**. No production migration, deployment, provider OAuth exchange, email delivery, application submission, feature enablement, commit, or push was performed during this finalization.

## 2. Local validation evidence

### Passing final gates

- Production-style Next.js build with isolated QA configuration: **passed**; 212 static pages generated.
- TypeScript typecheck: **passed**.
- ESLint: **passed**.
- Full source regression suite: **189/189 passed**.
- Production dependency audit: **0 vulnerabilities**.
- Git whitespace integrity: **passed** (`git diff --check`), with informational pre-existing LF-to-CRLF warnings only.
- Previously completed focused gates in this remediation session included security, frontend, SEO, performance, internship-report, Jobs release/gate, route, search, UI, CSS, and disposable database checks. Where a release-host artifact or live external service was required, the result is classified below as **not run**, not inferred as passed.

### Final defects corrected during validation

- `robots.txt` now derives a safe public sitemap origin without publishing an unrelated configured host in isolated QA.
- The Jobs sitemap includes configured market hubs in database-disabled local QA while retaining data-backed filtering when a database is available; the corresponding SEO contract test was updated to assert this explicit fail-safe branch.

## 3. Completed capability boundaries

### Immutable offers

- Student offer terms are represented by immutable versions with effective dates, enrollment windows, content digests, and bounded validated terms.
- Student tokens, claims, and grants pin the exact offer version rather than reading mutable current copy after issuance.
- Admin publication replaces mutation of historical terms.

### In-app notifications

- Publications use immutable versions, explicit audiences, surfaces, severity, materiality, effective/expiry dates, and preference categories.
- Fan-out is lazy and bounded; per-user read, dismiss, and archive state is private.
- User preference changes are explicit and do not rewrite historical publications.

### Communications

- Campaign versions, recipients, attempts, consent snapshots, suppressions, throttles, and unsubscribe behavior are durable.
- Runtime control defaults to `transport_mode='disabled'` and `globally_paused=true`.
- The local sink is separately gated, requires an absolute directory, and records hashes/sizes instead of message bodies or credentials.
- A provider boundary is recorded before delivery. Ambiguous failures become `unknown`; they are not silently resent.
- Account deletion suppresses/cancels pre-boundary work and clears retained recipient email while preserving non-reversible evidence.

### Admin analytics and modules

- Metric definitions, sources, units, UTC range semantics, generated-at time, and unavailable states are explicit.
- Fixed-duration invoice value is not mislabeled as MRR or ARR.
- Queue metrics report unavailable when Redis cannot be queried rather than displaying false zeroes.
- Overview data is minimized, and aggregate CSV export is bounded and formula-safe.
- Offers, notifications, communications, feature access, legal versions, and staff controls have explicit Admin workspaces and audited mutation boundaries.

### Auto Apply and mailboxes

- Package creation requires an immutable job snapshot, source URL/body hash, posting-backed explicit email instruction, deterministic recipient provenance, exact legal version snapshot, and approved package state.
- Provider invocation revalidates the package, current legal acceptance, active user, active connection, global persisted flags, and active per-user grants in the database transaction immediately before the provider boundary.
- Gmail and Microsoft connection flows use separate OAuth applications, PKCE S256, nonce/state binding, exact callback allowlists, verified identities, dedicated token encryption keys, bounded provider requests, and send-only scopes.
- The application daily hard cap, package approval, connection generation, idempotency, attempt ordinals, immutable attachment bytes, durable quotas, and explicit terminal `unknown` outcome remain enforced.
- Recommendation and Auto Apply agents own disjoint queues and use bounded graceful drains.

## 4. Switches that must remain disabled

Keep all of the following disabled until the relevant activation gate is explicitly approved:

### Environment controls

```text
JOBS_WORKFLOWS_ENABLED=false
ROLE_APPLY_GMAIL_SEND_ENABLED=false
ROLE_APPLY_MICROSOFT_SEND_ENABLED=false
JOBS_SMOKE_MODE=false
MAIL_ADAPTER=
NOTIFICATION_TRANSPORT=
```

Do not set `MAIL_ADAPTER=fake` or `NOTIFICATION_TRANSPORT=local_sink` in production.

### Persisted feature flags

```text
jobs_daily_matches=false
role_apply_prepare=false
role_apply_gmail_send=false
role_apply_microsoft_send=false
```

### Communications runtime control

```text
transport_mode=disabled
globally_paused=true
```

### Per-user feature access

No mailbox authorization or automated package preparation/sending should be granted until the exact user is approved for the corresponding feature key. A global flag alone is insufficient.

## 5. External and operational blockers — not run

These gates require production credentials, production infrastructure, live providers, or explicit operational authority. They were intentionally not run:

1. Apply and verify migrations `038`–`051` on the production database, including a second no-op replay and recorded schema digest.
2. Generate and verify release-host artifacts: `.release-manifest.sha256`, `.release-schema.sha256`, `.release-metadata.json`, and `.release-database-schema.digest`.
3. Create a verified pre-migration backup, encrypted off-host copy, and documented restore drill.
4. Configure separate production Gmail and Microsoft mailbox-connection OAuth applications and exact HTTPS callback URIs.
5. Verify live Gmail and Microsoft consent, identity, token refresh, send-only scopes, revocation/disconnection behavior, and provider rejection/ambiguous outcome handling using approved test accounts.
6. Verify the real transactional notification/email provider and domain authentication; no real communication was sent.
7. Verify the new production systemd units, least-privilege service users, queue namespace/prefix, health endpoints, logs, monitoring, and alert thresholds.
8. Verify Cloudflare-only origin access or an approved tunnel, SSH hardening, pending OS security updates, firewall state, and post-change access.
9. Verify NOWPayments and any other production integration using authorized test transactions.
10. Run a fresh isolated Jobs smoke and production-flags-off release verification inside the actual release host, retaining only redacted evidence.
11. Execute the staged canary. It requires separate authorization and must not be inferred from repository validation.

## 6. Safe activation sequence

### Phase A — prepare without enabling capability

1. Freeze and review the exact source revision/worktree to be released. Do not deploy an unreviewed dirty tree.
2. Create and verify the local database backup, encrypted off-host copy, and restore procedure.
3. Generate the release manifest and schema metadata from the exact release directory.
4. Confirm production environment values, dedicated mailbox token key ring, callback origins, namespace `production`, queue prefix `rolesharp:prod:`, and all environment switches disabled.
5. Confirm the four persisted Jobs flags exist and are disabled; record their hashes.
6. Run `verify:jobs:release -- --production-flags-off` from the release directory.
7. Apply migrations in lexical order with `ON_ERROR_STOP=1`, replay them to prove idempotency, and confirm the database schema digest matches the release record.
8. Start/restart the web process, existing resume worker, job ingestor, Recommendation Agent, Auto-Apply Agent, communications process schedule, and blog worker with capabilities still disabled.
9. Verify public health and authenticated Admin readiness. Confirm the workflow agents make zero claims/provider calls while flags are off.
10. Run a fresh isolated synthetic smoke with `.test` identities and fake/local sinks in a unique non-production namespace, then verify complete cleanup.

### Phase B — validate provider connections without enabling sends

1. Approve one internal user for the exact mailbox feature.
2. Complete Gmail or Microsoft OAuth using the dedicated production app; verify send-only scopes, sender identity, encryption key version, and disconnect/revocation behavior.
3. Keep `role_apply_prepare`, provider send flags, and communications delivery disabled.
4. Confirm current legal versions are published and the internal user has accepted every required current material version.

### Phase C — separately authorized canary

1. Enable only the minimum required path for one internal user: per-user grant first, then `role_apply_prepare`, then exactly one provider-specific send flag.
2. Require review of every immutable package and use only a posting-backed explicit email recipient.
3. Observe provider-boundary receipts, attempt ordinals, daily cap, queue age, unknown outcomes, and audit events.
4. Advance only through `one internal user → 1% → 5% → 25% → 100%`, with at least 24 hours and 100 attempts per stage, or seven days at lower volume.
5. Do not combine communications activation with Auto Apply activation. Unpause and select the communications provider in a separately reviewed canary after consent, suppression, unsubscribe, provider, and rate-limit checks pass.

## 7. Abort criteria

Immediately disable affected and global flags for any:

- duplicate provider call or duplicate application;
- cross-user access or recipient/package mismatch;
- credential, recipient, body, resume, or attachment leakage;
- hard-rule application or non-posting-backed recipient;
- unexplained provider call;
- queue namespace mismatch;
- security/accessibility regression;
- unknown outcome rate above 0.5%;
- provider error rate above 5% for 15 minutes;
- queue age above 10 minutes.

## 8. Forward-fix and rollback

1. Disable all four Jobs persisted flags and all relevant environment switches. Pause/disable communications runtime control.
2. Stop the Recommendation Agent first, then the Auto-Apply Agent, allowing their bounded drain.
3. Treat rows that crossed `provider_call_started_at` as terminal `unknown`; never retry them automatically.
4. Cancel only pre-boundary queued/reserved work. Reconciliation may repair projections, never create a second provider call.
5. Repoint the release symlink to the prior build only if it is compatible with the expanded schema.
6. Retain expand-only migrations. Do not perform a destructive production schema downgrade or restore merely to roll back application code.
7. Restart the web process and unaffected workers, verify both health surfaces, and prove disabled workers make zero claims/provider calls.
8. Preserve only redacted hashes, timestamps, ordinals, flag snapshots, build/schema identifiers, and provider status classes. Never copy tokens, recipients, bodies, or resume bytes into tickets or chat.

## 9. Remaining non-feature operations

The older VPS hardening checklist still has explicit manual work: encrypted off-host backup/restore, SSH password/root-login lockdown after alternate-access validation, origin restriction, OS updates/reboot if required, and complete post-change verification. These remain production risks independent of the new feature implementation.

## 10. Final verdict

- **Code readiness:** APPROVE for controlled review and release preparation.
- **Migration readiness:** APPROVE only for the guarded backup/manifest/replay procedure; not yet executed on production.
- **Provider readiness:** DENY until live OAuth/email/provider gates are run with authorized test accounts.
- **Production feature activation:** DENY. All send/workflow switches must remain disabled.
- **Canary eligibility:** DENY until every blocker in section 5 that applies to the selected capability has current redacted evidence and an explicit approval record.
