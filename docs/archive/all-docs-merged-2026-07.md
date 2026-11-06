# RoleSharp — Complete Project Documentation

> All project docs merged into a single file. Sections: README, Scorecard, Security,
> Promotion Plan, Promotion Pack, Project Audit, Launch Plan, Frontend Upgrade,
> Input Audit, Kombai Brief.

---

# 1. README

## RoleSharp

Company- & role-tailored AI resume builder. Pick a company + role, paste a job
description, get an ATS-optimized resume. Built to run on an **8GB RAM / 100GB VPS**
and serve all 195 countries.

### The core idea (why it fits a small box)

You do **not** store the world's jobs (they rot in ~30 days and would need ~40GB+
of churning vectors). You store **finite, slow-changing role norms** (~10K from
O*NET/ESCO/NCO) and a **3-tier company directory**, then tailor against the user's
**pasted JD** — the strongest signal, zero legal risk.

### Storage math (target ~72GB of 100GB)
| Tier | Companies | Per row | Total |
|------|-----------|---------|-------|
| A — deep (embedding + cached careers text) | ~10K | 25KB | ~0.25GB |
| B — embedded (vector only) | ~1.5M | 8KB | ~12GB |
| C — lean (name/SEO only, **no vector**) | ~30M | 2KB | ~60GB |
| Roles (O*NET/ESCO/NCO) | ~10K | 10KB | ~0.1GB |

RAM cost is the **indexes** (name trigram ~2GB + HNSW on A/B ~2GB), not the rows.
Tier C has no embedding → 30M rows cost no vector RAM. See `db/schema.sql`.

### Performance math
- One resume ≈ **4–9s wall-clock**, ~90% spent waiting on the LLM (VPS idle).
- VPS CPU cost ≈ 0.3s/resume with `@react-pdf/renderer` (no headless Chrome).
- Sustained throughput ≈ **13/s on-box (~1.1M/day)**; ~40/s if PDF is offloaded.
- Spikes: Redis queue + **backpressure** (`MAX_QUEUE_DEPTH`) sheds load with HTTP 503
  instead of collapsing (M/M/c: keep utilization ρ = λ/(c·μ) < 1).
- True ceiling is the **LLM API bill / rate limit**, not the 8GB/100GB.

### Stack
Next.js 15 (App Router) · Supabase (Postgres + pgvector) · BullMQ + Redis ·
OpenAI-compatible LLM (point `OPENAI_BASE_URL` at any gateway) · `@react-pdf/renderer`.

### Layout
```
app/
  api/generate/route.ts     POST: enqueue + wait, 503 on backpressure
  api/health/route.ts       liveness + live queue depth
  resume/[company]/[role]/  programmatic SEO page (Google traffic engine)
  build/                    guided builder UI with country, profile completeness, preview
  sitemap.ts robots.ts      indexing
lib/
  tailor.ts                 JD-aware LLM generation + ATS score
  queue.ts worker(../)      service rate μ = WORKER_CONCURRENCY
  pdf.tsx                   pure-JS PDF (fast path)
  db.ts llm.ts types.ts env.ts
db/schema.sql               3-tier companies + roles + users + resumes
scripts/seed-roles.ts       starter role norms (replace w/ bulk O*NET import)
loadtest/generate.js        k6: ramps λ to find p95 / shed point
```

### Run locally
```bash
cp .env.example .env        # fill SUPABASE_*, OPENAI_*, REDIS_URL
# Postgres: run db/schema.sql on your Supabase project
redis-server &              # or docker run -p6379:6379 redis
npm run dev                 # web on :3000
npm run worker              # resume worker (service rate μ)
npm run seed:roles          # seed starter roles (needs DB + LLM key)
```

