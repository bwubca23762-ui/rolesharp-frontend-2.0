# RoleSharp versus Kickresume competitive benchmark and gap report

> **Audit date:** 2026-08-03  
> **Scope:** Public product, conversion, trust, distribution, retention, and claim-quality surfaces  
> **Operating constraint:** Research and recommendations only. No source, deployment, or production-setting changes were made.  
> **Evidence standard:** RoleSharp statements are based on repository behavior and public-page source. Kickresume statements are competitor self-reports captured from public pages and should not be treated as independently verified outcomes.

## Executive conclusion

RoleSharp should not try to become a smaller Kickresume. Its strongest position is materially different: a job-specific operating system for careful applicants, built around company-, role-, country-, and job-description-specific tailoring; recurring free utility; unlimited free ATS checks; transparent fixed-term pricing; job-to-resume-to-tracker continuity; international support; and conservative Auto Apply safeguards.

Kickresume's advantage is not one isolated feature. It is a mature public distribution and proof system that repeatedly shows the product, routes search traffic into relevant product actions, supplies broad template and real-world example inventory, and reinforces authority through named experts, reviews, certifications, press, research, and native mobile continuity. RoleSharp already has meaningful workflow depth, but too much of that depth is visible only after authentication or is described rather than demonstrated.

The immediate priority is **claim integrity**, not feature copying. RoleSharp's live Kickresume comparison contains several stale or contradicted assertions in `../lib/competitors.ts`. Those assertions are rendered into a high-intent comparison page, pricing copy, FAQs, verdict counts, metadata-related content, and an AI-readable Markdown twin through `../app/compare/[slug]/page.tsx`. This is a critical trust and governance gap.

The next priorities are to make existing RoleSharp value visible before registration, strengthen proof without manufacturing authority, and convert current role/company/job content into a more coherent search-to-product journey. Template breadth, full visual examples, public workflow demonstrations, and mobile retention are real gaps, but they should be sequenced behind factual correction and activation improvements.

The strategic rule is explicit:

> **Do not weaken RoleSharp's Auto Apply safety model.** Recipient verification, explicit posting consent, cooldowns, caps, duplicate protection, delivery-state honesty, and fail-closed behavior are durable differentiators. Faster or broader automation is not worth creating user, employer, platform, or reputation risk.

## Method and evidence model

### Evidence classes

| Class | Meaning | Examples in this audit |
|---|---|---|
| A — Repository-verified | Behavior or copy directly present in RoleSharp source | Free-plan limits, pricing FAQs, tracker states, authentication flow, comparison data |
| B — Competitor self-report | Claim currently displayed on a Kickresume-owned public page | Template count, pricing, user count, ratings, student access, mobile availability |
| C — Audit inference | Conclusion drawn from observed information architecture or absence in searched scope | RoleSharp demonstrates less of the tracker publicly; no PWA signal found in searched app source |
| D — Unresolved or volatile | Conflicting captures, dynamic offers, locale-sensitive values, or claims requiring further confirmation | Kickresume price discrepancy across captures |

### Decision criteria

The benchmark evaluates whether each page family helps a visitor:

1. Discover a relevant solution.
2. Understand what the product actually does.
3. Reach useful value with low friction.
4. Understand when registration is required.
5. Predict the free and paid boundaries.
6. Trust the company and its claims.
7. Find an appropriate template or example.
8. Move from informational search intent into product use.
9. Continue from job discovery through application management.
10. Return across devices and over time.
11. Use automation safely and evaluate comparisons accurately.

## Task #12: structured 11-dimension benchmark

