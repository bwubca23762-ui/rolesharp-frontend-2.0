# Security remediation TODO

This checklist maps directly to `docs/reports/2026-08-10-security-audit.md` and
`docs/archive/vps-audit-2026-07-11.md`.

> **STATUS 2026-07-12:** Phase 1–3 fixes are deployed. Phase 4 passed locally
> and on the VPS. Tool-route audit tables are aligned with code (see
> `docs/archive/tools-audit-status-2026-07-11.md` — no open app-code tool items).
> Phase 5 is partially complete: service users/sandboxing, loopback-only Claude
> proxy, local backup, nginx real-IP handling, and TLS defaults are live. SSH
> lockdown, Cloudflare-only origin firewall, OS updates, and encrypted off-host
> backup/restore still require explicit operational approval.

## Phase 1 — account identity and sessions

- [x] Replace immediate canonical email changes with a verified `pending_email` flow.
      (users.pending_email + unique lower() index in `db/migrations/023_security_remediation.sql`; staged in `app/api/account/email/route.ts:33`; consumed in `lib/email-verification.ts:39-55`)
- [x] Consume email-verification tokens atomically and reject stale tokens.
      (`lib/email-verification.ts`: `set used_at=now() … where used_at is null … returning`)
- [x] Require Google to return a verified email before account creation/linking.
      (`app/api/auth/google/callback/route.ts:43`: rejects unless `verified_email === true`)
- [x] Make OAuth state cookies host-only so sibling hosts cannot overwrite them.
      (`app/api/auth/google/start/route.ts`: `__Host-g_state`, `domain:` attribute removed)
- [x] Add a user session version and revoke sessions after password changes/resets.
      (users.auth_version in migration 023; bumped in `app/api/account/password/route.ts:28` and `app/api/auth/reset-password/route.ts:21`; checked in `lib/auth.ts:158`)
- [x] Consume password-reset tokens atomically.
      (`app/api/auth/reset-password/route.ts`: single UPDATE … RETURNING)

## Phase 2 — payments, credits, and quotas

- [x] Make Telegram identity binding unique and atomic.
      (partial unique index `users_telegram_user_id_unique`; 23505 → 409 in `app/api/credits/telegram/route.ts:47`)
- [x] Prevent multiple student claims for one user at the database boundary.
      (`student_claims_user_id_unique` index; `on conflict do nothing` in `app/api/student/confirm/route.ts:22`)
- [x] Reserve monthly generation quota atomically before queue submission.
      (`generation_reservations` table in migration 023; atomic count+insert in `lib/entitlements.ts:154-160`)
- [x] Spend a credit when the improve route selects the paid model.
      (`app/api/improve/route.ts`: `spendActionCredit` / `refundActionCredit` on failure)
- [x] Commit payment entitlement and the grant marker atomically/recoverably.
      (`app/api/pay/crypto/webhook/route.ts`: single CTE guarded by `premium_granted_at is null`)

## Phase 3 — request and output safety

- [x] Trust `CF-Connecting-IP` only when nginx has overwritten it from a trusted proxy path.
      (`lib/request-ip.ts` trusts x-real-ip from nginx only; `deploy/cloudflare-real-ip.conf` sets `real_ip_header CF-Connecting-IP` restricted to CF CIDRs)
- [~] Restrict direct-origin traffic or remove its ability to bypass edge controls.
      (code/nginx side done; UFW restriction of 443 to Cloudflare ranges is a live-VPS step → runbook §4)
- [x] Bound PDF/DOCX upload parsing by time, expanded size, and output length.
      (`app/api/check-resume/upload/route.ts`: 5 MB cap, 10 s pdftotext timeout, 2 MB maxBuffer, 1 M char output cap)
- [x] Bound resume object strings, arrays, and total renderer complexity.
      (`lib/types.ts`: zod `.max(4000)` strings / `.max(500)` short strings / `.max(50)` arrays)
- [x] Neutralize spreadsheet formulas in admin CSV exports.
      (`lib/csv.ts` `csvCell()` prefixes `=`,`+`,`-`,`@`; used by `app/admin/admin-panel.tsx`)
- [x] Restrict anonymous users to free PDF templates.
      (`app/api/manual-export/pdf/route.ts`: template allowed only if premium or in freeTemplates)

## Phase 4 — verification

- [x] Add focused regression tests for each fixed boundary.
      (`tests/security-remediation.test.ts` — CSV injection, IP trust, schema bounds)
