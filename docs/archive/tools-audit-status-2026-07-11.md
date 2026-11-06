# RoleSharp Tools — Audit Status Map (2026-07-11)

Scope: every user-facing "tool" (analysis/generation engine) and its API route. Auth/DB/payment security was covered by the earlier SECURITY-AUDIT sprint; this map is about the **tool logic** — scoring correctness, gaming resistance, ReDoS, parse safety, and i18n honesty.

> **STATUS 2026-07-12:** All local tool-audit items below are **complete**. Tables match the resolution evidence. Remaining open work is **VPS operational only** (see `SECURITY-REMEDIATION-TODO.md` Phase 5).

## Legend
✅ audited & hardened · 🟡 partial / known gaps · ⬜ not yet audited

## Analysis tools (score user input)

| Tool | Engine | Route | Status | Notes |
|---|---|---|---|---|
| ATS resume checker | `lib/resume-checker.ts` | `/api/check-resume` | ✅ | Full hardcore audit: ReDoS fixed, JD-copy + duplicate-bullet gaming blocked, unicode bullets, non-English honesty. See `checker-audit-2026-07-11.md`. |
| Resume file upload | poppler/docx extract | `/api/check-resume/upload` | ✅ | Clean: `execFile` (no shell), 10s timeout, size/buffer caps, temp cleanup, ext+mime gating. |
| LinkedIn checker | `lib/linkedin-checker.ts` | `/api/check-linkedin` | ✅ | Unicode bullets + dedup + **JD-copy penalty** + keyword coverage + 40K input cap (ported from resume checker). |
| Generated-resume score | `lib/resume-checker.ts` (shared) | worker/generate | ✅ | Same engine as checker — inherits all fixes. |
| Live builder meter | `lib/ats-score.ts` → checker | client | ✅ | Delegates to the hardened checker; meter ≡ final score. |

## Generation tools (LLM passthrough — different risk profile)

These don't *score* input, they generate from it. Main risks are prompt-injection, cost/abuse, and output validation — not ReDoS/gaming.

| Tool | Route | Status | Evidence |
|---|---|---|---|
| Resume tailor | `/api/generate` | ✅ | Rate-limited, entitlement-gated, evidence-guarded output, abort + local fallback. |
| Cover letter | `/api/cover` | ✅ | Auth + `rateLimit(..., 10)` + premium/entitlement path; deterministic/local gen, bounded body. |
| Bullet improver | `/api/improve` | ✅ | Auth + rate limit (30) + `spendActionCredit` / refund on failure + zod max lengths + output slice(0,400). |
| Interview prep | `/api/interview` | ✅ | Auth + rate limit (10) + ownership-scoped resume use; deterministic prep content. |
| LinkedIn summary gen | `/api/linkedin` | ✅ | Auth + rate limit (10) + stored LLM output capped at 2000 chars. |
| Cover/docx/pdf export | `/api/manual-export/*`, `/api/resume/[id]/*` | ✅ | **No IDOR:** `getUserResume(id, userId)` filters by owner. Manual export renders caller-supplied body. Free-template restriction for anon PDFs. Rate limits present. |

## Recommended next passes (priority order)

All four local passes are **done**. Operational leftovers live under VPS hardening only.

1. ~~Ownership check on export/detail routes~~ — ✅ `getUserResume(id, userId)`; no cross-user path.
2. ~~Port checker guards to LinkedIn checker~~ — ✅ JD-copy + keyword/fail checks + 40K cap.
3. ~~Generation-tool abuse sweep~~ — ✅ cover/improve/interview/linkedin all auth + rate-limit + entitlement/credit + output caps.
4. ~~Load/ReDoS sweep of remaining regex-heavy libs~~ — ✅ real find fixed in `lib/student.ts` email parse.

### Still open (not app code — production ops)

See `SECURITY-REMEDIATION-TODO.md` Phase 5 and `deploy/VPS-HARDENING-RUNBOOK.md`:

- Encrypted off-host Postgres backup + restore drill
- SSH password/root lockdown (after alternate access proven)
- Cloudflare-only origin / tunnel for 443
- Pending OS updates + reboot
- Post-change full verification of services/firewall/backups/SSH

## Done (ready to commit with related security work)
- `lib/resume-checker.ts` — ReDoS + gaming + fairness + i18n
- `lib/linkedin-checker.ts` — unicode bullets + dedup + JD-copy penalty + 40K cap
- `lib/student.ts` — ReDoS fix in `isAcademicEmail`
- `app/api/linkedin/route.ts` — cap stored LLM output at 2000 chars
- `docs/checker-audit-2026-07-11.md`, `docs/tools-audit-status-2026-07-11.md` (this file, tables aligned 2026-07-12)

## Resolution of the 4 "what's left" items (all done)
1. **IDOR export/detail** — ✅ verified clean. `getUserResume(id, userId)` filters `user_id_text`; manual-export renders body content (own data). No cross-user access path exists.
2. **LinkedIn gaming guards** — ✅ ported (JD-copy penalty + fail check, 40K cap).
3. **Generation-tool abuse sweep** — ✅ cover/improve/interview/linkedin all auth+rate-limit+entitlement+output-cap. cover & interview are deterministic (no LLM). Added linkedin output cap.
4. **ReDoS grep** — ✅ swept `lib/*` regexes. One real find (`student.ts` email) fixed. `email.ts` `(.*)<>` runs on trusted config only. All checker/tailor regexes are single-class quantifiers (linear).