| Dimension | RoleSharp | Kickresume | Assessment | Priority implication |
|---|---|---|---|---|
| 1. Acquisition | Strong differentiated proposition around job-, company-, role-, and country-specific tailoring; recurring free allowance; free ATS checks; country, role, company, job, comparison, and utility surfaces. | Broad category ownership across resume builder, checker, AI writer, tailoring, templates, examples, cover letters, job board, tracker, mobile, guides, reports, and comparison content. Strong cross-linking among these surfaces. | Kickresume leads in reach and surface breadth. RoleSharp has a sharper core promise but less mature distribution. | Consolidate RoleSharp's differentiation into search-to-product paths instead of merely adding more undifferentiated pages. |
| 2. Product demonstration | Core workflows exist, but several public surfaces describe functionality with limited screenshots or representative output. The logged-out tracker is primarily an authentication gate. | Public pages repeatedly show screenshots, template previews, workflow illustrations, example outputs, and direct template/product actions. | Kickresume leads clearly. | Highest non-claim quick win: demonstrate existing value before asking for trust or registration. |
| 3. First value | Unlimited ATS checks and recurring free tailoring create substantial ongoing utility. The free plan can support a real job search rather than only a one-time test. | Free creation and downloads are possible when users stay within free customization options; free score and limited tailoring are available, while advanced analysis/customization is paid. | RoleSharp leads in recurring functional utility; Kickresume leads in visual confidence and breadth of entry points. | Protect the recurring-free position and shorten the path from landing page to a visible, personalized result. |
| 4. Registration timing | Public information and checker entry points are available; protected destinations preserve intent through a safe `next` path. Signup may require email verification before continuation; Google login is supported when configured. | Public browsing, template previews, examples, and product education are extensive. Creation actions ultimately route to registration. | Mixed. RoleSharp preserves destination intent well; Kickresume gives more pre-registration product confidence. | Keep intent preservation. Add previewable proof so registration feels like continuation rather than a leap of faith. |
| 5. Free-to-paid boundary | Public and explicit: 3 tailored resumes per month, unlimited ATS checks, LinkedIn checker, manual maker, PDF downloads, no card. Premium is $12/month, adds 10 tailored resumes, cover letters, interview prep, LinkedIn summary, DOCX, and all templates. Premium is a fixed-term pass with no auto-renewal. | Public page says free resumes can be downloaded with free customization options; paid customization is labeled in the app. The checker provides a free score with deeper analysis promoted as Premium, and tailoring has a limited free use followed by Premium access. Students can receive free access through ISIC, ITIC, or UNiDAYS. | RoleSharp leads in transparent, recurring usage and non-auto-renewal clarity. Kickresume offers more free design access than RoleSharp's comparison currently acknowledges. | Preserve pricing transparency. Remove outdated simplifications about Kickresume's free tier and student offer. |
| 6. Trust and proof | Honest pricing, explicit limits, contact/support paths, safety-oriented application states, and a willingness to credit competitor strengths are strong foundations. Public proof remains comparatively thin. | Named experts and career writers, testimonials, review-platform and app-store ratings, press/research surfaces, CPRW/PARWCC signals, GDPR messaging, and penetration-testing claims. | Kickresume leads substantially in public authority architecture. | Build evidence gradually: named methodology owners, transparent research notes, sourced examples, security/process disclosures, and permissioned outcomes. Do not fabricate social proof. |
| 7. Templates and examples | Six templates. `/resume-examples` is principally a programmatic role-guide hub linking to `/roles/[slug]`, with keywords, bullet guidance, ATS advice, and builder calls to action rather than a large library of complete visual resumes. | Advertises 40+ resume templates, category landing pages, previews, and direct “Use Template” actions. Public examples are described as resumes from real people who got hired; public surfaces make varying 1,500+ and 3,000+ inventory claims. | Kickresume leads decisively in visual choice, browsability, and example proof. | First improve presentation and coverage of the existing set; then add carefully selected ATS-safe variants and permissioned, redacted full examples. |
| 8. Content and SEO | Broad programmatic coverage across roles, companies, countries, jobs, comparisons, blog, and utilities. Differentiation is strongest where pages route into tailored generation, but some company-specific content has limited sourced evidence. | Mature editorial and programmatic system spanning examples, profession categories, templates, how-to guides, reports, statistics, comparisons, and tool roundups, with dense cross-product navigation. | Kickresume leads in scale and topic-to-product distribution. RoleSharp has a strong data model for more specific intent. | Improve source quality, reduce generic repetition, and make each page family route to a uniquely relevant product action. Avoid content-volume imitation. |
| 9. Job-search continuity | Strong conceptual and functional chain: jobs → tailored resume → cover letter/interview prep → tracker/dashboard. Tracker supports statuses, URLs, notes, linked resumes and ATS scores, follow-up dates, email attempts, provider state, and explicit unknown-outcome handling. | Publicly markets a connected job board, tracker, resume tailoring, cover letters, ATS checking, and interview preparation. | RoleSharp is competitive or stronger in safety-aware workflow depth; Kickresume is stronger at publicly demonstrating the integrated system. | Treat continuity as a flagship narrative. Demonstrate it with an end-to-end public walkthrough and instrument handoffs between stages. |
| 10. Mobile retention | Responsive web presence, but no native app, app-store distribution, or PWA manifest/service-worker/install prompt was discovered in the searched `app/**/*.{tsx,ts}` scope. This is an absence-of-evidence finding, not proof across every file or deployed asset. | Native iOS and Android apps, app-store links, Premium mobile access, and cloud synchronization are publicly promoted. | Kickresume leads clearly. | Validate mobile job-seeker demand before funding native apps. Near-term focus should be mobile web quality, return paths, saved-state continuity, and compliant reminders. |
| 11. Safety and claim quality | Strong Auto Apply safeguards and honest delivery states are a genuine advantage. However, the stale Kickresume comparison undermines RoleSharp's “honest comparison” position and contaminates verdict counts and AI-readable content. | Kickresume states that tailoring uses existing CV information rather than inventing experience. Competitor marketing claims, counts, ratings, and prices remain self-reported and volatile. | RoleSharp leads in application-safety design but currently has a critical comparison-claim governance failure. | Correct stale claims first. Add source-level dates, evidence fields, review owners, expiry rules, and neutral handling for volatile facts. |

