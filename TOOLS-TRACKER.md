# New Tools Build Tracker — 10 Tools + Promo System
**Started:** 2026-08-22 · **Goal:** user growth via free tools + SEO + retention loops
**Build order:** dependency-driven — shared engines first, then pages that reuse them.

## Build Order Rationale

```
MatchEngine (lib/match-engine.ts)     ← Tool 1, 6, 9 all consume this
SalaryQuery (lib/salary-data.ts)      ← Tool 2 standalone
RoleQuestionBank (lib/interview-bank) ← Tool 3 standalone
PromoCodes (migration + lib)          ← checkout, independent
Referral Premium Bonus                ← webhook hook, independent
Tool 4 (grade card)                   ← after Tool 1 (uses match output)
Tools 8,10                            ← micro-generator pattern (fast)
Tool 5 Job Alerts                     ← sender fixed 2026-09-03; bulk pool 3×300/day ships dormant until owner adds BULK_* creds
Tool 7 Predictor                      ⏸ data collection starts with tracker (passive)
```

## Status Board

| # | Tool | State | Depends on | Commit |
|---|---|---|---|---|
| E1 | Match engine lib (`lib/match-engine.ts`) — fit %, keyword gaps, missing keywords, evidence check | ✅ DONE | commit 6f3b051. Behavioral test: strong=100, weak=0, hints extracted. Also fixed a JSX syntax error in social-proof-band (comment inside && expression). |
| E2 | Salary data lib (`lib/salary-data.ts`) — percentile SQL over jobs table | ✅ DONE | commit 73d7753, shipped with T2. | |
| T1 | **Resume vs JD Matcher** page `/resume-match` + API | ✅ DONE | commit 1d65d1b. Free, no login, FAQ JSON-LD, nav-wired, funnel CTA to builder. |
| T2 | **Salary Estimator** page `/salaries/[role]/[country]` + hub pages | ✅ DONE | commits 73d7753+73b3d6b. Real ranges from live postings. Sitemap/footer/nav wired in e0b2c0d. 2026-09-03: picker + pages + sitemap include description-extraction markets (GB/IN/DE/…) — see ROLESHARP-PROGRESS.md. | |
| T3 | **Interview Question Bank** `/interview-questions` + `[role]` + API | ✅ DONE | commits 0904b5a+9b1355c. Deterministic bank from roles taxonomy, 3 categories, SEO per-role pages, premium funnel. | |
| T4 | **Resume Grade Card** shareable image after /checker run | ✅ DONE | commit 3073848. `/score-card` OG image route + share entry on `/checker`. | |
| T5 | **Job Alert Emails** | ✅ FIXED 2026-09-03 | commit 30e9d55 (full stack), 0ba0a5b (systemd scheduling: `deploy/rolesharp-job-alerts.service`, 30-min ticks), 00cef83 (the sender had never delivered — bare-ILIKE matching plus a placeholder off-by-one failed every bind; now shared escaped-ILIKE idiom, working `/build?jobId=` CTA). Bulk pool (3×300/day) routes alerts when the owner adds `BULK_*` creds; until then the transactional 75% sub-cap applies. Free=1 weekly, Premium=up to 3 daily. | |
| T6 | **Resume Version Compare** `/resume-compare` + API | ✅ DONE | commit 5034f34. Side-by-side scores, unique-coverage highlights, shared-gaps callout, FAQ JSON-LD, funnel CTA. Uses E1 match engine. | |
| T9 | **Cover Letter Analyzer** lib + API + page | ✅ DONE | lib + API in 3073848; `/cover-letter-analyzer` page shipped with the premium batch (c5d03bc) and hardened later (2e49843, 634a242). | | |
| T7 | **Application Success Predictor** — passive data collection first | 🔶 DATA LIVE | fbd11e6 (tracker outcome accrual + fit score column 057); the predictor tool itself unbuilt until accrual volume justifies it. | |
| T8 | **CV ↔ Resume Converter** micro-generator | ✅ DONE | commits 0958f11 (API+lib) + 9d5bffb (`/cv-converter` page). | |
| T10 | **LinkedIn Headline Generator** | ✅ DONE | commits 0958f11 (API+lib) + 9d5bffb (`/linkedin-headline-generator` page). | |
| P1 | **Promo codes / vouchers**: migration `promo_codes` table + checkout validation + admin CRUD | ✅ DONE | commit d1181b0 (migration 055 + lib/promo-codes.ts + checkout integration + pricing UI entry); admin CRUD shipped in fbd11e6 (admin promo panel + API). | |
| P2 | **Referral premium bonus** | ✅ DONE | commit ab73b3f. Inviter gets +7 days Premium when invited user's first payment grants. Best-effort, only if inviter has active Premium, never blocks the grant. | |

## Design Decisions Log

| # | Decision | Reason | Date |
|---|---|---|---|
| TD1 | All new tools follow the micro-generator pattern (no login, rate-limited, clipboard/export CTA → signup funnel) | proven conversion pattern in repo | 2026-08-22 |
| TD2 | Match engine = deterministic only (no LLM) for the free tool; LLM-enhanced variant can gate to premium later | zero cost at scale; consistent with repo honesty principles | 2026-08-22 |
| TD3 | Salary pages prerendered per country×role from cached query; revalidate weekly | SEO goldmine needs static-ish URLs | 2026-08-22 |
| TD4 | Promo codes: percentage OR fixed-amount off, per-code max redemptions, expiry, single-use-per-user | standard voucher semantics | 2026-08-22 |
| TD5 | Email infra for alerts deferred until Gmail app passwords arrive (owner action) | user decision — own-Gmail pool instead of CF for bulk | 2026-08-22 |

## Verification gates per tool (same every time)
typecheck · lint · npm test · build · live smoke via browse

## Notes
- VPS email: NOWPayments + Cloudflare token live as of 2026-08-22. Gmail SMTP pool pending owner app-passwords.
- MongoDB backup idea noted by owner — future infra change, does not block any tool.