Password signups require email verification. Configure `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in production before accepting customers.

### Load test (measure the math, don't trust it)
```bash
brew install k6
npm run dev & npm run worker &
BASE=http://localhost:3000 npm run loadtest
# Watch: p95 < 9s = healthy · queueDepth via /api/health · shed_503 rate
```

### Deploy (VPS)
PM2 for web + worker, Postgres+pgvector (or Supabase), Redis, nginx reverse proxy.
Scale throughput by raising `WORKER_CONCURRENCY` or running more `npm run worker`
processes (horizontal). Offload PDF to a serverless function to ~3x capacity.

### Roadmap
- [ ] Bulk company ingest (GLEIF/Wikidata → Tier B/C) + dedupe
- [ ] Bulk role ingest (O*NET + ESCO + India NCO → ~10K)
- [x] Auth + saved resumes
- [x] Cover letter + LinkedIn summary from same JD
- [ ] Sitemap index pagination at >50K URLs

### Country-aware job finder

RoleSharp runs a separate, low-priority Python ingestion service around JobSpy.
It refreshes a bounded Postgres cache for nine launch markets and never scrapes
inside a user request. Listings expire after 30 days, retain source attribution,
and link back to the original application page. `/jobs` reads the cache and can
send a listing into the tracker or pre-fill `/build` with its exact description.

Service: `rolesharp-jobs.service` · script: `scripts/job_ingestor.py` · migration:
`017_jobs.sql`. LinkedIn is off by default; enable only with controlled proxies via
`JOBSPY_ENABLE_LINKEDIN=true` and `JOBSPY_PROXIES`.

---

# 2. SCORECARD

**Date:** 2026-06-22 · Reviewed source + live `https://rolesharp.com`
**Status:** Post SEO + AI-discoverability upgrade.

## Overall: **88 / 100 (B+)** — all code gaps closed; remaining levers are off-page

| Dimension | Start | Now | Grade | Trend |
|---|---|---|---|---|
| SEO & rankability | 86 | 92 | A | ▲ @graph + AI crawlers + llms.txt + enriched pages |
| Accessibility | 77 | 87 | B+ | ▲ ARIA combobox + keyboard nav + focus outline |
| Performance | 85 | 87 | B+ | ▲ CDN cache headers on SEO/sitemap |
| Frontend & UX | 84 | 86 | B+ | ▲ keyboard-navigable autocomplete |
| Code quality & architecture | 82 | 84 | B | ▲ Redis rate-limit, lib fixes landed |
| Conversion & copy | 81 | 81 | B | — (card-payment deferred, owner decision) |

## SEO & rankability — 90 (A−)
Done: programmatic long-tail engine (100k companies × roles); keyword-rich titles;
FAQ/HowTo/Breadcrumb JSON-LD; canonical + OG = rolesharp.com; chunked sitemaps;
rich @graph (Organization + WebSite + WebApplication w/ offers); AI crawlers welcomed;
/llms.txt for answer engines.
Open (off-page): Search Console submission; backlinks/domain authority.

## Performance — 85 (B)
Done: 102kB shared First-Load JS; server-only heavy deps; system fonts; Cloudflare edge.
Open: explicit Cache-Control on static SEO pages + immutable _next/static.

## Frontend & UX — 84 (B)
Done: clear flow, good empty/loading/error states, autocomplete, readiness %,
dark mode, skip-link, consistent free-limit copy (3/month).

## Code quality & architecture — 84 (B)
Done: parameterized SQL; clean lib separation; Zod validation; multi-key LLM rotation;
Redis-backed rate limiting; LLM retry/bad-json + checker clamp fixes.
Open: some `any` typing; mild TOCTOU on weekly quota; no automated tests.

## Conversion & copy — 81 (B)
Done: concrete sample report; clear value prop; transparent pricing; FAQ; credits/referral.
Open: crypto-only checkout (consider adding card); real testimonials once users exist.

## Accessibility — 77 (C+)
Done: skip-link, aria-labels, role=alert, semantic headings, labeled fields.
Open: verify AA contrast; visible focus rings both themes.

## Gap closure (this session)
| # | Gap | Status |
|---|---|---|
| 1 | Accessible autocomplete (ARIA combobox + keyboard) | ✅ done |
| 2 | Thin-content enrichment on /resume/{company}/{role} (2,200 words/page) | ✅ done |
| 3 | Cache-Control headers (SEO/sitemap) | ✅ done |
| 4 | Google Search Console verification | ✅ verification file live |
| 5 | Card payment option (Stripe/Paddle) | deferred |
| 6 | Automated API smoke tests | deferred |

## Top off-page actions (owner only)
1. Google Search Console — add rolesharp.com, submit sitemaps, request indexing.
2. Bing Webmaster Tools — same (also feeds ChatGPT/Copilot).
3. Backlinks — Reddit / LinkedIn / Product Hunt / directories.

---

# 3. SECURITY

**Date:** 2026-06-22

## What was fixed and deployed

### 1. Encrypted sessions (JWE, not just signed)
Session + admin cookies are now JWE: `dir` + `A256GCM` (encrypted and authenticated)
via `jose`, replacing old HS256 signed-but-readable JWT. uid/email no longer
base64-readable. Key derived from AUTH_SECRET (scrypt → 32-byte AES key).
All existing logins were invalidated by the format change.

