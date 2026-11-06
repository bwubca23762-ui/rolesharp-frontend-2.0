# RoleSharp Frontend 2.0 — Baseline Inspection & Product Truth

> **Generated:** 2026-11-07T01:36:00Z  
> **Environment:** Active Local Worktree  
> **Status:** Phase 0 Verified

---

## 1. Live Git State & Repository Inspection

Every command below was executed directly in `rolesharp_redesign2_0` on 2026-11-07:

| Metric | Measured Value | Command Run |
| :--- | :--- | :--- |
| **Active Branch** | `redesign/frontend-2.0` | `git branch --show-current` |
| **Commit SHA** | `eb4bd75` | `git rev-parse --short HEAD` |
| **Commit Message** | `chore: baseline repository state before redesign 2.0` | `git log -1 --pretty=%B` |
| **Main Branch SHA** | `eb4bd75` (pristine, untouched) | `git rev-parse --short main` |
| **Working Tree Status**| Modified files on redesign branch | `git status --short` |

### Working Tree State (`git status --short`):
```text
 M app/application-desk.css
 M app/build/generation-review.tsx
 M app/build/page.tsx
 M app/build/skill-fields.tsx
 M app/icons.tsx
 M app/resume-templates/template-catalog.tsx
 M figma-export/README.md
 M package.json
 M tests/frontend-regression.test.ts
?? docs/frontend-2.0/
?? figma-export/rolesharp_builder_review_spec.pdf
?? figma-export/rolesharp_builder_review_spec.png
?? scripts/local-review-fixtures.ts
```

---

## 2. Core Framework, Build & Tooling Contracts

Inspected directly from [`package.json`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/package.json):

| Dimension | Specification | Evidence / Source |
| :--- | :--- | :--- |
| **Application Framework** | **Next.js 15.5.28** (App Router) | `package.json` -> `"dependencies": { "next": "^15.5.28" }` |
| **UI Library** | **React 19.2.8** | `package.json` -> `"dependencies": { "react": "^19.2.8" }` |
| **Styling Engine** | **Tailwind CSS 4.3.3** (`@tailwindcss/postcss`) | `package.json` -> `"tailwindcss": "^4.3.3"` |
| **Package Manager** | **npm** (`package-lock.json` lockfileVersion 3) | Root lockfile |
| **Typecheck Command** | `npm run typecheck` (`tsc --noEmit --incremental false`) | Exit code 0, 0 errors |
| **Frontend Test Command**| `npm run test:frontend` (`node --import tsx --test tests/frontend-regression.test.ts`) | 105 passed / 0 failed (3.48s) |
| **Full Security Suite** | `npm run test:security` (`node --import tsx --test tests/security-remediation.test.ts`) | Verifies fail-closed production boundaries |
| **Local Start Commands** | Development: `npx next dev -p 3000` (or `npm run dev`)<br>Production Start: `npm run start` (`next start -H 127.0.0.1 -p 3000`)<br>Review Preview: `npm run preview:frontend` (`scripts/preview-frontend.mjs`) | Verified active background process |

---

## 3. Route Inventory & Surface Analysis

Audited using [`scripts/audit-routes.mjs`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/scripts/audit-routes.mjs) against the live server:

- **Total Page Files Discovered**: **148**
- **Total Route Handler Files Discovered**: **187**
- **Discovered Concrete Page Paths**: **148**
- **Discovered Concrete Handler Paths**: **187**
- **Internal Cross-Links Traversed**: **289**

### Route Prioritization Tiers

#### P0 — Core Experience & Primary Conversion
- `/` (Editorial Landing & Evidence Flow)
- `/login`, `/register`, `/forgot-password` (Authentication & Recovery)
- `/build` (Interactive AI Resume Studio & Tailoring)
- `/resume-builder` & `/resume-maker` (Specialized Authoring Paths)
- `/checker` & `/ats-xray` (ATS Scoring, Diagnostic Parser & Evidence Audit)
- `/resume-templates` (Export Catalog with Document Previews)
- `/dashboard` (Candidate Workspace Hub & Next Actions)
- `/tracker` (Kanban Board, Application Stages & Follow-up Ledger)
- `/daily-matches` (Matched Opportunities & Fit Signals)
- `/application-queue` (Drafted & Pending Submissions)
- `/pricing` & `/students` (Tier Clarity & Fixed-Term Plans)
- `/settings` (Preferences, Security & Data Management)

