# Security Review: resume-ai

> **Remediation update — 2026-07-11:** All 13 application findings in this
> report have been patched, migrated, deployed, and passed local/VPS build and
> smoke verification. The finding sections below preserve the original audit
> evidence. Remaining work is operational: Cloudflare-only origin firewall,
> SSH lockdown after alternate-access validation, OS updates, and encrypted
> off-host backup/restore testing. See `SECURITY-REMEDIATION-TODO.md`.

## Scope

Repository-wide security scan with live VPS audit. Typecheck, lint, and npm production dependency audit passed. Coverage is partial because ranking selected the highest-risk 30% of source-like rows.

- Scan mode: repository
- Target kind: git_worktree
- Target ID: codex-security-target/v1:sha256:b381908ebb2c2b2ae9148ef99a51d6f5c7328c8a779f1ed52fd512fa7f43b570
- Revision: 723bc11f7b758e6433c9a0ddb05efd167dc8ae25
- Snapshot digest: codex-security-snapshot/v1:sha256:b381908ebb2c2b2ae9148ef99a51d6f5c7328c8a779f1ed52fd512fa7f43b570
- Inventory strategy: repository
- Included paths: app/, lib/, db/, deploy/, deploy.sh, middleware.ts, worker/, scripts/
- Excluded paths: .next/, node_modules/, .local/, .beads/
- Runtime or test status: not recorded

Limitations and exclusions:
- Excluded .next/\*\*: Generated build output, reviewed indirectly through source and deployment behavior.
- Excluded node_modules/\*\*: Third-party vendored dependency tree; npm audit separately reports zero production advisories.
- Excluded .local/\*\*: Local development data, not production runtime.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 13 |
| Severity mix | high: 2, medium: 11 |
| Confidence mix | high: 3, medium: 10 |
| Coverage | partial |
| Validation mode | not recorded |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Public Next.js resume platform with authenticated user data, payments, LLM/document processing, admin control plane, and VPS deployment.

### Assets

- sessions
- resumes
- entitlements
- admin control
- provider secrets
- database integrity

### Trust Boundaries

- browser to web API
- Cloudflare/nginx to origin
- user to user data
- app to providers
- app to VPS services

### Attacker Capabilities

- anonymous HTTP requests
- authenticated user requests
- malformed uploads
- forged headers on direct origin

### Security Objectives

- tenant isolation
- payment integrity
- bounded resource use
- secret and host protection

### Assumptions