### 2. Rate limiting now actually works
Root bug: clientIp() read right-most x-forwarded-for, which behind Cloudflare→nginx
is the Cloudflare edge IP. Fix: key on cf-connecting-ip (true client).

### 3. Throttled previously-open expensive routes
| Route | Limit | Why |
|---|---|---|
| POST /api/generate | 8/min/IP | Most expensive (AI + model spend) |
| GET /api/resume/[id]/pdf | 20/min/IP | CPU-heavy render |
| GET /api/resume/[id]/docx | 20/min/IP | CPU-heavy render |
| GET /api/companies/search | 40/min/IP | Unauth + hits Postgres trigram |
| POST /api/account/password | 6/min/IP | Brute-force protection |

### 4. Content-Security-Policy added
default-src 'self'; scripts/styles 'self' 'unsafe-inline'; frame-ancestors 'none';
base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests.
Joins existing HSTS preload, X-Frame DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP.

### Existing protections (confirmed)
- Same-origin enforcement on unsafe methods (middleware.ts).
- scrypt password hashing + timingSafeEqual everywhere.
- httpOnly + sameSite=lax + secure cookies; separate admin cookie (8h TTL).
- Upload size cap 5MB; Zod validation; queue admission gate.
- Cloudflare in front: Full SSL, HSTS, edge cache.

### Manual step left
Add edge rate-limit rule in Cloudflare dashboard: URI Path starts with /api/,
90 requests per 1 minute per IP, action Block 1 minute.

### Recommended next
- Rotate leaked secrets (Cloudflare API token, VPS root password, Supabase token).
- Per-route limits on remaining admin/pay routes.
- Consider Turnstile (free CF CAPTCHA) on signup/login.

---

# 4. PROMOTION PLAN

## Positioning
**One-liner:** RoleSharp builds a resume tailored to the exact company and role
you're applying to — and scores it against the ATS before you hit submit.

**The wedge:** every competitor tailors to a generic JD. RoleSharp tailors to a
named company. Lead with this everywhere.

**Proof points:** 100,000+ companies · 1,000+ roles · free ATS score · resume in ~12s.

## Target audience
- New grads/students → Reddit, college placement cells, LinkedIn, TikTok/Reels.
- Career switchers (2–8 yrs) → LinkedIn, Google search, Reddit.
- International/India-heavy → YouTube, WhatsApp/Telegram groups.

## Acquisition channels (ranked by ROI)

### Tier 1 — do first
1. Free ATS Checker as lead magnet (promote checker, upsell builder).
2. Reddit value-posting (r/resumes, r/jobs, r/EngineeringResumes).
3. Product Hunt launch.
4. Programmatic SEO + hubs (foundation shipped).

### Tier 2 — compounding (week 2–3)
5. Blog/GEO content (2–4/month).
6. Short-form video (TikTok/Reels/Shorts).
7. LinkedIn organic.
8. Referral loop (surface harder).

### Tier 3 — partnerships (week 3+)
9. Directories (AlternativeTo, Futurepedia, SaaSHub, etc.).
10. Partnerships (placement cells, bootcamps, career coaches).
11. Communities (Discord/Telegram/WhatsApp job groups, Quora).

### Tier 4 — paid (only after free channels prove conversion)
12. Small Reddit/Meta/Google Search test budgets.

## Product Hunt launch checklist
- [ ] Tagline: "AI resume tailored to the exact company you're applying to"
- [ ] Logo + 3–5 gallery images + 30–60s demo GIF/video
- [ ] First comment from maker
- [ ] Free tier emphasized (no card)
- [ ] 10–20 friends to upvote/comment first 2 hours
- [ ] Launch 12:01 AM PT, Tue–Thu

## 30/60/90-day calendar
Days 1–30: Search Console, 5 directories, 8–10 Reddit answers, PH launch,
8 short videos, 4 blog posts, daily LinkedIn, add share-after-generate prompt.
Days 31–60: Comparison posts, 10 placement cells/bootcamps, double down winning channel, add card payments.
Days 61–90: Scale 1–2 winning channels, expand programmatic pages, collect real testimonials.

## Brand assets
- Logo: /brand/rolesharp-logo.svg, /brand/rolesharp-icon.svg
- Colors: Navy #1e3a5f, Blue #2563eb, Green #059669, ink #0f172a
- Fonts: Poppins (headings), Open Sans (body)
- Voice: practical, honest, no hype. "Beat the bots. Land the interview."

