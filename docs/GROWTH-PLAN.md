# GROWTH PLAN — the Whali teardown, converted into RoleSharp work

> Forward guidance. Written 2026-09-05 after a full crawl of whali.com (12 pages:
> home, pricing, students, media, alternatives hub + one comparison, partnerships,
> brand, docs hub, blog index, flagship data study, robots.txt, sitemaps, llms.txt,
> HTTP headers, JSON-LD extraction). Each play below is grounded in a repo asset
> that already exists or a decision the owner must make. Historical analysis lives
> at the bottom; the phases above it are the working plan.
>
> Owner state as of writing: deploy pending (8 green commits on `main` not yet
> live), GSC validation pending, Brevo bulk creds pending. Nothing in Phase 0 is
> code — it is the gate every other phase waits on.

---

## 0. The strategic read

**Whali monetizes reach: a scraped 275M-profile database feeding automated cold
email from users' inboxes.** It is a distribution machine wrapped around a
mechanic with permanent legal exposure (scraped-profile ToS/litigation risk),
metric inflation (74.7% headline open rate, self-admitted 30–40% Apple MPP
inflation), and modest reality (1.3% tracked replies, 4–7% projected). We cannot
and should not chase it.

**RoleSharp monetizes quality and truth: evidence-honest resumes that survive
ATS contact, and applications whose outcomes the user's own tracker verifies.**
Nobody in this market owns outcome-truthful data. Whali tracks pixels; we log
interviews and offers in the tracker. That is the moat they cannot build without
abandoning their product.

**Growth thesis:** steal Whali's distribution machine — content engine, AEO
layer, partnerships channel, BOFU comparison pages, pricing psychology — and
point all of it at the one claim they can't make: *every number we publish is
verifiable.*

Three engines, in dependency order:

| Engine | What it is | Feeds |
|---|---|---|
| **A. Content + AEO** | Own-data study, docs hub, pillar-cluster blog, BOFU pages, ask-AI layer | B (proof), C (signups) |
| **B. Partnerships + BOFU** | Society channel, comparison pages, press | C (targeted signups) |
| **C. Product loop** | Actively-hiring signals, follow-up evidence, SKUs, success stories | A (data), B (proof) |

---

## 1. The boundary ledger (what we are explicitly NOT building)

Every item here was a Whali play we examined and rejected. This ledger exists so
a future session doesn't re-litigate them.

| Rejected play | Why |
|---|---|
| Scraped contact database ("275M profiles") | ToS/litigation exposure; our model is one deliberate application at a time. |
| Automated cold-email campaigns / follow-up auto-sending | Consent-aware sending is a designed boundary (`docs/JOBS-WORKFLOWS-*`). We draft, the user sends. |
| Inbox pixel tracking (opens/clicks) | We do not read users' inboxes; it also corrupts metrics (MPP). Outcome data from the tracker is better signal. |
| Fabricated or unverifiable testimonials | `/media`-style "illustrative outcomes" — no. Success stories must be opt-in and tracker-verifiable (Phase 5). |
| Self-awarded "#1 platform" claims | Our catalog-vs-outcome distinction (About page) is the brand. A fake superlative would poison it. |
| "#1"-style logo strips implying user outcomes | Our social-proof band shows catalog stats, labeled as such. (Phase 5 can add *verified* outcome stats only.) |
| "Hiring verdict / verified score" pronouncements (StartHack) | Our About page states it: no score can reproduce every recruiter decision. We diagnose and coach; we do not pronounce verdicts on people. |

---

## 2. Phases

### Phase 0 — Unblock distribution (owner, no code) — GATE FOR EVERYTHING
- [ ] Deploy from WSL (`git pull && export ROLESHARP_SSH_HOST=… && bash deploy.sh`) — 8 green commits live
- [ ] GSC "Validate Fix" per failing category; watch the 16,177 404 backlog drain
- [ ] Brevo `BULK_*` creds → job-alerts sender pool live at 3×300/day
- [ ] Calibration cadence decision: say "wire it weekly" and the systemd timer ships
- Exit: all four green. Phase 1+ may start in parallel; nothing *ships* value until 0 lands.

### Phase 1 — Quick wins (agent, ~2 sessions)
Each is small, grounded, and independent:

1. **Ask-AI links** (ChatGPT / Claude / Gemini / Perplexity) on high-value SEO
   pages — salary pages, company×role pairs, blog posts, the homepage FAQ.
   Copy Whali's exact pattern (`?q=` deep links with a persona prompt). New
   `app/ask-ai-links.tsx`, wire into `seo-blocks.tsx` and page templates.
2. **"Actively hiring" badge + filter on `/companies`** — we ingest per-company
   job listings; a `listingsLast30d` count already exists in the data. Badge on
   company cards + filter chip on `/companies`. Pure reuse.
