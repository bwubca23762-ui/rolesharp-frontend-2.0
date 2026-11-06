# Release verification — 3 November 2026

Release: `20261103113742-verified`. Source is a manifest-verified working-tree snapshot based on `f2d0a55727dd97c74282129b4c9c3a3c636e7ea9`, including the pending repair work. It is not represented as an unchanged Git commit.

## Payment and email checks

- Live NOWPayments merchant-coins request: HTTP 200 using the configured API key.
- Live Cloudflare Email Sending limits: HTTP 200, successful authentication, quota available. The provider reported seven sends in the current quota period.
- Production email logs contain recent accepted/queued transactional messages. Queue acceptance does not prove final inbox placement.
- Production payment history has waiting/expired invoices but no completed settlements; no customer charge was initiated for this verification.
- A disposable database with the real schema/migrations and actual webhook handler rejected invalid signatures and mismatched amounts, granted Premium exactly once for repeated valid callbacks, and emitted exactly one invoice message to a loopback SMTP receiver.
- An additional regression test reproduced a delayed callback downgrading a completed receipt to `waiting`. Fixed the webhook to preserve the paid status after Premium is granted, including mismatched retry payloads. The regression test passes.
- All 47 admin integration requests and all 664 unit tests pass.

The integration runner is `scripts/run-admin-write-smoke.sh`; the payment/SMTP assertions are in `scripts/payment-email-smoke.mjs`. Only synthetic local records and a local SMTP receiver were used. External mailboxes and a real-money settlement are not certified by these tests.

## Release procedure

- Excludes local credentials, runtime data, agent scratch, and the user's untracked QA scripts.
- Builds on the VPS using the production environment before activation.
- Schema and migration hashes match the live release; no migration or configuration reset is required.
- A database backup is verified with `pg_restore -l`.
- Activation preserves feature flags, service definitions and the environment file; prior release remains available for rollback.
- Preview and post-activation results are recorded under `.omo/evidence/deploy-2026-11-03/` locally and the matching release evidence directory on the VPS.

Razorpay remains deferred. Existing application sending flags remain disabled; this release does not enable them or send campaigns.

## Activation result

The release is active at `/opt/resume-ai/current`. The production build, private-port preview, source checks, verified backup, activation and all eight service checks passed. Environment-file and feature-flag comparisons are identical before/after activation. No migrations ran.

Authenticated readiness reports database and Redis healthy. All public post-deployment security checks pass, including authorization, private caching, and production denial of simulated payment confirmation. Eight representative public pages return 200 and show the updated metadata.

The watchdog initially failed because its source file was not executable. Restored mode 0755 in both the checkout and release, then ran the watchdog successfully (`Result=success`, exit 0). No failed systemd units remain after that check. The final source archive preserves the executable mode.

Previous release retained for rollback: `/opt/resume-ai/releases/20261102092609-39166`.