## Metrics to watch (weekly)
Search Console impressions/clicks/indexed/position; signups; free→generate activation %;
free→premium conversion %; referral invites; top traffic sources.

---

# 5. PROMOTION PACK (Backlink & Directory Submissions)

## Ready-to-paste fields
- **Name:** RoleSharp
- **URL:** https://rolesharp.com
- **Tagline (≤60):** AI resume builder tailored to any company & role
- **Short desc (≤160):** Free AI resume builder and ATS checker. Tailor your resume
  to a specific company, role, and country, with an ATS score before you apply.
- **Long desc (≤500):** RoleSharp is a free AI resume builder and ATS checker.
  Unlike generic builders, it tailors your resume to a specific company, role, and
  country — pulling the exact keywords from the job post and giving you an ATS score
  before you apply. Free tier: 3 tailored resumes/month, PDF, no watermark.
  Premium ($12/mo): 10/month, cover letters, interview prep, LinkedIn writer, DOCX,
  all templates. Country-aware formatting for 200+ markets.
- **Categories:** Career, Productivity, AI Tools, HR/Recruiting, Job Search
- **Email:** support@rolesharp.com

## Directories to submit (free)
General: AlternativeTo, SaaSHub, Product Hunt, BetaList, Crunchbase, SaaSworthy,
ToolPilot, Tool Finder.
AI-tool: There's An AI For That, Futurepedia, AI Tools Directory, Future Tools,
TopAI.tools, AIcyclopedia, AI Scout, Insidr AI, SiteAI, AI Tool Hunt.
Startup/launch: Startup Stash, Launching Next, Startup Ranking, SideProjectors,
Indie Hackers, Uneed, Fazier, Peerlist, dev.to.
Career-niche: reach out to "best resume builders 2026" listicle authors.

Tip: do 5/day, not all at once — bursts look automated.

## Product Hunt launch kit
- Tagline (60 char): A resume that knows the company you're applying to
- Topics: Career, AI, Productivity, Hiring
- First comment: story about why company-specific tailoring matters
- Launch 12:01am PT Tue–Thu. 10+ friends upvote/comment first 2hrs. Reply to every comment.

## Reddit/Quora answer drafts (5 templates)
1. "Why am I not getting interviews?" — keyword mismatch, duties vs results, same resume everywhere.
2. "Best AI resume builder 2026?" — depends on need; mention RoleSharp for company-specific tailoring.
3. "How to make resume ATS-friendly?" — single column, mirror keywords, quantify, PDF.
4. "How to tailor resume for [company]?" — match keywords, reorder bullets, domain language.
5. "Resume red flags that get auto-rejected" — graphic templates, zero keyword overlap, no metrics.

Rules: only post where genuinely helpful, lead with real advice, mention RoleSharp once naturally.

---

# 6. PROJECT AUDIT

**Date:** 2026-06-21
**Result:** 29 confirmed problems. No SQL injection, no auth bypass, no data loss.

## Severity summary
| Severity | Count | Theme |
|---|---|---|
| High | 4 | SEO indexing conflict, admin token lifetime, unauth upload DoS, broken deep-link |
| Medium | 14 | rate-limit gaps, TOCTOU races, fake data, admin crashes, SEO mismatches |
| Low | 11 | cosmetic drift, heuristic scoring, dead code, untyped state |

## HIGH severity
1. robots.ts blocks /build but sitemap submits it → primary CTA never ranks.
2. Admin session token lives 30 days (cookie says 8h but token is replayable).
3. Unauthenticated upload + subprocess, no rate limit → CPU/disk exhaustion.
4. Build page ignores company/role deep-link params → SEO funnel broken.

## MEDIUM severity (summary)
5. In-memory rate limiter doesn't hold across instances.
6. Rate-limit key spoofable (trusts first XFF hop).
7. Weekly limit TOCTOU race (concurrent POSTs bypass quota).
8-10. Premium AI endpoints (cover/interview/linkedin) have no throttle.
11. Checker unauthenticated + unthrottled.
12. admit() backpressure is racy.
13. waitForResume hides 401/404 (user waits ~75s for nothing).
14. Google-only accounts can't delete (demands password they don't have).
15-16. Admin dashboard crashes/hangs on non-200.
17. SITE_URL default disagrees between layout.tsx and env.ts.
18. SearchAction JSON-LD points to non-existent search.
19. Placeholder support email (support@resumeai.local).
20. Fabricated testimonials with "User result" badge.