3. **Follow-up cadence evidence line** in the tracker panel copy ("replies peak
   at follow-up 2 — which is why we stop at 2") + `app/tracker/followups-panel.tsx`.
4. **llms.txt enrichment** — current file is minimal; bring it to Whali's
   standard: features, use cases, the student offer, pricing terms, data-study
   pointer (added in Phase 3).
5. **FAQPage schema audit** — we ship `FaqSection` on tool pages; verify every
   rendered FAQ also emits JSON-LD `FAQPage` (Whali emits 10 Q&A on the home
   page; our schema coverage is spottier).
6. **"Credibility check" label on evidence diagnostics** (from the StartHack
   teardown) — they charge for "credibility findings"; we already compute the
   honest version (deal-breaker vetoes, evidence-overlap in STAR, unsupported
   claims). Surface it as a named, labelled block on the checker/tailoring
   diagnostics. Copy + component wiring, not new scoring.

### Phase 2 — Content infrastructure (agent, ~1 week)
6. **`/docs` hub** — consolidate `/build/help`, tool guides, and FAQ blocks
   into one journey-structured hub (getting started → tools → account/billing),
   Whali's 15-guide shape mapped onto our surfaces. Each doc page: one task,
   screenshots optional, JSON-LD `HowTo` where honest.
7. **Blog pillar-cluster restructure** — 24 file posts + DB posts exist.
   Pick 2 pillars (ATS survival; evidence-first applications), rebuild internal
   links (`RelatedWorkflow` already exists), add dated "last verified" lines to
   every data claim.
8. **Tool-comparison BOFU pages** — `content/competitors.ts` already exists;
   `/compare` currently serves company-vs-company. Extend the architecture to
   "RoleSharp vs {generic AI resume builder}" pages: TL;DR, where they're solid
   (gracious, Whali-style), verified feature table with **"verified 2026-09"**
   lines, pick-X-if/pick-Y-if. Accuracy discipline: every vendor fact dated,
   sources linked.

### Phase 3 — Flagship: the RoleSharp Evidence Study (agent, ~2 weeks, staged)
Whali's best asset is "What 6,337 student cold emails reveal." We can build the
honest counterpart: **an outcome-based study from our own aggregates** — no
pixels, no inbox access, tracker-verified.

**Gate first (script, one command):** `scripts/evidence-study-readiness.ts`
counts tracker outcomes (applications, interviews, offers), ATS-score deltas
(fixer/tailor before/after), salary coverage. Decision rule:
- ATS-delta volume ≥ 1,000 paired scores → the study leads with **"What actually
  moves ATS scores"** (we have this volume already).
- Tracker outcomes ≥ 300 applications → add the outcome section
  ("applications → interviews → offers, verified by the applicant's own tracker").
- Both thin → publish the ATS-delta study first; outcomes section ships later
  as "study v2".

Build rules (non-negotiable):
- Aggregates only, k≥30 per cell, no timestamps finer than month, no emails,
  no company names tied to outcomes, methodology section states under-counting
  and limits the way Whali's does (theirs is the only good part of their
  metrics story — copy the *transparency*, not the pixels).
- Ship: one long-form study page (pillared), 3–4 satellite posts, llms.txt +
  ask-AI links point at it, `/press` gets the story angle (press kit exists).

### Phase 4 — Society partnerships (agent builds, owner does outreach)
Whali's 50+ society channel is their distribution moat. Our angle is
complementary, not imitative: their workshop teaches cold outreach; ours teaches
**"get past the ATS, then write outreach that isn't spam."**
9. **`/societies` page** — the offer: free workshop (template provided), guide
   pack, society-branded discount codes. Uses the existing promo-code system
   (admin `PromoPanel` + `/api/admin/promos`).
10. **Workshop kit** — one-page curriculum + slide outline + 3 exercises
    (checker live demo, evidence rewrite, follow-up cadence). Owner decision:
    target society list, discount %, reply-time promise.

### Phase 5 — Monetization & proof experiments (owner decisions required)
11. **7-day Premium pass SKU** — Whali's £9.99/week psychology meets our
    fixed-term, never-auto-renew passes. `lib/env.ts` already drives days/price;
    add a 7-day option + price point (owner sets), Stripe SKU, pricing page row.
    Fits the brand: *an access term, not a subscription*.