## Page-family comparison matrix

| Page family | RoleSharp evidence | Kickresume evidence | Current leader | RoleSharp opportunity |
|---|---|---|---|---|
| Homepage/acquisition | Specific tailoring and free-utility proposition; connects jobs and career tools. | Large product menu, strong social proof, multiple calls to create a resume, visual product presentation, broad feature ecosystem. | Kickresume | State the differentiated job-specific workflow more concretely and show the resulting artifact. |
| Pricing | Public free/Premium limits, $12 monthly plan, annual option, student offer, fixed-term pass, no auto-renewal, no card for free use. | Public free-download rules, student access, dynamic promotional pricing, ratings, security claims, screenshots, and feature inventory. | RoleSharp for clarity; Kickresume for proof and merchandising | Retain simple terms; add dated comparison methodology rather than brittle price slogans. |
| Templates | Six focused templates with ATS-safe positioning. | 40+ advertised templates, categories, previews, matching cover-letter designs, fonts/colors, and direct actions. | Kickresume | Improve preview, filtering, fit guidance, and evidence for ATS-safe choices before expanding indiscriminately. |
| Resume examples | Programmatic role guides and generated guidance; not primarily complete visual examples. | Large visual library described as real hired-user resumes, with profession/category search paths. | Kickresume | Add complete redacted examples with provenance labels and “tailor this structure” actions. |
| Role/company/country pages | Highly specific intent model and direct relevance to RoleSharp tailoring; country support is a differentiator. Company pages need stronger sourced specificity. | Broad profession and guide ecosystem, but less differentiated around company/country targeting in the audited surfaces. | RoleSharp potential; mixed execution | Strengthen evidence and unique company/country value; avoid generic SEO substitutions. |
| ATS checker | Unlimited free checks are a strong recurring acquisition and activation loop. | Free score and a publicly demonstrated checker; deeper word analysis is presented as Premium. | RoleSharp for free utility; Kickresume for demonstration | Show sample report anatomy, score methodology, limitations, and a before/after path into tailoring. |
| Tailoring | Company + role + country + job-description generation is central, recurring, and connected to ATS scoring. | Dedicated job-ad tailoring accepts job title, company name, and full ad; public page says it uses existing CV information and does not invent experience. One free use is advertised. | RoleSharp on recurring utility and country-aware positioning; no defensible “Kickresume cannot tailor” claim | Compare scope, limits, evidence, and workflow honestly rather than using a false binary. |
| Jobs and tracker | Functionally meaningful internal continuity; tracker has status, notes, URLs, linked resumes/scores, follow-ups, application email ledger, and safe provider-state language. Public logged-out demonstration is minimal. | Public job board/tracker pages present an integrated workflow with screenshots and links to adjacent tools. | RoleSharp functionality is competitive; Kickresume public presentation leads | Publish a privacy-safe interactive or illustrated walkthrough of the lifecycle. |
| Cover letter/interview | Integrated Premium features use resume/job context. | Broad product and editorial surfaces for cover letters and interview preparation. | Mixed; Kickresume distribution leads | Demonstrate contextual continuity rather than competing on generic generator breadth. |
| Student offer | Six months of Student Premium after academic-email verification. | Free student access through ISIC, ITIC, or UNiDAYS according to the public pricing page. | Different eligibility models; no simple winner | Compare eligibility, duration, verification, and included features precisely. |
| About/trust | Product transparency and safety behavior are meaningful but limited public authority proof. | Named experts, reviews, certifications, media/research, privacy, and security claims. | Kickresume | Build verifiable authority assets tied to RoleSharp methodology and user outcomes. |
| Comparison pages | Crediting competitor strengths is the right editorial pattern; comparison data is centralized. | Kickresume also operates comparison/editorial surfaces in a larger authority ecosystem. | RoleSharp pattern is promising but claim freshness is currently critical | Add evidence governance before expanding the comparison library. |
| Mobile | Responsive web only in discovered evidence. | Native iOS/Android and cloud sync. | Kickresume | Validate retention need, then sequence mobile web, installability, and native investment based on data. |