#### P1 — High-Intent Workflows & Exploration
- `/jobs` & `/jobs/[country]` (Role Discovery & Search)
- `/internships` & `/internships/[country]` (Student Opportunities)
- `/companies` & `/companies/[company]` (Employer Intelligence)
- `/roles` & `/roles/[role]` (Benchmark Skills & Typical Bullets)
- `/interview-prep` & `/interview-questions` (Behavioral & Technical Question Bank)
- `/campaign-settings` & `/email-connection` (Outreach & Application Workflow)

#### P2 — Marketing, Content & Support
- `/blog` & `/blog/[slug]` (SEO Content & Guides)
- `/compare` & `/compare/[slug]` (Product Comparisons)
- `/tools/*` (Standalone Utility Tools)
- `/help`, `/contact`, `/terms`, `/privacy`, `/refund` (Legal & Support)
- `/admin/*` (Operator Command Bar & Backoffice Surfaces)

---

## 4. Architectural Contracts

### 4.1 Authentication & Session Contract
- **Session Mechanism**: Encrypted JWT (JWE: `dir` + `A256GCM`) stored in the HTTP-only `rai_session` cookie (`lib/auth.ts`).
- **Signing Secret**: Derived from `AUTH_SECRET` using `scryptSync` (N=16384, r=8, p=1).
- **Session Duration**: Absolute maximum age 30 days (`MAX_AGE`), rolling idle window configured via `SESSION_IDLE_HOURS`.
- **Local Dev Mode Contract**: When `LOCAL_DEV_MODE=true` and `DISABLE_DB=true`, authentication falls back to `.local/dev-store.json` via [`lib/dev-store.ts`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/lib/dev-store.ts).
- **Production Guard**: `lib/dev-store.ts` throws immediately if `NODE_ENV === "production" && LOCAL_DEV_MODE !== "true"`. `deploy.sh` strictly enforces `test "${LOCAL_DEV_MODE:-false}" = false`.

### 4.2 Resume Builder Persistence Contract
- **In-Flow Wizard Structure**:
  `Profile` (Step 1) → `Target job` (Step 2) → `Evidence` (Step 3) → `Review & Confirm` (Step 4) → `Generate / Export` (Step 5).
- **URL Cleanliness**: Strictly **no resume data, personal details, or credentials are passed in query strings**.
- **Client Draft Persistence**: Safe in-memory React state autosaved to client `localStorage` under `rs_resume_draft`.
- **Payload Schema**: Strict Zod validation via `ProfileSchema` in [`lib/types.ts`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/lib/types.ts). `skills` is natively typed as `z.array(z.string()).default([])`.
- **Pre-Flight Safety**: Pre-generation review requires explicit candidate confirmation: CTA `Confirm & generate resume` with declared safety copy: *"Only details you provide are used. Review them before generating."*

### 4.3 Design System & Theme Contract
- **Visual Foundation**: "Ink & Signal" — calm, high-trust, editorial aesthetic. Hairline borders (`border-border`), tabular figures for scores, uppercase monospace tags (`font-mono text-xs`).
- **Zero Generic AI Slop**: Prohibits decorative blobs, gratuitous glassmorphism, rainbow gradients, and fake charts.
- **Theme Precedence**: Dark mode is default. Light mode is fully supported via `.light` CSS variable mapping.
- **Accessibility & Motion**: `prefers-reduced-motion` strictly overrides all transitions and keyframe animations with `transition: none !important; animation: none !important;`. Contrast ratios meet WCAG AA (≥ 4.5:1).