12. **Consent-based success stories** — opt-in flow in the tracker ("share this
    outcome, name optional, firm visible or generic"), rendered in
    `social-proof-band.tsx` as a second band with a "verified in tracker" tag.
    Nothing enters the band without a tracker record behind it.
13. **Anonymous guided try-it on the hero** — our tools already work signed-out;
    a 3-step guided path (checker → fixer → generate) on the landing hero,
    ending in "save it — sign up" (save requires auth). Whali's onboarding-demo
    pattern, minus the fake urgency.
14. **Voice mock interview experiment** (from the StartHack teardown) — their
    core differentiator is a 25-min AI *voice* interview scored against your
    resume. Our interview prep already generates questions + STAR scaffolds
    from the same evidence; voice is the missing modality. Honest version: a
    **practice partner** with a per-question coaching readout — never a
    "hiring verdict" (see ledger). Heavy build (realtime voice API cost,
    premium-tier candidate), so it is an experiment behind the same
    premium-gate contract as every other premium surface, and it goes LAST.
    **Full build plan + Google Cloud credit budget: `docs/VOICE-INTERVIEW-PLAN.md`**
    (owner holds ₹28,664 of GCP credits expiring 2026-12-03; the plan is
    turn-based, ~$0.15–0.25/session, with the expiry cliff structurally guarded).

### Phase 6 — Measure & iterate (continuous)
- GSC: clicks/CTR on new pages (docs hub, comparisons, study); index coverage.
- Funnel: blog→signup, signup→first-generation, study→press citations.
- Product: society code redemptions, pass mix (7-day vs 30 vs 365), tracker
  outcome volume (feeds study v2).
- Cadence: monthly progress entry + `npm run check` + full e2e as always.

---

## 3. Sequencing & effort summary

| Phase | Who | Effort | Blocked on |
|---|---|---|---|
| 0 Unblock | owner | ~1 hour | — |
| 1 Quick wins | agent | 2 sessions | — |
| 2 Content infra | agent | ~1 week | — |
| 3 Evidence study | agent | ~2 weeks | Phase 0 (data is prod-side) |
| 4 Societies | agent + owner | 1 week build + outreach | owner time |
| 5 Monetization | owner decisions + agent | decisions 1 evening, build 1 week | owner |
| 6 Measure | both | continuous | — |

Phases 1–2 can run immediately and independently. Phase 3's *build* can start
(readiness script, methodology draft) before Phase 0 lands; its *data* cannot.

---

## 4. Historical evidence — the Whali teardown (2026-09-05)

Preserved for reference; verified on the day it was crawled. Full details were
in the session that wrote this plan; the essentials:

- Company: Whali Technologies Ltd, London, founded 2025 (Viktor Smirnov,
  Zack Price). Positioning: "the #1 job search platform" for students.
- Product: scraped 275M profiles / 65–70M companies → verified emails →
  AI-personalized cold email from user's Gmail/Outlook (OAuth) → automated
  follow-ups (day 0/3/7, stops on reply) → pixel/link/reply tracking → job
  board (1,100+ employers, hourly refresh, 7 markets) → pipeline tracking.
- Pricing: Weekly £9.99 (250cr), Starter £25, Pro £35 (recommended), Max £49,
  Enterprise £499/seat; 3-day trial on all; credits economy; EN+FR; edge
  geo-currency (`NEXT_CURRENCY`).
- Funnel: persona pages (/students, /media), 5 BOFU alternatives pages,
  partnerships channel (50+ societies), /brand press kit, 15-guide docs hub,
  ~118-post blog with a 15-chapter pillar playbook and a 6,337-email primary
  study (published funnel: 74.7% open [30–40% MPP-inflated], 14.6% click,
  1.3% tracked replies, 4–7% projected).
- AEO: per-bot robots.txt for 17 AI crawlers (all allowed on marketing,
  blocked on app), rich llms.txt, FAQPage + SoftwareApplication + Offer +
  VideoObject + Person JSON-LD on home, ask-AI deep links in footer.
- Stack: Next.js App Router + Vercel, Supabase, Stripe; TTFB ~0.8–0.9s;
  home HTML 517KB (heavy); strong CSP/HSTS/DENY headers with
  unsafe-inline/eval script weakening.

## 5. Historical evidence — the StartHack.io teardown (2026-09-05)

Second competitor, crawled same day. **Direct feature-overlap** on two of our
surfaces (resume analysis, resume-based interview prep) — but a far weaker
distribution layer.

- Company: StartHack.io Pvt Ltd, **India-incorporated**; rebrand in progress
  (old domain uval.ai — their robots.txt sitemap still points at
  `uval.ai/sitemap.xml`, socials are `@uval_ai`). Audience: Indian students in
  placement drives / off-campus hiring for SDE, frontend, backend, data roles.
  Claims 4,000+ students.
- Product: upload resume + target role → AI "role alignment report" (strengths,
  weak areas, **credibility risks**, predicted interview questions) → 25-min
  **AI voice interview** → "verified score, hiring verdict, performance
  breakdown." Payments via **Razorpay**; Google/GitHub OAuth.
- Privacy footprint is heavy: audio recordings, transcripts, scoring signals,
  and **screen captures during the interview** "for integrity verification."
  The policy is well-written; the footprint is the moat's cost.
- Distribution layer is minimal: 4-page sitemap (/, /how-it-works,
  /privacy, /terms), no pricing page (404), no blog, no JSON-LD anywhere,
  shadow-DOM SPA (26KB HTML, client-rendered — search engines see almost
  nothing), copy-paste AI-bot robots.txt, stuffed keywords meta tag.
- **Read-across for us:** (a) their SEO is essentially absent — our content
  engine (Phases 2–3) will outrank them on every search that matters; (b) the
  **voice interview** is the one real product gap → Phase 5 item 14, premium
  experiment, practice-partner framing; (c) their "credibility risks" framing
  validates our evidence-overlap work → Phase 1 item 6 makes it a named
  feature; (d) the **India placement-drive wedge** (placement season,
  off-campus keyword cluster) is open — our IN job/salary markets already
  ingest; candidate for the Phase 2 blog cluster; (e) their privacy footprint
  (screen captures, audio retention) is a trust angle our honest-diagnostics
  marketing can contrast against without naming them.
