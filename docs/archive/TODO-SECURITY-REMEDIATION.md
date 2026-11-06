# Security remediation TODO

Source: recovered Codex Security audit for revision `1d51f9c9790dc7e10572a953463341b0f10cf3a6`.

The current checkout is a dirty working tree, so each item must be revalidated against the bytes being changed. Mark an item complete only after a focused regression check and the relevant build/type checks pass.

## Findings

- [x] `account-email-google-prehijack` — Google linking now rejects unverified password accounts; email changes use `pending_email` and verification.
- [x] `stale-email-token-authenticates-account` — token consumption and guarded email update are atomic.
- [x] `direct-origin-cf-header-rate-limit-bypass` — rate limiting uses trusted proxy-derived headers, never `CF-Connecting-IP`.
- [x] `resume-upload-parser-bomb` — uploads are capped at 5 MiB and parser processes have time, buffer, and memory limits.
- [x] `manual-export-unbounded-resume-render` — `ResumeContent` bounds rendered fields and collection sizes.
- [x] `student-token-stacking` — student token consumption is a one-time guarded `UPDATE ... RETURNING`.
- [x] `telegram-reward-race` — Telegram identity and reward issuance are protected by unique database controls and idempotent credit events.
- [x] `generate-quota-race` — monthly generation admission uses an advisory lock and reservation row.
- [x] `improve-credit-not-spent` — action credits are spent atomically and refunded on failed model calls.
- [x] `password-session-not-revoked` — password changes/resets increment `auth_version`; sessions validate it on every request.
- [x] `payment-claim-before-entitlement` — paid entitlement is guarded by `premium_granted_at` in the payment claim CTE.
- [x] `admin-csv-formula-injection` — all audit CSV headers and cells use `csvCell`.
- [x] `oauth-state-parent-cookie` — HTTPS OAuth state uses a host-only `__Host-` cookie and exact state comparison.

## Verification

- [x] Add or update focused regression coverage for the changed boundaries.
- [x] Run focused lint, TypeScript, and security tests.
- [x] Re-run the security finding checks; full runtime validation remains environment-dependent.

## Verification record

- `npm run test:security` — **7/7 passed**.
- `npm run typecheck` — **passed**.
- `npm run lint` — **passed with zero errors or warnings**; generated vendor bundles are excluded in `eslint.config.mjs`.
- `npm run build` — **passed**, including compilation, type validation, and generation of 322 static pages.
- `git diff --check` — **passed**.