## RoleSharp advantages to defend

### 1. Job-specific tailoring depth

RoleSharp's company-, role-, country-, and job-description-specific model is a clearer application outcome than a generic “AI resume” promise. It should remain the center of the product story, with substantiated demonstrations of what changes and why.

### 2. Recurring free utility

Three tailored resumes each month and unlimited ATS checks make the free plan an ongoing job-search tool. This is strategically stronger than a trial that only demonstrates interface quality. Preserve this boundary unless usage economics prove it unsustainable.

### 3. Transparent, non-auto-renewing Premium

A fixed-term pass with visible limits and no automatic renewal is unusually clear in a category where billing anxiety can be high. Treat this as a trust feature, not merely a pricing detail.

### 4. International and country-aware workflow

Country specificity can be more defensible and useful than adding decorative template volume. It creates a natural information architecture across country guidance, role expectations, jobs, and tailored output.

### 5. Job-to-application continuity

The combination of jobs, tailored documents, ATS scoring, cover letters, interview preparation, dashboard, and tracker gives RoleSharp the basis for a coherent job-search workspace rather than a collection of isolated generators.

### 6. Conservative Auto Apply safety

RoleSharp's narrow email-application model, recipient verification, posting-consent requirement, caps, cooldowns, duplicate protection, and fail-closed behavior protect users and employers. The tracker wording also distinguishes provider acceptance from verified delivery and disables automatic resend when the outcome is unknown. This is a product and trust advantage.

## Prioritized gaps

### Critical

#### C1. Stale and contradicted Kickresume claims are published as facts

**Evidence:** `../lib/competitors.ts:104-160` contains claims including “1 free resume total,” `$19/mo`, “No” company-specific tailoring, paid ATS checking, and student “Discount.” `../app/compare/[slug]/page.tsx` renders the data into verdict text, comparison rows, pricing, source notes, and FAQs; it also advertises a Markdown alternate for AI crawlers.

**Finding:** Several assertions are contradicted or materially qualified by Kickresume's current public pages. This creates legal, SEO, brand, and user-trust exposure.

**Path:** Correct and neutralize the claims before new competitor content or major feature work. Add a repeatable freshness policy.

#### C2. Claim freshness has no effective guardrail

**Evidence:** The data comment says claims must remain defensible and were last checked in July 2026, yet a fresh audit found material mismatches.

**Finding:** A human-readable “last checked” note without structured evidence, ownership, or expiry does not prevent stale publication.

**Path:** Introduce structured source URLs, capture dates, claim status, volatility, owner, review date, and expiry/fail-closed behavior when implementation is authorized.

### High

#### H1. Existing product depth is under-demonstrated publicly

The tracker, dashboard, tailoring, and application-state logic are stronger than their logged-out presentation. Visitors must accept important claims without enough screenshots, examples, or walkthroughs.

#### H2. Trust architecture is too thin for a high-stakes career product

RoleSharp's transparency is valuable, but it lacks Kickresume's layered public proof. The answer is not invented testimonials; it is permissioned outcomes, named methodology ownership, sourced research, changelogs, security/process explanations, and clearer limitations.

#### H3. Templates and “examples” do not yet satisfy visual browsing intent

A visitor searching for examples often expects complete documents, visual previews, and immediately reusable structures. RoleSharp's role guides are useful but should not be positioned as equivalent to a large visual example library.

#### H4. Content pages do not consistently complete the search-to-product loop

RoleSharp has a broad page inventory, but high page count only becomes an advantage when each family supplies unique evidence and carries its context into a relevant tool action.

### Medium

#### M1. Mobile retention is weaker

No native app or installable PWA signal was found in the searched scope, while Kickresume promotes native applications and cloud sync. Native development should follow validated retention demand, not competitor imitation.

