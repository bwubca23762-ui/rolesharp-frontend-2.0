# RoleSharp — Full-Stack Engineering Audit

**Date:** 2026-08-12
**Commit audited:** `fda389a` (branch `deploy/restore-infra`)
**Scope:** 36,724 lines across `app/` (24,183), `lib/` (8,249), `components/` (1,226), `scripts/` (1,552), `db/` (697), `worker/` (165), `tests/` (654) — 84 API routes, 26 migrations
**Method:** static analysis, dependency inspection, TypeScript compilation, migration and route inventory. Every claim below is backed by a check that was actually run; anything unverified is labelled as such.

---

## Verdict

The **backend is genuinely well-engineered** — noticeably above typical output for a project this size. Authorization, idempotency, atomic payment grants, and rate limiting are handled correctly, and the source compiles with **zero type errors**.

The problems are not in the application logic. They are in **tooling, observability, and frontend design conformance**. Two of them currently break the developer feedback loop entirely.

| Area | Grade | Note |
|---|---|---|
| Authorization & access control | **A** | All 36 admin routes gated; IDOR correctly scoped |
| Payments & concurrency | **A** | Signature-verified, atomic, idempotent |
| Input handling / SQL safety | **A−** | No injectable interpolation found |
| Configuration & secrets | **A−** | Fail-fast validation, no hardcoded secrets |
| Reliability (worker, pool, retries) | **B+** | Graceful shutdown, bounded retries |
| Build & test tooling | **D** | Typecheck poisoned, tests cannot run |
| Observability | **D+** | No structured logging, tracing, or error tracking |
| Frontend design conformance | **C−** | Dark default, zero motion systems |
| Code organization | **B−** | One 2,045-line file; `lib/` is a grab-bag |

---

## Critical findings

### C1 — Stale `.next/` silently poisons `npm run typecheck`

`npx tsc --noEmit` reports **67 errors. All 67 come from `.next/types/validator.ts`. Zero come from real source.**

`tsconfig.json` excludes only `node_modules`, so the generated `.next` type validator is pulled into the program. Worse, the `.next` present on disk is from a **substantially different version of the app** — it references roughly 40 API routes that no longer exist in the tree:

```
app/api/campaigns/…          app/api/daily-matches/…
app/api/job-matches/…        app/api/mail-connections/gmail|microsoft/…
app/api/notifications/…      app/api/application-packages/…
app/api/admin/staff/…        app/api/admin/legal/…
```

Those directories were removed by commit `fbf81d4` ("Audit routes and remove dead artifacts"), but the build output was never cleared.

**Impact:** `npm run check` (`typecheck && lint`) fails permanently on phantom errors. A team that sees 67 errors every run stops reading them — which means a *real* type error would be invisible.

**Fix:** add `.next` and `.next-*` to `exclude` in `tsconfig.json`, and clear `.next` before typechecking.

```jsonc
"exclude": ["node_modules", ".next", ".next-*", "outputs", "loadtest"]
```

**Verified:** with `.next` errors filtered out, the source is **100% type-clean**.

---

### C2 — Test suites cannot execute

All six suites abort before running a single assertion:

```
You installed esbuild for another platform than the one you're currently using.
The "@esbuild/win32-x64" package is present but this platform needs "@esbuild/linux-x64".
```

`node_modules` was populated on Windows and carries the Windows-native esbuild binary; `tsx` depends on it.

**This is an environment defect, not a code defect.** I want to be explicit: **I could not determine whether these tests pass or fail.** No claim in this report depends on test results.

**Impact:** the security, ATS, SEO, frontend-regression, and internship-report suites are a safety net nobody can currently deploy. If CI runs on Linux against a copied `node_modules`, it has the same problem.

**Fix:** run `npm ci` on the target platform; never copy `node_modules` across OSes. Add `node_modules/` to any sync or copy exclusion list.

---

## High findings

### H1 — No observability layer

| Signal | Status |
|---|---|
| Structured logging | **Absent** — 32 raw `console.*` calls |
| Error tracking (Sentry/Rollbar) | **Absent** |
| Distributed tracing (OpenTelemetry) | **Absent** |
| Metrics (queue depth, DB latency, cache hit rate) | **Absent** |
| Correlation / request IDs | **Absent** |

For a system doing paid LLM generation on a queue, this is the widest gap in the stack. When a resume generation fails in production today, there is no way to answer *which user, which job, which model call, how long it took, what the payload was*.

The code is otherwise written to be diagnosable — the comments are unusually good — but the runtime emits nothing an operator can query.