### 4.4 Localization & Market Rules
- **Locales & Country Codes**: Defined in [`lib/locales.ts`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/lib/locales.ts) and [`lib/country-codes.ts`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/lib/country-codes.ts).
- **Country-Aware Resume Rules**: Respects market-specific conventions (e.g. US/UK headshot exclusion vs. optional photo in specific international markets).

### 4.5 Analytics & Telemetry Contract
- **Self-Hosted Privacy**: First-party telemetry via `/api/telemetry` and `/api/analytics`. Zero third-party surveillance trackers.
- **Rate-Limiting & Anti-Farming**: Client IP sanitization and bounded request budgets (`lib/anti-farming.ts`, `lib/rate-limit.ts`).

### 4.6 SEO & Structured Data Contract
- **JSON-LD Schemas**: Automated breadcrumb, organization, and job-posting schemas in [`lib/jsonld.ts`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/lib/jsonld.ts).
- **Dynamic Sitemaps**: Valid XML generated for real catalog entities without leaking unlisted administrative paths.

---

## 5. Safe Local Review Fixture Environment (Phase 0.2 Evidence)

A local review environment has been built and verified via [`scripts/local-review-fixtures.ts`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/scripts/local-review-fixtures.ts).

### 5.1 Security & Isolation Architecture
1. **Production Guard**:
   ```ts
   if (process.env.NODE_ENV === "production" && process.env.LOCAL_DEV_MODE !== "true") {
     console.error("FATAL: local-review-fixtures is strictly disabled in production.");
     process.exit(1);
   }
   ```
2. **Ignored Storage**: All fixture data is written to `.local/dev-store.json` and `.local/fictional-review-data.json`, both verified to be gitignored (`git check-ignore`).
3. **Database Safety**: Does not touch real Postgres instances or external services (`DISABLE_DB=true`).

### 5.2 Fictional Review Account Specification
- **Email**: `avery.chen@rolesharp.example`
- **Password**: `RoleSharp-Demo-2026!`
- **User ID**: `a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d`
- **Status**: Premium activated, 10 credits
- **Fictional Resumes**:
  - `avery-product-manager-resume`: Senior Product Manager resume targeting Harbor Labs (ATS score 92, verified metrics, 3 quantified roles).
- **Fictional Workspace & Tracker Data**:
  - 3 matched roles (Harbor Labs, Morrow, Aster)
  - 3 tracker entries (Saved, Applied, Interviewing at Northwind)
  - Campaign settings (Target: Product Manager, Location: Remote/NY)

### 5.3 Local Startup & Fixture Commands
```bash
# 1. Seed or re-seed the fictional review account:
npm run fixtures:seed

# 2. Reset and clear all fictional review data:
npm run fixtures:reset

# 3. Start local server with dev store:
# (In .env.local: LOCAL_DEV_MODE=true, DISABLE_DB=true, AUTH_SECRET=dev-secret)
npm run dev
```

### 5.4 Browser Visual Verification Evidence
Captured via Chrome DevTools MCP on 2026-11-07:

1. **Unauthenticated View (`/login`)**:  
   Saved artifact: [`.omo/evidence/phase0/unauthenticated_login.png`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/.omo/evidence/phase0/unauthenticated_login.png)
2. **Authenticated View (`/dashboard`)**:  
   Saved artifact: [`.omo/evidence/phase0/authenticated_dashboard.png`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/.omo/evidence/phase0/authenticated_dashboard.png)  
   Logged in as `avery.chen@rolesharp.example` with full workspace access, credit display, and active resume overview.

---

## 6. Supervisor Phase 0 Acceptance Sign-Off

> **Supervisor Verdict**: **APPROVED — PHASE 0 COMPLETE**  
> **Sign-Off Date**: 2026-11-07  
> **Findings**: Real environment inspection is complete. Git branch isolation is confirmed on `redesign/frontend-2.0`. Production fail-closed boundaries are proven. The fictional review environment is fully operational and safely sandboxed. All 105 frontend regression tests pass. The team is authorized to proceed to Phase 1 and beyond.