#### M2. Template breadth is narrow

Six templates constrain browsing and use-case fit, especially for users who evaluate builders visually. However, expanding to dozens of near-duplicates would dilute RoleSharp's ATS-safe position.

#### M3. Public methodology needs more explanation

ATS scoring, country-aware recommendations, company relevance, and generated bullet guidance should disclose data sources, limitations, and how recommendations are produced at a user-comprehensible level.

#### M4. Registration interrupts some high-intent workflows before enough proof is visible

Intent preservation through `next` is good. The larger issue is whether users have seen enough representative value to justify account creation and email verification.

### Low

#### L1. Match Kickresume's total product-menu breadth

A long list of generators is not intrinsically strategic. RoleSharp should only add adjacent tools that strengthen the core application workflow.

#### L2. Match decorative customization volume

Millions of design combinations are not necessary for RoleSharp's target position. Clear, recruiter-readable, ATS-safe fit guidance is more important.

#### L3. Produce native apps solely for parity

Native apps are expensive distribution and maintenance commitments. Retention data should justify them.

## Dedicated stale-competitor-claims correction section

### Immediate correction inventory

| Current RoleSharp assertion | Current evidence status | Required correction direction | Risk |
|---|---|---|---|
| “Kickresume gives you 1 free resume total” | Contradicted by Kickresume's pricing FAQ, which says users can create and download for free while using free customization options. | Replace with a precise free-boundary description. Do not convert “free customization” into an unsupported numeric allowance. | Critical |
| “Free PDF download: Limited” | Too vague and potentially misleading. Kickresume says downloads are free with free customization options and unlimited in count, while advanced customization requires Premium. | State the customization boundary and capture date. Verify actual in-product export behavior before claiming format or watermark details. | High |
| “Kickresume premium: $19/mo” | Volatile and ambiguous. On 2026-08-03, the fetched English pricing page displayed list prices of $24 monthly, $18/month quarterly, and $8/month yearly, discounted 20% to $19.20, $14.40, and $6.40. Earlier audit context reported a different set: $9, $6, and $4 list, discounted to $7.20, $4.80, and $3.20. | Do not assert one timeless price. Reconfirm from a controlled locale/session, record currency, billing total, taxes, and offer expiration, then publish a dated table or avoid volatile headline arithmetic. | Critical |
| “Tailors to a specific company: No” | Contradicted by Kickresume's resume-tailoring page, which requests job title, company name, and full job ad. | Compare actual tailoring scope and limits rather than using a binary “No.” RoleSharp can still differentiate on recurring allowance, country context, integrated ATS scoring, or demonstrated output quality if verified. | Critical |
| “ATS score included free: Kickresume Paid” | Contradicted/oversimplified. Kickresume publicly promotes a free score, while deeper word analysis is described as Premium. | Use a layered description: free score versus paid depth, with exact current boundaries verified in product. | Critical |
| “Student offer: Discount” | Contradicted by Kickresume's pricing FAQ, which says Kickresume is free for students verified through ISIC, ITIC, or UNiDAYS. | Describe each product's eligibility, duration, verification path, and included features. Avoid declaring a winner without like-for-like evidence. | Critical |
| “A monthly free tier, not a one-time freebie” | Built on the contradicted one-resume premise. | Preserve RoleSharp's recurring-allowance advantage but remove the “one-time” characterization. | High |
| “Kickresume helps you fill a beautiful template” as the effective contrast to tailoring | Materially incomplete because Kickresume operates AI writing and tailoring products. | Credit Kickresume's active tailoring and AI products; distinguish RoleSharp on its specific workflow and constraints. | High |
| “Cheaper premium, better student deal” | Depends on volatile prices and non-equivalent student eligibility models. | Reframe as dated pricing/terms comparison. RoleSharp's defensible advantage is public fixed-term, non-auto-renewing pricing; “better” requires defined criteria. | High |
| Source note: “last checked July 2026” | Insufficient and now demonstrably stale or incomplete. | Cite source URLs per claim, capture date, locale/currency, and a review/expiry date. | Critical |

### Pricing discrepancy handling

The audit must not silently choose between conflicting Kickresume price captures.

**Capture A — supplied prior audit context:**

- Monthly list: $9; 20% promotion: $7.20.
- Three-month list: $6/month; promotion: $4.80/month.
- Yearly list: $4/month; promotion: $3.20/month.

**Capture B — direct fetch on 2026-08-03 from `https://www.kickresume.com/en/pricing/`:**