**Fix (order of value):** structured JSON logger with request IDs → error tracking → queue depth + LLM latency metrics → tracing.

### H2 — `admin/backup` shells out from a request handler

`app/api/admin/backup/route.ts` runs, inside the HTTP request path:

```ts
await execAsync(`mkdir -p /opt/resume-ai/data/backups && docker exec resume-pg pg_dump -U postgres resumeai > ${file}`);
```

The interpolated `file` is derived from `new Date().toISOString()` with `[:.]` stripped, so **this is not currently injectable** — and the route is correctly gated by `isAdmin()` plus a rate limit of 2.

The problem is architectural, not injection:

- a `pg_dump` of a multi-GB database will exceed any sane HTTP timeout
- it grants the web process Docker socket authority — a container escape primitive if the admin session is ever compromised
- no size limit, no rotation, no verification the dump is restorable
- failure surfaces as a 500, not an alert

**Fix:** move to a BullMQ job the route enqueues; return a job ID. Keep Docker authority out of the web tier.

### H3 — Dark mode is the default theme

`app/layout.tsx:167`:

```js
localStorage.getItem('rolesharp-theme') || localStorage.getItem('resumeai-theme') || 'dark'
```

…with the `catch` branch also defaulting to `'dark'`.

The engineering standard for this project mandates a **light default** with an explicit toggle, persistence, and system detection. Persistence and the toggle exist; the default and system detection do not — `prefers-color-scheme` is used only for the browser theme-color meta tag, never to pick the initial theme.

**Fix:** default light, honour `prefers-color-scheme` when no stored preference exists.

### H4 — Zero motion systems

No animation dependency is installed — no GSAP, Framer Motion, Motion One, Lenis, or Three.js. Against a standard calling for 8–15 meaningful motion systems and at least one signature interaction, the current count is **zero**.

Credit where due: `prefers-reduced-motion` is honoured in **11 places**, so the accessibility scaffolding for motion already exists. The motion itself does not.

This is the single largest gap between the product as built and the design standard it is being held to. It is also the most expensive to close — treat it as a scoped project, not a cleanup task.

---

## Medium findings

### M1 — 184 uses of `any`

Across `app/`, `lib/`, and `worker/`. Concentrated in DB result shapes and API payloads — exactly the boundaries where runtime data enters the type system and where `any` does the most damage. Zod is already a dependency and is used at some boundaries; it should be used at all of them.

### M2 — `app/admin/admin-panel.tsx` is 2,045 lines

The largest file in the repo by a factor of two. It backs 16 admin pages. Untestable at this size, and a merge-conflict magnet.

**Fix:** split per admin domain (users, payments, jobs, flags, support…), colocated with the routes already separated under `app/admin/*/page.tsx`.

### M3 — `lib/` is a 55-file flat namespace

Domain logic (`ats-score`, `tailor`, `resume-checker`), infrastructure (`db`, `queue`, `rate-limit`, `email`), and **static content** (`blog-posts-extra.ts` at 972 lines, `blog-posts.ts` at 428, `competitors.ts` at 456) all share one directory.

Content-as-code means a copy edit requires a deploy. Consider `lib/domain/`, `lib/infra/`, and moving post bodies to MDX or the database — `013_blog.sql` already exists.

### M4 — Five open security items, all infrastructure

`SECURITY-REMEDIATION-TODO.md` — 29 of 34 complete. The archived second checklist is 16/16 complete. **Every open item is ops, not application code:**

- [ ] Encrypted off-host PostgreSQL backups + verified restore
- [ ] Disable SSH password auth and direct root login
- [ ] Restrict origin HTTPS to Cloudflare / Cloudflare Tunnel
- [ ] Apply pending OS security updates
- [ ] Post-change verification of services, firewall, routes, backups, SSH

Worth stating plainly: **the application-layer security remediation is finished.** What remains needs shell access to the VPS, not a code change. The backup item (M4a) compounds H2 — there is currently no proven restore path.

### M5 — No `.gitignore` coverage for build output

The 991 MB of build artifacts removed earlier (`bin/.next-baseline`, `.next-qa-build`, `.next-playwright`) were untracked but unignored, so they reappear as noise on every `git status` and risk being committed.

### M6 — `tsconfig.jobs-qa.json` is untracked

A real build config sitting outside version control. It also `include`s `.next-playwright/types/**` and `.next-qa-build/types/**`, which no longer exist — those globs are inert until a QA build regenerates them.

---

## What is genuinely well built