## LOW severity (summary)
21. companyName falls back to raw slug for LLM.
22. LLM retry burns budget during total outage.
23. Non-JSON 200 mislabeled as key fault.
24. impactScore can go negative.
25. `on conflict do nothing` is dead code.
26. `remaining` display drifts.
27. SEO pages render for any slug (unbounded doorway pages).
28. Marketing stats inconsistent.
29. /api/me failure silently shows logged-out nav.

## What's genuinely solid
- Parameterized SQL everywhere (no injection).
- Auth + entitlement gating on core /generate path.
- PDF/DOCX/payment/email libs — no confirmed issues.
- Worker + import/seed scripts — no confirmed issues.

---

# 7. LAUNCH UPGRADE PLAN

## Goal
Make RoleSharp feel ready to launch: polished frontend, connected user journeys,
reliable page states, strong mobile UX, clear free/premium paths.

## Design direction
Modern professional SaaS, shadcn-inspired, clean light mode, high-contrast
blue/navy with green accent. Plus Jakarta Sans. UX priorities: upload/check first,
country-aware maker, auth-aware nav, visible limits, clear upgrade path.

## Phase 1: Foundation
Design tokens (color, radius, shadow, motion, spacing). Launch-grade nav + footer.
Standardized page shells, cards, empty/loading states.

## Phase 2: Public Product
Homepage (sharper hero, proof points, two-product positioning). Checker (upload-first,
clearer scoring). Maker (multi-step, readiness guidance). Login (split login/signup).

## Phase 3: Logged-In App
Dashboard (sort/filter, empty state, exports). Settings (account, billing, password,
danger zone). Admin (cleaner dashboard, pipeline warnings).

## Phase 4: Launch Essentials
Accessibility pass. SEO pass. Error/loading pass. Responsive pass (375–1440px).

## Phase 5: Verify & Deploy
npm run check + build → deploy to VPS → restart resume-web → full Selenium smoke.

---

# 8. FRONTEND UPGRADE TODO — Tracking

## Phase 1 — Critical Security & SEO Fixes — ✅ DONE
- [x] robots.ts allows /build
- [x] build/page.tsx reads ?company=&role= and prefills
- [x] signToken() accepts maxAge; admin uses 8h
- [x] Upload endpoint rate-limited
- [x] Redis-backed rate limiter
- [x] Client IP fix (cf-connecting-ip)
- [x] JWE sessions, CSP, throttles
- [x] Signup 500 fixed

## Phase 2 — Global Design System — ✅ DONE
- [x] Design tokens in globals.css
- [x] Plus Jakarta Sans font
- [x] Base components (Button, Badge, Card, Input, ScoreRing, Toast, Skeleton, etc.)
- [x] Nav (sticky blur, dark-mode toggle, auth-aware, mobile hamburger)
- [x] Footer (4-col, real links, dark navy bg)

## Phase 3 — Homepage & Marketing — ✅ DONE
- [x] Hero, two CTAs, animated ATS mockup, social proof
- [x] Two-product section, How-It-Works
- [x] Remove fake testimonials, fix stat inconsistency
- [x] Remove SearchAction JSON-LD
- [x] Pricing page, Contact page

## Phase 4 — Checker UX — ✅ DONE
- [x] Upload-first drag-drop, progress bar
- [x] Animated ScoreRing, breakdown accordion
- [x] Free-limit prompt, error handling, mobile

## Phase 5 — Builder Step Wizard — ✅ DONE
- [x] 5-step wizard + progress indicator
- [x] Step1-5 complete (Profile, Target, Experience, Education/Projects, Template)
- [x] Live preview rail, mobile modal, autosave + toast

## Phase 6 — Logged-In App — ✅ DONE
- [x] Dashboard (card grid, stats, upgrade banner, empty state, sort)
- [x] Settings (tabbed, Google-only fix, delete-confirm)
- [x] Admin (crash fix, error+retry, charts)

## Phase 7 — SEO Pages + Accessibility — ✅ DONE
- [x] SEO page notFound() guard, enriched content
- [x] companyName slug→display name
- [x] A11y (aria comboboxes, contrast, focus-visible, skip link, 44px targets)

## Phase 8 — Mobile + Polish — ✅ DONE
- [x] Mobile pass 375px all pages
- [x] 10 micro-interactions + prefers-reduced-motion
- [x] Dark mode verification
- [x] Final QA, typecheck, lint

---

# 9. FRONTEND INPUT AUDIT (Build Form vs Best-in-Class)

Compared /build form against: Zety, Resume.io, Kickresume, Teal, Rezi, Enhancv, Novoresume.