- Monthly list: $24/month; 20% promotion: $19.20 for the first month.
- Quarterly list: $18/month; 20% promotion: $14.40/month, $43.20 for the first three months.
- Yearly list: $8/month; 20% promotion: $6.40/month, $76.80 for the first 12 months.

Possible causes include geolocation, experiment assignment, session state, campaign landing variants, currency/purchasing-power adjustments, or a change between captures. None is proven by the available evidence.

**Publication rule:** Until a controlled recapture resolves the discrepancy, use language such as “Kickresume pricing varies by plan, promotion, and potentially session or location; see its current pricing page.” If numerical comparison is essential, include the capture date, displayed currency, billing total, and qualification that the value was observed rather than guaranteed.

### Recommended claim-governance model

When implementation is separately authorized, competitor claims should use a structure conceptually equivalent to:

| Field | Purpose |
|---|---|
| `claim` | Exact neutral proposition being published |
| `sourceUrl` | First-party public source |
| `capturedAt` | Date and time of observation |
| `locale` | Language, country/session context, and displayed currency |
| `evidenceType` | First-party page, checkout observation, third-party review, or test |
| `volatility` | Low, medium, high |
| `reviewBy` | Mandatory next-review date |
| `owner` | Person accountable for re-verification |
| `status` | Verified, qualified, disputed, stale, or removed |
| `notes` | Promotion, tax, billing, eligibility, and feature-boundary details |

High-volatility claims such as prices, free limits, promotions, ratings, and user counts should expire quickly. If evidence expires, the publishing system should fail closed to neutral copy rather than preserve a favorable but stale assertion.

## Quick wins

1. **Correct or temporarily neutralize the Kickresume comparison.** This is the first action once code changes are authorized.
2. **Add an evidence ledger for every competitor row.** Start manually if necessary; automation can follow.
3. **Show a complete tailored-resume example.** Use a fictional or fully permissioned profile, a job ad, highlighted changes, ATS-score movement, and limitations.
4. **Demonstrate the tracker publicly.** A privacy-safe screenshot sequence or interactive sample should show statuses, linked resume, score, follow-up, notes, and honest delivery states.
5. **Clarify the resume-examples promise.** Distinguish role guides from complete example resumes so search intent is not overpromised.
6. **Add sample ATS-report anatomy.** Explain what the score assesses, what it does not guarantee, and how to act on findings.
7. **Turn pricing terms into trust proof.** Make fixed-term/no-auto-renew language visually prominent and consistent at every payment decision.
8. **Preserve context through calls to action.** Role, company, country, or job pages should prefill or carry their specific context into the builder where technically and ethically appropriate.

## Medium-term investments

### 1. Demonstration system

Create a reusable public demonstration framework for tailoring, ATS analysis, tracker continuity, cover letters, and interview preparation. Each demonstration should use consistent sample data, disclose what is simulated, and connect to a relevant free action.

### 2. Evidence-backed example library

Develop complete visual examples with clear provenance labels:

- Fictional demonstration.
- Expert-written reference.
- Permissioned and anonymized user example.
- Generated example reviewed by a named methodology owner.

Every example should show why its structure fits the role and where tailoring is still required.

### 3. Trust and methodology center

Publish accessible explanations of:

- ATS score methodology and limitations.
- Tailoring inputs and non-invention policy.
- Country guidance sources and review cadence.
- Auto Apply safeguards and delivery semantics.
- Data retention, privacy, and security practices.
- Correction policy for competitor and research claims.

### 4. Content quality and internal routing

Audit page families for unique evidence, search-intent fit, thin repetition, and the next product action. Build topic clusters around application outcomes rather than page-count growth.

### 5. Mobile web retention

Before native applications, strengthen mobile editing, saved progress, return-to-task behavior, tracker updates, document access, and compliant follow-up reminders. Measure whether these improvements materially raise repeated mobile use.

## Strategic bets

### 1. Safe application operating system

Own the workflow from job discovery through tailored documents, application state, follow-up, and interview preparation—without becoming an indiscriminate mass-application bot.

### 2. Country-aware application intelligence

Deepen verifiable country-specific guidance, formatting expectations, terminology, and job-search context. This is harder to copy credibly than adding templates.

### 3. Evidence-carrying resume generation

Let users understand which job requirement led to each suggested change and whether the supporting experience already exists in their source resume. This can combine conversion value, user control, and safety.