- [x] Run typecheck. (clean, 2026-07-11, `npx tsc --noEmit`)
- [x] Run lint. (clean on all security-touched paths, 2026-07-11)
- [x] Run production build. (passed locally and on the VPS)
- [x] Run production dependency audit. (`npm audit --omit=dev`: zero vulnerabilities)
- [x] Re-run exploit-oriented checks and production service verification.

## Phase 5 — VPS hardening

See **`deploy/VPS-HARDENING-RUNBOOK.md`** for the exact ordered commands with
per-step verification. Items marked (deploy.sh) apply automatically on the next
`./deploy.sh` run; the rest are manual runbook steps.

- [ ] Create and verify local, encrypted, off-host PostgreSQL backups and restore procedure.
      (deploy.sh now creates verified plain dumps; encryption + off-host + restore test → runbook §2)
- [x] Create a non-root deployment/service user. (`rolesharp` live and verified)
- [x] Harden `resume-web`, `resume-worker`, and the proxy systemd services.
      (`NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, memory/task limits live)
- [ ] Disable SSH password authentication and direct root login after validating alternate access. (runbook §1 + §5 — DO §1 FIRST)
- [ ] Restrict origin HTTPS to Cloudflare or move it behind Cloudflare Tunnel. (runbook §4)
- [x] Bind the Claude proxy to loopback and run it as a dedicated user. (`claudeproxy`, `127.0.0.1:8080`, HTTP check passed)
- [ ] Apply pending OS security updates and reboot if required. (runbook §4)
- [x] Remove obsolete global nginx TLS 1.0/1.1 defaults. (TLS 1.2/1.3 only; `nginx -t` passed)
- [ ] Verify all services, firewall rules, public routes, backups, and SSH access after changes. (runbook §7)

## Completion evidence

- [x] Record changed files and commands. (36 modified + 17 new files; see `git status` and this file's per-item evidence)
- [x] Record test/build results. (`npm run check`, security tests 3/3, ATS tests 4/4, local/VPS production builds, dependency audit all passed.)
- [x] Record live VPS verification and remaining operational risks.

### Live verification — 2026-07-11

- `./deploy.sh`: migrations, VPS build, service restart, cache purge, sitemap and route smoke tests passed.
- Public homepage `200`; locale `200`; invalid locale `404`; anonymous jobs `401`.
- `resume-web`, `resume-worker`, `rolesharp-jobs`, `antigravity-proxy`, and nginx are active; zero failed units.
- Ports `3000`, `8080`, `5432`, and `6379` bind only to `127.0.0.1`.
- `/opt/resume-ai/.env` is `0640 root:rolesharp`; backup directory is `0750 rolesharp:rolesharp` and contains a non-empty initial dump.
- Current Cloudflare IPv4/IPv6 ranges were verified against Cloudflare's published range pages before firewall planning.
- Remaining risks: direct origin still returns `200`; root SSH and password auth remain enabled; pending OS updates remain; backup is not yet encrypted/off-host restore-tested.

### Current verification boundary — 2026-08-02

The current remediation pass includes repository code, migrations, workers,
tests, deployment wiring, the operational runbook, and isolated behavioral
integration on this workstation.

- The destructive PostgreSQL integrity harness ran against an explicitly
  disposable PostgreSQL 16 schema and passed migration replay, state-machine,
  account/resume deletion, provider-boundary, and concurrency checks. The
  deployed schema digest reported by that run was
  `303fc66eae8ccabaff3aa76e485f23efdc247910b785e4e5b630bb50c996835c`.
  Never point this harness at production because it resets the `public` schema.
- Redis 7 and BullMQ completed an isolated queue round trip. Controlled Gmail
  and Microsoft identity, refresh, and send simulations passed with external
  network access denied; this is not a claim about live provider accounts.
- Playwright passed all six responsive/accessibility workflow tests. Desktop
  and mobile Lighthouse median-of-three gates passed for `/auto-apply`,
  `/daily-matches`, and `/campaign-settings`.
- Release manifests and the deployed database-schema record remain release-host
  artifacts generated by `deploy.sh`; they are absent from a source checkout by
  design and must be verified in the actual release directory.
- Live verification of the new systemd agents, Cloudflare, firewall, SSH,
  real SMTP/OAuth provider accounts, NOWPayments, monitoring, encrypted off-host
  backups, and restore drills still requires separate credentials and explicit
  operational approval. Classify those external gates as **not run**, keep the
  affected production flags disabled, and follow
  `deploy/VPS-HARDENING-RUNBOOK.md` section 8.