## Best-in-class pattern
1. Structured repeatable entries (each job/school = its own card with separate fields).
2. One step on screen at a time (wizard).
3. Import to pre-fill (upload PDF/DOCX or LinkedIn).
4. Inline guidance, not format rules.
5. Live preview next to form (we have this ✓).
6. Minimal required fields.

## Our problems (ranked)

### 🔴 High
1. Pipe-separator formats (Education = `Degree | School | Year | Details`) — users
   don't read the hint. → Replace with structured repeatable rows.
2. Blob textareas for multi-item sections — no structure, hard to reorder. → Repeatable cards.
3. No import/pre-fill — highest friction. → Add "Upload PDF/DOCX to pre-fill."

### 🟠 Medium
4. Everything on one tall page → step wizard.
5. "Professional summary facts" is jargon → rename "About you" + offer AI draft.
6. Skills as free-text CSV → add role-based suggested-skill chips.
7. Country selected twice → show read-only from gate.
8. Phone & links unvalidated → light inline validation.

### 🟡 Low
9. No per-section scoring nudges.
10. Template picker buried at bottom → own final step with thumbnails.
11. No "see a filled example" toggle.

## What we do well (keep)
- ✅ Country-aware gate
- ✅ Company + role autocomplete with full keyboard a11y
- ✅ Live preview rail + readiness %
- ✅ Autosave draft to localStorage
- ✅ Tailored to a named company (unique differentiator)

## Recommended build order
1. Structured Education & Projects (kill | format)
2. Repeatable Experience entries with +Add bullets
3. PDF/DOCX import to pre-fill
4. Step wizard
5. Suggested-skill chips
6. Remove duplicate country; rename summary; inline validation

---

# 10. KOMBAI BRIEF (Full Frontend Redesign)

## Project facts (do not break)
- Stack: Next.js 15 App Router, React 19, TypeScript, plain CSS with design tokens
  in globals.css (NOT Tailwind).
- Routes must keep working: / /build /checker /tracker /dashboard /blog /pricing
  /login /settings /companies /roles /about /contact /terms /privacy /refund /support.
- Do NOT touch: fetch("/api/...") calls, auth/session logic, resume generation flow,
  /api/geo, entitlements, JSON-LD/SEO scripts.
- Reuse: app/icons.tsx (SVG icons, NEVER emoji), components/ui/* (CountryPicker,
  ScoreRing, StepWizard, Toast, RepeatableCard, EmptyState, Skeleton).
- Keep Lighthouse 100/100/100/100.

## Brand & visual language
- Colors: primary blue #1d4ed8, hover #1e40af, navy #1e3a5f, success #059669,
  bg #f8fafc, surface #ffffff, text #0f172a, muted #334155, border #cbd5e1.
- Fonts: Poppins (headings), Open Sans (body).
- Feel: clean, whitespace, confident typography, real screenshots, ONE clear CTA
  per section. Avoid purple gradients, glassy blur, emoji icons, centered-everything.
- Radius 12–16px cards, shadow soft, buttons 44px min height.

## "Human, not AI-made" principles
- Replace vague copy with specific concrete lines.
- Show real artifacts (resume screenshots, ATS report, real company names).
- Vary section layouts (don't repeat 3-card grid).
- No fake testimonials/logos — use honest trust signals.
- NEVER use India-only examples.

## Homepage sections (top → bottom)
1. Sticky nav  2. Hero (2-col)  3. Trust bar (company name chips)
4. Differentiator split  5. Product screenshots  6. How it works (4 steps)
7. Features (mixed layout)  8. Use cases  9. Pricing  10. FAQ  11. Final CTA  12. Footer

## Builder redesign
Clean 2-column workspace: slim top bar + step wizard (Profile → Target → Evidence →
Generate → Export) + left form + right sticky preview. After generate: result card
with ATS score + export buttons.

## Checker redesign
Left: paste-resume + optional fields. Right (after check): score report card with
ScoreRing, grade, breakdown bars, keyword coverage, strengths vs fixes, CTA to /build.

## Components to produce
Nav, Footer, Hero, TrustBar, FeatureSplit, StepsRow, PricingTable, FaqAccordion,
CtaBand, ScoreReportCard, ResumeMockup, SectionHead.

## Acceptance criteria
- Looks distinct per section (no repeated filler).
- No emoji icons; SVG from icons.tsx.
- No India-only examples.
- Lighthouse 100/100/100/100; CLS ~0; schema intact.
- All routes render and buttons work.