### 4. Honest automation as a brand position

Make constraints part of the promise: no fabricated experience, no guessed recipients, no duplicate mass sending, no hidden recurring billing, and no pretending that provider acceptance equals delivery.

## Anti-copy cautions

1. **Do not chase 40+ templates through low-quality variants.** Template quantity is useful only when each option serves a real audience and preserves ATS/readability standards.
2. **Do not label generic programmatic guides as real resume examples.** Provenance must be explicit.
3. **Do not manufacture testimonials, ratings, expert authority, or outcome claims.** Thin proof is safer than false proof.
4. **Do not copy content scale without editorial uniqueness and sources.** Large volumes of generic role/company copy can weaken trust and search quality.
5. **Do not use dynamic competitor prices as permanent headline claims.** Promotions and locale variations make this brittle.
6. **Do not weaken Auto Apply safeguards to match high-volume automation promises.** Safety is part of RoleSharp's differentiation.
7. **Do not build native apps for parity alone.** Validate repeated mobile workflows and retention first.
8. **Do not describe Kickresume as merely a template editor.** Its current public surface includes tailoring, ATS checking, AI writing, job tracking, and mobile products.

## Sequenced roadmap

### Phase 0 — Restore factual integrity

- Reverify every Kickresume claim from controlled sessions.
- Correct, qualify, or remove stale assertions.
- Add visible capture dates and source-specific notes.
- Neutralize verdict counts where evidence is non-equivalent or unresolved.
- Define ownership and expiry for competitor data.

**Exit condition:** No high-intent comparison claim depends on contradicted, expired, or uncited evidence.

### Phase 1 — Demonstrate current value

- Publish full tailoring and ATS examples.
- Show the tracker and job-to-application continuity.
- Clarify free/Premium and student boundaries.
- Explain score and automation limitations.
- Carry page context into the most relevant product action.

**Exit condition:** A new visitor can understand RoleSharp's differentiated workflow without creating an account.

### Phase 2 — Build verifiable trust

- Establish methodology and correction pages.
- Add named expert/reviewer ownership where genuine.
- Publish permissioned case studies and anonymized outcomes.
- Strengthen security, privacy, and Auto Apply safeguard explanations.

**Exit condition:** Major product and outcome claims have visible evidence, provenance, and limitations.

### Phase 3 — Improve templates, examples, and distribution

- Enhance browsing and previews for the existing template set.
- Add selected ATS-safe variants based on user demand.
- Build a provenance-labeled full-example library.
- Upgrade role/company/country clusters with unique sources and contextual actions.

**Exit condition:** Search visitors can find a relevant example, understand why it works, and move into a pre-contextualized workflow.

### Phase 4 — Invest in retention channels

- Optimize mobile web repeat use and saved-state continuity.
- Test reminder and follow-up loops with consent.
- Evaluate installability or native applications only after mobile retention and workflow demand are established.

**Exit condition:** Retention data—not competitor parity—justifies the selected mobile investment.

## Measurement plan

| Objective | Primary metric | Guardrail | Useful segmentation |
|---|---|---|---|
| Improve acquisition quality | Organic visitor → relevant tool start rate | Bounce and low-quality page indexation | Page family, query intent, country, device |
| Demonstrate product value | Demonstration viewed → checker/builder start | Scroll depth without action; page speed | Demo type, first-time/returning, mobile/desktop |
| Shorten first value | Median time from landing to first useful score or tailored preview | Error rate and abandonment | Entry page, auth state, upload/manual start |
| Optimize registration timing | Pre-registration intent → verified account → resumed destination | Verification failure and support contacts | Auth method, destination, device, country |
| Preserve a useful free tier | Free users reaching repeated monthly value | Generation cost, abuse, upgrade frustration | ATS-only, tailoring, job-active cohort |
| Improve paid conversion ethically | Qualified free user → Premium pass purchase | Refunds, billing confusion, support complaints | Feature trigger, monthly/yearly, student status |
| Build trust | Trust/methodology asset exposure → tool start or purchase | Exit rate after limitations disclosure | Asset type, acquisition channel |
| Improve examples/templates | Example/template view → use/tailor action | Export failure, template switching loops | Role, seniority, industry, template style |
| Strengthen workflow continuity | Job save → tailored resume → application tracked | Drop-off and duplicate application rate | Source, country, application method |
| Improve safe Auto Apply | Eligible posting → user-confirmed send → known outcome | Wrong-recipient incidents, duplicates, unknown outcomes, complaints | Provider, domain, country, job source |
| Validate mobile investment | 7-day and 30-day mobile return rate; cross-device continuation | Mobile error rate and editor abandonment | Mobile web, installable web, native if tested |
| Maintain claim quality | Percentage of live claims within review date | Number of stale/uncited claims and correction latency | Competitor, volatility, page surface |

