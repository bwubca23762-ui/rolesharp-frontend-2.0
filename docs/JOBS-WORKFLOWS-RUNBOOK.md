# Jobs workflows operations and incident response

## Readiness and health

Check `/api/health` and the authenticated `/api/admin/jobs-workflows/health` endpoint. The admin response exposes safe booleans, queue age/counts, and redacted state totals only—never recipients, message bodies, resume content, tokens, or authorization codes.

Before any rollout, record the build SHA, schema digest, release manifest, backup verification, namespace, queue prefix, service definitions, and hashes of the four disabled production flag rows. Production flags remain off through verification and require explicit authorization before any canary.

`deploy.sh` refuses to proceed when an environment/provider flag or persisted Jobs flag is enabled. It creates and verifies a pre-migration custom-format dump, applies migrations twice to prove a no-op rerun, records source/schema manifests, runs `verify:jobs:release -- --production-flags-off`, executes the disposable fake smoke, and only then activates the web service, resume worker, job ingestor, Recommendation Agent, Auto-Apply Agent, and blog worker. The Recommendation Agent owns scheduling, matching, digests, and notification outbox delivery; the Auto-Apply Agent owns package generation and mailbox dispatch. This installs disabled capability; it does not authorize a rollout or enable any Jobs flag.

## Normal controls

Use the allowlisted admin flag route with same-origin mutation protection. The four controls are `jobs_daily_matches`, `role_apply_prepare`, `role_apply_gmail_send`, and `role_apply_microsoft_send`. A disabled flag must prevent new schedules and must be revalidated again immediately before every notification or mailbox provider boundary.

Inspect durable PostgreSQL rows before Redis. Redis is delivery assistance, not workflow truth. Do not manually move `unknown`, `provider_accepted`, or terminal attempts back to a sendable state. Reconciliation may repair tracker projections; it must never create a second provider call.

With all environment and persisted workflow flags off, `npm run reconcile:jobs` is read-only and reports interrupted counts. Mutation additionally requires the explicit `JOBS_ROLLBACK_RECONCILE=true npm run reconcile:jobs -- --apply` form and classifies crossed-boundary work as `unknown` while canceling only pre-boundary work.

## Incident response

Immediately disable all four flags for any duplicate, cross-user access, leaked credential/content, hard-rule application, unexplained provider call, queue namespace mismatch, or security/accessibility regression. Stop the Recommendation Agent first so it cannot schedule new work, then stop the Auto-Apply Agent and allow their configured 75-second drains inside the 90-second systemd stop timeout.

Classify abandoned rows that crossed `provider_call_started_at` as terminal `unknown`; do not resend them. Pre-boundary queued/reserved work may be canceled. Preserve redacted hashes, invocation ordinals, timestamps, flag snapshots, build/schema identifiers, and provider status classes. Never copy tokens, recipients, bodies, or resume bytes into tickets or chat.

Provider HTTP 408/429 is retryable only when the response proves rejection, with the durable `retry_not_before` schedule and a maximum of three total invocations. Network loss, timeout, worker death, malformed success, and unclassified 5xx after the boundary are terminal `unknown`.

## Staged rollout thresholds

Any separately authorized rollout advances `one internal user → 1% → 5% → 25% → 100%`, with at least 24 hours and 100 attempts at each step, or seven days at lower volume. Abort for any duplicate/cross-user/credential/hard-rule event, unknown rate above 0.5%, provider error rate above 5% for 15 minutes, queue age above 10 minutes, or a security/accessibility regression.