Stated with the same evidence standard as the findings above.

**Authorization — verified across all 84 routes.** Every one of the 36 `app/api/admin/*` routes calls `isAdmin()` and returns 403 before touching data. The only two without it are `admin/login` and `admin/logout`, which is correct. Admin auth additionally requires TOTP (`verifyAdminTotp`), and commit `4733dfc` fails deployment when admin MFA is unconfigured.

**IDOR — correctly scoped.** Every `[id]` route (`resume`, `applications`, `support`, `jobs`) resolves `currentUser()` first and passes `user.id` into the query rather than filtering after the fetch. Ownership is enforced in the database, not the handler.

**SQL injection — none found.** Ten sites interpolate into query strings; every one interpolates a *fixed internal clause* (`dateFilter` returns a literal `created_at >= $1 and created_at < $2::date …`) while all user values travel as `$N` parameters. Dynamic admin filters build `where` arrays with positional placeholders.

**Payment webhook — textbook.** `app/api/pay/crypto/webhook/route.ts` verifies the NOWPayments IPN signature before parsing, cross-checks the payment against the stored invoice amount and currency, marks mismatches `validation_failed`, and grants premium through a single CTE guarded by `premium_granted_at is null` with `for update`. Duplicate or concurrent callbacks cannot double-grant. This is the most security-sensitive path in the app and it is the best-written one.

**Rate limiting.** Redis-backed atomic `INCR`+`EXPIRE` shared across instances, with a *bounded* in-process fallback (`MAX_LOCAL_BUCKETS = 10_000`) when Redis is down — degrading rather than silently disabling the boundary. Client IP comes from nginx's validated `X-Real-IP`, with an explicit comment on why `CF-Connecting-IP` is never trusted directly. That is a subtle bypass most codebases get wrong.

**Configuration.** `lib/env.ts` fails fast on missing vars and actively refuses to bake `localhost`, a bare IP, or a staging host into canonical URLs during a production build. **No hardcoded secrets** — scans for `sk-…`, AWS keys, and PEM private keys came back empty.

**Data layer.** 26 sequential migrations, **51 explicit indexes**, connection pool bounded at `max: 10` with 5 s connect and 30 s idle timeouts.

**Worker.** Graceful shutdown on SIGTERM/SIGINT that drains in-flight jobs, bounded retries with backoff, refund-on-failure capped at 3 attempts, concurrency from config.

**LLM layer.** `AbortSignal` threaded through every call path, multi-key rotation, abortable sleeps, explicit rate-limit handling.

---

## Recommended order

| # | Action | Effort | Payoff |
|---|---|---|---|
| 1 | Exclude `.next*` in `tsconfig.json`, clear `.next` | 5 min | Restores typecheck |
| 2 | `npm ci` on Linux; stop copying `node_modules` | 15 min | Restores all 6 test suites |
| 3 | `.gitignore` build dirs; commit `tsconfig.jobs-qa.json` | 10 min | Clean `git status` |
| 4 | Structured logging + request IDs | 1 day | Production becomes diagnosable |
| 5 | Error tracking (Sentry or equivalent) | 2 hrs | Failures become visible |
| 6 | Move backup to a queued job | 3 hrs | Removes Docker authority from web tier |
| 7 | Close the 5 VPS hardening items | 1 day | Finishes the security programme |
| 8 | Light theme default + `prefers-color-scheme` | 2 hrs | Design conformance |
| 9 | Split `admin-panel.tsx` | 1–2 days | Testability |
| 10 | Replace boundary `any` with Zod schemas | 2–3 days | Type safety where it matters |
| 11 | Motion system design + implementation | Project | Largest design gap |

Items 1–3 cost under an hour combined and unblock everything downstream. Do them first.

---

## Coverage and limits

**Ran:** full TypeScript compilation; route-by-route authorization inventory (84/84); SQL interpolation scan; secret scan; dependency audit; migration and index inventory; file-size and complexity census; font, theme, and animation-library inspection; git integrity verification.

**Could not run:**

- **The six test suites** — blocked by the esbuild platform mismatch (C2). No pass/fail claim is made anywhere in this report.
- **ESLint** — exceeded the time limit twice against the mounted filesystem. Lint findings are therefore **absent, not clean**.
- **Runtime behaviour** — no database, Redis, or LLM endpoint was available. Concurrency, cache, and queue correctness were assessed by reading code, not by execution. The payment atomicity claim rests on SQL semantics, not an observed race test.

Anything not listed under "Ran" should be treated as unaudited rather than passing.