### Measurement definitions that must remain explicit

- A “tool start” should require meaningful input, not merely a button click.
- “First value” should mean a visible, interpretable result—not account creation.
- “Application sent” must not be counted as delivered unless delivery is verified.
- A tracked application must be deduplicated across retries and channels.
- Paid conversion must be reviewed alongside refunds, billing contacts, and trust signals.
- Competitor-claim freshness should be monitored as an operational quality metric.

## Evidence URLs

### Kickresume first-party public pages

Captured or reviewed during the audit on or before 2026-08-03:

- Homepage: https://www.kickresume.com/en/
- Pricing: https://www.kickresume.com/en/pricing/
- Resume templates: https://www.kickresume.com/en/resume-templates/
- Resume examples: https://www.kickresume.com/en/resume-examples/
- Resume checker: https://www.kickresume.com/en/resume-checker/
- Resume tailoring: https://www.kickresume.com/en/resume-tailoring/
- Job application tracker: https://www.kickresume.com/en/job-application-tracker/
- Mobile app: https://www.kickresume.com/en/mobile-app/
- About: https://www.kickresume.com/en/about/
- App Store listing linked by Kickresume: https://apps.apple.com/app/resume-builder-by-kickresume/id1523618695
- Google Play listing linked by Kickresume: https://play.google.com/store/apps/details?id=com.kickresume

Kickresume's current navigation also exposed alternate paths for some categories, including `/en/templates/resume`, `/en/help-center/resume-samples`, and `/en/ats-resume-checker`. URL structures may have changed or redirect by locale.

### RoleSharp repository evidence

- Competitor data and stale claims: `../lib/competitors.ts`, especially lines 104–160 in the audited revision.
- Public comparison renderer: `../app/compare/[slug]/page.tsx`.
- Current free/Premium boundaries: `../app/pricing/page.tsx`.
- Resume-example hub model: `../app/resume-examples/page.tsx`.
- Tracker functionality and provider-state language: `../app/tracker/page.tsx`.
- Authenticated workspace continuity: `../app/dashboard/page.tsx`.
- Registration, verification, Google auth, and destination preservation: `../app/login/page.tsx`.

## Audit limitations

1. **Competitor pages are dynamic.** Pricing, promotions, counts, ratings, and feature boundaries can vary by time, locale, geolocation, cookies, experiment, authentication state, and currency.
2. **Pricing is unresolved.** Two materially different Kickresume price captures exist. The report records both and does not declare either universally current.
3. **Competitor claims are self-reported.** Template counts, user counts, ratings, hiring outcomes, security practices, and example provenance were not independently audited.
4. **No authenticated competitor product test was completed in this continuation.** Public-page statements about free limits, tailoring, checker depth, downloads, and synchronization may differ from in-product behavior.
5. **RoleSharp findings are source-based.** They reflect the audited repository revision and may not capture server configuration, external services, feature flags, database state, or production behavior outside the supplied validation context.
6. **The PWA/mobile search was scoped.** No relevant signal was found in the searched `app/**/*.{tsx,ts}` files. This does not prove absence from every repository path, generated asset, or deployment layer.
7. **SEO scale was assessed structurally, not through third-party traffic data.** No verified keyword rankings, backlinks, traffic, or conversion data were available.
8. **No legal conclusion is offered.** The stale-claim section identifies factual and reputation risk, not a legal determination.
9. **No product change was implemented.** Recommendations require separate authorization, design, testing, and measurement.

## Final strategic recommendation

RoleSharp's highest-leverage path is:

1. Restore claim integrity.
2. Demonstrate the strong workflow that already exists.
3. Build real, permissioned proof.
4. Convert specific search intent into context-preserving product use.
5. Expand examples, templates, and mobile investment only where measured demand supports them.

Kickresume should be treated as the benchmark for public product merchandising, trust architecture, visual inventory, content distribution, and mobile continuity—not as the blueprint for RoleSharp's product identity. RoleSharp should win by making careful, job-specific, evidence-aware application work easier while remaining transparent about pricing, scoring, automation, and delivery outcomes.