- Postgres and Redis remain loopback-only
- operator secrets are unique and rotated

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [A stale verification token can authenticate an account after its email changes](#finding-1) | high | high | inline below |
| [Unverified email changes can pre-link an account to another person’s Google identity](#finding-2) | high | high | inline below |
| [One Telegram membership can reward multiple RoleSharp accounts through a race](#finding-3) | medium | medium | inline below |
| [Admin CSV exports do not neutralize spreadsheet formulas](#finding-4) | medium | medium | inline below |
| [Payment claims can be marked before premium entitlement is committed](#finding-5) | medium | medium | inline below |
| [Parent-domain OAuth state cookies allow sibling-host login CSRF](#finding-6) | medium | medium | inline below |
| [Password changes and resets do not revoke previously issued sessions](#finding-7) | medium | medium | inline below |
| [Concurrent generation requests bypass the monthly allowance](#finding-8) | medium | medium | inline below |
| [Multiple pending student tokens can stack repeated premium grants](#finding-9) | medium | medium | inline below |
| [Direct-origin clients can forge CF-Connecting-IP and bypass application rate limits](#finding-10) | medium | high | inline below |
| [Compressed DOCX and PDF uploads can consume unbounded parser resources](#finding-11) | medium | medium | inline below |
| [Holding one credit unlocks unlimited higher-cost Claude rewrites](#finding-12) | medium | medium | inline below |
| [Unbounded resume structures can exhaust PDF and DOCX rendering resources](#finding-13) | medium | medium | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] A stale verification token can authenticate an account after its email changes

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | authentication/stale-email-token |
| CWE | CWE-287 |
| Affected lines | app/api/auth/verify-email/route.ts:19-21, lib/email-verification.ts:43-48 |

#### Summary

The verification helper returns a token record and the route issues a session even when the guarded current-email update affected zero rows.

#### Root Cause

The verification helper returns a token record and the route issues a session even when the guarded current-email update affected zero rows.

**source-to-control** — `app/api/auth/verify-email/route.ts:19-21`

The verification helper returns a token record and the route issues a session even when the guarded current-email update affected zero rows.

```typescript
The verification helper returns a token record and the route issues a session even when the guarded current-email update affected zero rows.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `app/api/auth/verify-email/route.ts:19-21`

The verification helper returns a token record and the route issues a session even when the guarded current-email update affected zero rows.

```typescript
The verification helper returns a token record and the route issues a session even when the guarded current-email update affected zero rows.
```

#### Dataflow

The canonical finding records the affected path at app/api/auth/verify-email/route.ts:19-21, lib/email-verification.ts:43-48, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** app/api/auth/verify-email/route.ts:19

- **Outcome:** The verification helper returns a token record and the route issues a session even when the guarded current-email update affected zero rows.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** The verification helper returns a token record and the route issues a session even when the guarded current-email update affected zero rows.

#### Severity

**High** — The verification helper returns a token record and the route issues a session even when the guarded current-email update affected zero rows.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-2"></a>

### [2] Unverified email changes can pre-link an account to another person’s Google identity

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | authorization/account-email-link |
| CWE | CWE-287 |
| Affected lines | app/api/account/email/route.ts:33-35, app/api/auth/google/callback/route.ts:43-52 |

#### Summary

An authenticated user can change the canonical email to an unowned address; the Google callback later treats an email match as proof of ownership and issues a session.

#### Root Cause

An authenticated user can change the canonical email to an unowned address; the Google callback later treats an email match as proof of ownership and issues a session.

**source-to-control** — `app/api/account/email/route.ts:33-35`

An authenticated user can change the canonical email to an unowned address; the Google callback later treats an email match as proof of ownership and issues a session.

```typescript
An authenticated user can change the canonical email to an unowned address; the Google callback later treats an email match as proof of ownership and issues a session.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `app/api/account/email/route.ts:33-35`

An authenticated user can change the canonical email to an unowned address; the Google callback later treats an email match as proof of ownership and issues a session.

```typescript
An authenticated user can change the canonical email to an unowned address; the Google callback later treats an email match as proof of ownership and issues a session.
```

#### Dataflow

The canonical finding records the affected path at app/api/account/email/route.ts:33-35, app/api/auth/google/callback/route.ts:43-52, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** app/api/account/email/route.ts:33

- **Outcome:** An authenticated user can change the canonical email to an unowned address; the Google callback later treats an email match as proof of ownership and issues a session.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** An authenticated user can change the canonical email to an unowned address; the Google callback later treats an email match as proof of ownership and issues a session.

#### Severity

**High** — An authenticated user can change the canonical email to an unowned address; the Google callback later treats an email match as proof of ownership and issues a session.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-3"></a>

### [3] One Telegram membership can reward multiple RoleSharp accounts through a race

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | authorization/telegram-reward |
| CWE | CWE-367 |
| Affected lines | app/api/credits/telegram/route.ts:38-40 |

#### Summary

A check-then-set binding has no unique database constraint, so concurrent accounts can both claim the same Telegram identity reward.

#### Root Cause

A check-then-set binding has no unique database constraint, so concurrent accounts can both claim the same Telegram identity reward.

**source-to-control** — `app/api/credits/telegram/route.ts:38-40`

A check-then-set binding has no unique database constraint, so concurrent accounts can both claim the same Telegram identity reward.

```typescript
A check-then-set binding has no unique database constraint, so concurrent accounts can both claim the same Telegram identity reward.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `app/api/credits/telegram/route.ts:38-40`

A check-then-set binding has no unique database constraint, so concurrent accounts can both claim the same Telegram identity reward.

```typescript
A check-then-set binding has no unique database constraint, so concurrent accounts can both claim the same Telegram identity reward.
```

#### Dataflow

The canonical finding records the affected path at app/api/credits/telegram/route.ts:38-40, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** app/api/credits/telegram/route.ts:38

- **Outcome:** A check-then-set binding has no unique database constraint, so concurrent accounts can both claim the same Telegram identity reward.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** A check-then-set binding has no unique database constraint, so concurrent accounts can both claim the same Telegram identity reward.

#### Severity

**Medium** — A check-then-set binding has no unique database constraint, so concurrent accounts can both claim the same Telegram identity reward.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-4"></a>

### [4] Admin CSV exports do not neutralize spreadsheet formulas

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | injection/csv-formula |
| CWE | CWE-1236 |
| Affected lines | app/admin/admin-panel.tsx:123-125 |

#### Summary

Stored user-controlled fields are quoted for delimiters but values beginning with formula characters remain executable when opened in spreadsheet software.

#### Root Cause

Stored user-controlled fields are quoted for delimiters but values beginning with formula characters remain executable when opened in spreadsheet software.

**source-to-control** — `app/admin/admin-panel.tsx:123-125`

Stored user-controlled fields are quoted for delimiters but values beginning with formula characters remain executable when opened in spreadsheet software.

```typescript
Stored user-controlled fields are quoted for delimiters but values beginning with formula characters remain executable when opened in spreadsheet software.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `app/admin/admin-panel.tsx:123-125`

Stored user-controlled fields are quoted for delimiters but values beginning with formula characters remain executable when opened in spreadsheet software.

```typescript
Stored user-controlled fields are quoted for delimiters but values beginning with formula characters remain executable when opened in spreadsheet software.
```

#### Dataflow

The canonical finding records the affected path at app/admin/admin-panel.tsx:123-125, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** app/admin/admin-panel.tsx:123

- **Outcome:** Stored user-controlled fields are quoted for delimiters but values beginning with formula characters remain executable when opened in spreadsheet software.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** Stored user-controlled fields are quoted for delimiters but values beginning with formula characters remain executable when opened in spreadsheet software.

#### Severity

**Medium** — Stored user-controlled fields are quoted for delimiters but values beginning with formula characters remain executable when opened in spreadsheet software.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-5"></a>

### [5] Payment claims can be marked before premium entitlement is committed

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | authorization/payment-entitlement |
| CWE | CWE-664 |
| Affected lines | app/api/pay/crypto/webhook/route.ts:39-41 |

#### Summary

The premium_granted_at marker commits in a separate operation before grantPremium; a crash in between suppresses all retries.

#### Root Cause

The premium_granted_at marker commits in a separate operation before grantPremium; a crash in between suppresses all retries.

**source-to-control** — `app/api/pay/crypto/webhook/route.ts:39-41`

The premium_granted_at marker commits in a separate operation before grantPremium; a crash in between suppresses all retries.

```typescript
The premium_granted_at marker commits in a separate operation before grantPremium; a crash in between suppresses all retries.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `app/api/pay/crypto/webhook/route.ts:39-41`

The premium_granted_at marker commits in a separate operation before grantPremium; a crash in between suppresses all retries.

```typescript
The premium_granted_at marker commits in a separate operation before grantPremium; a crash in between suppresses all retries.
```

#### Dataflow

The canonical finding records the affected path at app/api/pay/crypto/webhook/route.ts:39-41, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** app/api/pay/crypto/webhook/route.ts:39

- **Outcome:** The premium_granted_at marker commits in a separate operation before grantPremium; a crash in between suppresses all retries.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** The premium_granted_at marker commits in a separate operation before grantPremium; a crash in between suppresses all retries.

#### Severity

**Medium** — The premium_granted_at marker commits in a separate operation before grantPremium; a crash in between suppresses all retries.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-6"></a>

### [6] Parent-domain OAuth state cookies allow sibling-host login CSRF

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | csrf/oauth-state-cookie |
| CWE | CWE-352 |
| Affected lines | lib/cookies.ts:7-9 |

#### Summary

The g_state cookie is scoped to the registrable parent domain, allowing a compromised sibling host to overwrite it before callback completion.

#### Root Cause

The g_state cookie is scoped to the registrable parent domain, allowing a compromised sibling host to overwrite it before callback completion.

**source-to-control** — `lib/cookies.ts:7-9`

The g_state cookie is scoped to the registrable parent domain, allowing a compromised sibling host to overwrite it before callback completion.

```typescript
The g_state cookie is scoped to the registrable parent domain, allowing a compromised sibling host to overwrite it before callback completion.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `lib/cookies.ts:7-9`

The g_state cookie is scoped to the registrable parent domain, allowing a compromised sibling host to overwrite it before callback completion.

```typescript
The g_state cookie is scoped to the registrable parent domain, allowing a compromised sibling host to overwrite it before callback completion.
```

#### Dataflow

The canonical finding records the affected path at lib/cookies.ts:7-9, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** lib/cookies.ts:7

- **Outcome:** The g_state cookie is scoped to the registrable parent domain, allowing a compromised sibling host to overwrite it before callback completion.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** The g_state cookie is scoped to the registrable parent domain, allowing a compromised sibling host to overwrite it before callback completion.

#### Severity

**Medium** — The g_state cookie is scoped to the registrable parent domain, allowing a compromised sibling host to overwrite it before callback completion.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-7"></a>

### [7] Password changes and resets do not revoke previously issued sessions

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | authentication/session-revocation |
| CWE | CWE-613 |
| Affected lines | lib/auth.ts:130-132, app/api/auth/reset-password/route.ts:15-21 |

#### Summary

Self-contained JWE sessions are validated only by token timestamps and identity; password state is never consulted.

#### Root Cause

Self-contained JWE sessions are validated only by token timestamps and identity; password state is never consulted.

**source-to-control** — `lib/auth.ts:130-132`

Self-contained JWE sessions are validated only by token timestamps and identity; password state is never consulted.

```typescript
Self-contained JWE sessions are validated only by token timestamps and identity; password state is never consulted.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `lib/auth.ts:130-132`

Self-contained JWE sessions are validated only by token timestamps and identity; password state is never consulted.

```typescript
Self-contained JWE sessions are validated only by token timestamps and identity; password state is never consulted.
```

#### Dataflow

The canonical finding records the affected path at lib/auth.ts:130-132, app/api/auth/reset-password/route.ts:15-21, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** lib/auth.ts:130

- **Outcome:** Self-contained JWE sessions are validated only by token timestamps and identity; password state is never consulted.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** Self-contained JWE sessions are validated only by token timestamps and identity; password state is never consulted.

#### Severity

**Medium** — Self-contained JWE sessions are validated only by token timestamps and identity; password state is never consulted.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-8"></a>

### [8] Concurrent generation requests bypass the monthly allowance

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | availability/generation-quota |
| CWE | CWE-362 |
| Affected lines | app/api/generate/route.ts:99-101 |

#### Summary

Quota is counted before enqueue without an atomic reservation; parallel requests can all pass and enqueue costly work.

#### Root Cause

Quota is counted before enqueue without an atomic reservation; parallel requests can all pass and enqueue costly work.

**source-to-control** — `app/api/generate/route.ts:99-101`

Quota is counted before enqueue without an atomic reservation; parallel requests can all pass and enqueue costly work.

```typescript
Quota is counted before enqueue without an atomic reservation; parallel requests can all pass and enqueue costly work.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `app/api/generate/route.ts:99-101`

Quota is counted before enqueue without an atomic reservation; parallel requests can all pass and enqueue costly work.

```typescript
Quota is counted before enqueue without an atomic reservation; parallel requests can all pass and enqueue costly work.
```

#### Dataflow

The canonical finding records the affected path at app/api/generate/route.ts:99-101, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** app/api/generate/route.ts:99

- **Outcome:** Quota is counted before enqueue without an atomic reservation; parallel requests can all pass and enqueue costly work.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** Quota is counted before enqueue without an atomic reservation; parallel requests can all pass and enqueue costly work.

#### Severity

**Medium** — Quota is counted before enqueue without an atomic reservation; parallel requests can all pass and enqueue costly work.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-9"></a>

### [9] Multiple pending student tokens can stack repeated premium grants

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | authorization/student-entitlement |
| CWE | CWE-362 |
| Affected lines | app/api/student/confirm/route.ts:20-22 |

#### Summary

The claim uniqueness constraint is only student_email, while pending tokens are allowed for multiple academic addresses on one user and each confirmation extends entitlement.

#### Root Cause

The claim uniqueness constraint is only student_email, while pending tokens are allowed for multiple academic addresses on one user and each confirmation extends entitlement.

**source-to-control** — `app/api/student/confirm/route.ts:20-22`

The claim uniqueness constraint is only student_email, while pending tokens are allowed for multiple academic addresses on one user and each confirmation extends entitlement.

```typescript
The claim uniqueness constraint is only student_email, while pending tokens are allowed for multiple academic addresses on one user and each confirmation extends entitlement.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `app/api/student/confirm/route.ts:20-22`

The claim uniqueness constraint is only student_email, while pending tokens are allowed for multiple academic addresses on one user and each confirmation extends entitlement.

```typescript
The claim uniqueness constraint is only student_email, while pending tokens are allowed for multiple academic addresses on one user and each confirmation extends entitlement.
```

#### Dataflow

The canonical finding records the affected path at app/api/student/confirm/route.ts:20-22, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** app/api/student/confirm/route.ts:20

- **Outcome:** The claim uniqueness constraint is only student_email, while pending tokens are allowed for multiple academic addresses on one user and each confirmation extends entitlement.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** The claim uniqueness constraint is only student_email, while pending tokens are allowed for multiple academic addresses on one user and each confirmation extends entitlement.

#### Severity

**Medium** — The claim uniqueness constraint is only student_email, while pending tokens are allowed for multiple academic addresses on one user and each confirmation extends entitlement.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-10"></a>

### [10] Direct-origin clients can forge CF-Connecting-IP and bypass application rate limits

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | availability/rate-limit-origin-spoof |
| CWE | CWE-807 |
| Affected lines | lib/rate-limit.ts:10-12, deploy/nginx-site.conf:36-43 |

#### Summary

The limiter trusts CF-Connecting-IP from the request, while the public nginx origin does not overwrite it or restrict traffic to Cloudflare.

#### Root Cause

The limiter trusts CF-Connecting-IP from the request, while the public nginx origin does not overwrite it or restrict traffic to Cloudflare.

**source-to-control** — `lib/rate-limit.ts:10-12`

The limiter trusts CF-Connecting-IP from the request, while the public nginx origin does not overwrite it or restrict traffic to Cloudflare.

```typescript
The limiter trusts CF-Connecting-IP from the request, while the public nginx origin does not overwrite it or restrict traffic to Cloudflare.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `lib/rate-limit.ts:10-12`

The limiter trusts CF-Connecting-IP from the request, while the public nginx origin does not overwrite it or restrict traffic to Cloudflare.

```typescript
The limiter trusts CF-Connecting-IP from the request, while the public nginx origin does not overwrite it or restrict traffic to Cloudflare.
```

#### Dataflow

The canonical finding records the affected path at lib/rate-limit.ts:10-12, deploy/nginx-site.conf:36-43, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** lib/rate-limit.ts:10

- **Outcome:** The limiter trusts CF-Connecting-IP from the request, while the public nginx origin does not overwrite it or restrict traffic to Cloudflare.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** The limiter trusts CF-Connecting-IP from the request, while the public nginx origin does not overwrite it or restrict traffic to Cloudflare.

#### Severity

**Medium** — The limiter trusts CF-Connecting-IP from the request, while the public nginx origin does not overwrite it or restrict traffic to Cloudflare.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-11"></a>

### [11] Compressed DOCX and PDF uploads can consume unbounded parser resources

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | availability/upload-parser-bomb |
| CWE | CWE-409 |
| Affected lines | app/api/check-resume/upload/route.ts:112-114 |

#### Summary

Only compressed request bytes are bounded; Mammoth and the first JavaScript PDF parser have no decompressed-size, output-size, timeout, or isolation limit.

#### Root Cause

Only compressed request bytes are bounded; Mammoth and the first JavaScript PDF parser have no decompressed-size, output-size, timeout, or isolation limit.

**source-to-control** — `app/api/check-resume/upload/route.ts:112-114`

Only compressed request bytes are bounded; Mammoth and the first JavaScript PDF parser have no decompressed-size, output-size, timeout, or isolation limit.

```typescript
Only compressed request bytes are bounded; Mammoth and the first JavaScript PDF parser have no decompressed-size, output-size, timeout, or isolation limit.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `app/api/check-resume/upload/route.ts:112-114`

Only compressed request bytes are bounded; Mammoth and the first JavaScript PDF parser have no decompressed-size, output-size, timeout, or isolation limit.

```typescript
Only compressed request bytes are bounded; Mammoth and the first JavaScript PDF parser have no decompressed-size, output-size, timeout, or isolation limit.
```

#### Dataflow

The canonical finding records the affected path at app/api/check-resume/upload/route.ts:112-114, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** app/api/check-resume/upload/route.ts:112

- **Outcome:** Only compressed request bytes are bounded; Mammoth and the first JavaScript PDF parser have no decompressed-size, output-size, timeout, or isolation limit.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** Only compressed request bytes are bounded; Mammoth and the first JavaScript PDF parser have no decompressed-size, output-size, timeout, or isolation limit.

#### Severity

**Medium** — Only compressed request bytes are bounded; Mammoth and the first JavaScript PDF parser have no decompressed-size, output-size, timeout, or isolation limit.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-12"></a>

### [12] Holding one credit unlocks unlimited higher-cost Claude rewrites

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | authorization/credit-spend |
| CWE | CWE-770 |
| Affected lines | app/api/improve/route.ts:24-26 |

#### Summary

The endpoint selects Claude when credits are positive but never spends or decrements a credit.

#### Root Cause

The endpoint selects Claude when credits are positive but never spends or decrements a credit.

**source-to-control** — `app/api/improve/route.ts:24-26`

The endpoint selects Claude when credits are positive but never spends or decrements a credit.

```typescript
The endpoint selects Claude when credits are positive but never spends or decrements a credit.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `app/api/improve/route.ts:24-26`

The endpoint selects Claude when credits are positive but never spends or decrements a credit.

```typescript
The endpoint selects Claude when credits are positive but never spends or decrements a credit.
```

#### Dataflow

The canonical finding records the affected path at app/api/improve/route.ts:24-26, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** app/api/improve/route.ts:24

- **Outcome:** The endpoint selects Claude when credits are positive but never spends or decrements a credit.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** The endpoint selects Claude when credits are positive but never spends or decrements a credit.

#### Severity

**Medium** — The endpoint selects Claude when credits are positive but never spends or decrements a credit.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

<a id="finding-13"></a>

### [13] Unbounded resume structures can exhaust PDF and DOCX rendering resources

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. |
| Category | availability/document-render |
| CWE | CWE-400 |
| Affected lines | app/api/manual-export/pdf/route.ts:20-22 |

#### Summary

ResumeContent has unbounded strings and arrays and the renderers materialize complete output buffers synchronously.

#### Root Cause

ResumeContent has unbounded strings and arrays and the renderers materialize complete output buffers synchronously.

**source-to-control** — `app/api/manual-export/pdf/route.ts:20-22`

ResumeContent has unbounded strings and arrays and the renderers materialize complete output buffers synchronously.

```typescript
ResumeContent has unbounded strings and arrays and the renderers materialize complete output buffers synchronously.
```

#### Validation

Direct source, sink, and deployment evidence were reviewed; remaining uncertainty is limited to runtime preconditions. Validation details were not recorded separately.

Validation method: full-file source review plus targeted deployment/runtime checks

**source-to-control** — `app/api/manual-export/pdf/route.ts:20-22`

ResumeContent has unbounded strings and arrays and the renderers materialize complete output buffers synchronously.

```typescript
ResumeContent has unbounded strings and arrays and the renderers materialize complete output buffers synchronously.
```

#### Dataflow

The canonical finding records the affected path at app/api/manual-export/pdf/route.ts:20-22, but no expanded source-to-sink narrative was recorded.

- **Source:** attacker-controlled request or stored value

- **Sink:** app/api/manual-export/pdf/route.ts:20

- **Outcome:** ResumeContent has unbounded strings and arrays and the renderers materialize complete output buffers synchronously.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

- **Attacker:** remote user or anonymous client

- **Outcome:** ResumeContent has unbounded strings and arrays and the renderers materialize complete output buffers synchronously.

#### Severity

**Medium** — ResumeContent has unbounded strings and arrays and the renderers materialize complete output buffers synchronously.

Raise severity if production evidence shows broader reachability or lower it if the stated deployment precondition is absent.

#### Remediation

Apply an atomic authorization or resource-boundary check at the stated root control; add regression tests for concurrent, stale-token, direct-origin, and malformed-input cases as applicable.

Tests:
- Add a regression test reproducing the source-to-sink path.
- Add concurrency and failure-injection tests where state is claimed or quota is spent.

Preventive controls:
- Enforce unique database constraints for identity bindings.
- Treat proxy-derived headers as trusted only after origin restriction.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Authentication and account linking | security boundary | Reported | Email-change, stale-token, session, OAuth-state controls reviewed. Evidence: artifacts/03_coverage/reviewed_surfaces.md |
| Payment and entitlement state | security boundary | Reported | Webhook, student, Telegram, quota, and credit controls reviewed. Evidence: artifacts/03_coverage/reviewed_surfaces.md |
| Upload and document rendering | security boundary | Reported | PDF/DOCX parsers and renderers reviewed. Evidence: artifacts/03_coverage/reviewed_surfaces.md |
| Origin and rate limiting | security boundary | Reported | Live direct-origin request confirmed and nginx/rate-limit path reviewed. Evidence: artifacts/03_coverage/reviewed_surfaces.md |
| Admin APIs and views | security boundary | No issue found | Admin routes and views reviewed; CSV export is reported separately. Evidence: artifacts/03_coverage/reviewed_surfaces.md |
| SQL and object ownership | security boundary | No issue found | Parameterized queries and owner-scoped access reviewed. Evidence: artifacts/03_coverage/reviewed_surfaces.md |
| VPS host/deployment | security boundary | Needs follow-up | Host healthy but root services, backups, SSH exposure, and patch drift need hardening. Evidence: artifacts/03_coverage/reviewed_surfaces.md |

## Open Questions And Follow Up

- Restrict origin 443 to Cloudflare IP ranges or move origin behind a tunnel, then retest forged CF-Connecting-IP rate-limit bypass.
- Create and test encrypted off-host PostgreSQL backups; current /opt/resume-ai/data/backups directory is absent.
- Disable SSH password authentication and root Internet login; use a non-root admin with narrowly scoped sudo.
- Read-only audit identified host hardening gaps but no changes were authorized.
  - Follow-up prompt: Review deferred unit vps-hardening-followup and close its stated proof gap. Paths: deploy.sh, deploy/nginx-site.conf.
- Ranked but not selected for deep review in this standard scan; retained as explicit follow-up coverage.
  - Follow-up prompt: Review deferred unit unselected-ranked-source-rows and close its stated proof gap. Paths: app/.well-known/api-catalog/route.ts, app/\[locale\]/page.tsx, app/about/page.tsx, app/admin/payments/page.tsx, app/admin/pricing-config/page.tsx, app/admin/resumes/page.tsx, app/admin/settings/page.tsx, app/admin/sidebar.tsx, app/admin/students/page.tsx, app/admin/support/page.tsx, app/admin/system/page.tsx, app/admin/users/page.tsx, app/api/analytics/route.ts, app/api/companies/search/route.ts, app/api/contact/route.ts, app/api/countries/route.ts, app/api/geo/route.ts, app/api/health/route.ts, app/api/jobs/\[id\]/route.ts, app/api/jobs/route.ts, app/api/me/route.ts, app/api/pay/crypto/create/route.ts, app/api/roles/route.ts, app/api/student/send/route.ts, app/api/student/status/route.ts, app/api/student/winback/route.ts, app/app-shell.tsx, app/ats-resume-checker/page.tsx, app/auto-apply/page.tsx, app/blog-md/\[slug\]/route.ts, app/blog/BlogPosts.tsx, app/blog/\[slug\]/opengraph-image.tsx, app/blog/\[slug\]/page.tsx, app/blog/page.tsx, app/careers/page.tsx, app/checker/checker-country-cta.tsx, app/checker/head.tsx, app/checker/layout.tsx, app/checker/page.tsx, app/companies/CompaniesPage.tsx, app/companies/\[company\]/page.tsx, app/companies/page.tsx, app/compare-md/\[slug\]/route.ts, app/compare/\[slug\]/opengraph-image.tsx, app/compare/\[slug\]/page.tsx, app/compare/page.tsx, app/comparison-section.tsx, app/contact/contact-form.tsx, app/contact/page.tsx, app/count-up.tsx, app/cover-letter-examples/page.tsx, app/cover-letter-generator/page.tsx, app/dashboard/layout.tsx, app/dashboard/page.tsx, app/first-visit-country.tsx, app/footer.tsx, app/forgot-password/layout.tsx, app/forgot-password/page.tsx, app/globals.css, app/google8576d39464fd29f8.html/route.ts, app/help/page.tsx, app/hero-country-widget.tsx, app/hero-trust-strip.tsx, app/home.css, app/icons.tsx, app/internships/\[country\]/page.tsx, app/internships/page.tsx, app/interview-prep/page.tsx, app/jobs/\[country\]/page.tsx, app/jobs/jobs-finder.tsx, app/jobs/page.tsx, app/json-ld.tsx, app/layout.tsx, app/learn/page.tsx, app/linkedin-checker/head.tsx, app/linkedin-checker/layout.tsx, app/linkedin-checker/page.tsx, app/llms-full.txt/route.ts, app/llms.txt/route.ts, app/login/layout.tsx, app/login/page.tsx, app/micro-benefits.tsx, app/nav.tsx, app/opengraph-image.tsx, app/page-tracker.tsx, app/page.tsx, app/pricing-toggle.tsx, app/pricing/page.tsx, app/privacy/page.tsx, app/prompts/page.tsx, app/refund/page.tsx, app/reset-password/layout.tsx, app/reset-password/page.tsx, app/resume-builder/page.tsx, app/resume-examples/page.tsx, app/resume-fixer/head.tsx, app/resume-fixer/layout.tsx, app/resume-fixer/page.tsx, app/resume-maker/head.tsx, app/resume-maker/layout.tsx, app/resume-maker/page.tsx, app/resume-templates/page.tsx, app/resume-translator/page.tsx, app/resume/\[company\]/\[role\]/page.tsx, app/robots.txt/route.ts, app/roles/RolesPage.tsx, app/roles/\[role\]/page.tsx, app/roles/page.tsx, app/scroll-reveal.tsx, app/seo-blocks.tsx, app/session-watch.tsx, app/settings/layout.tsx, app/settings/page.tsx, app/sitemap.xml/route.ts, app/sitemaps/\[name\]/route.ts, app/social-proof-band.tsx, app/student-banner.tsx, app/students/page.tsx, app/support/\[id\]/page.tsx, app/support/layout.tsx, app/support/my-tickets.tsx, app/support/page.tsx, app/support/support-form.tsx, app/terms/page.tsx, app/theme-toggle.tsx, app/tool-seo.tsx, app/tool-switcher.tsx, app/tracker/layout.tsx, app/tracker/page.tsx, components/CompareTable.tsx, components/StudentOfferCard.tsx, components/ui/CountryPicker.tsx, components/ui/EmptyState.tsx, components/ui/RepeatableCard.tsx, components/ui/ScoreRing.tsx, components/ui/Skeleton.tsx, components/ui/StepWizard.tsx, components/ui/Toast.tsx, config/mcporter.json, db/migrations/002_tiers.sql, db/migrations/003_auth.sql, db/migrations/005_plans.sql, db/migrations/006_admin_actions.sql, db/migrations/007_pipeline_indexes.sql, db/migrations/008_email_verification.sql, db/migrations/009_credits_referrals.sql, db/migrations/010_applications.sql, db/migrations/011_company_enrichment.sql, db/migrations/012_support.sql, db/migrations/013_blog.sql, db/migrations/015_credit_refunds.sql, db/migrations/016_student_offer.sql, db/migrations/017_jobs.sql, db/migrations/018_jobs_all_countries.sql, db/migrations/019_traffic_analytics.sql, db/migrations/020_email_log.sql, db/migrations/021_feature_flags.sql, db/migrations/022_password_reset.sql, db/schema.sql, deploy.sh, eslint.config.mjs, lib/ats-score.ts, lib/auth.ts, lib/blog-gen.ts, lib/blog-posts-extra.ts, lib/blog-posts.ts, lib/blog.ts, lib/company-context.ts, lib/competitors.ts, lib/contact-links.ts, lib/cookies.ts, lib/credits.ts, lib/db.ts, lib/dev-store.ts, lib/docx.ts, lib/email-verification.ts, lib/email.ts, lib/entitlements.ts, lib/env.ts, lib/evidence-content.ts, lib/indexnow.ts, lib/job-config.ts, lib/jobs.ts, lib/jsonld.ts, lib/linkedin-checker.ts, lib/llm.ts, lib/local-tailor.ts, lib/locales.ts, lib/locations.ts, lib/md-render.ts, lib/nowpay.ts, lib/pdf.tsx, lib/queue.ts, lib/rate-limit.ts, lib/resume-checker.ts, lib/resume-display.ts, lib/resume-guidance.ts, lib/seo.ts, lib/site-stats.ts, lib/sitemap-xml.ts, lib/student.ts, lib/tailor.ts, lib/types.ts, loadtest/generate.js, next-env.d.ts, next.config.ts, package.json, postcss.config.mjs, scripts/backfill-rag.ts, scripts/bench-dataset.ts, scripts/bench-run.ts, scripts/fix-countries.ts, scripts/import-companies.ts, scripts/import-roles.ts, scripts/import-us-companies.ts, scripts/job_ingestor.py, scripts/manage-data.ts, scripts/recover-flipped-countries.ts, scripts/seed-roles.ts, scripts/student-cron.ts, tsconfig.json, worker/index.ts.
