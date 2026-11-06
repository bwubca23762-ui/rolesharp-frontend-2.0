# RoleSharp Frontend 2.0 — Design Handoff

## Archive contents

- A copy of the current `frontend-2.0` working tree, including uncommitted redesign work.
- The rebuilt landing source:
  - `app/page.tsx`
  - `components/marketing/RoleSharpLanding.tsx`
  - `components/marketing/RoleSharpLanding.module.css`
  - `components/marketing/LandingQuote.tsx`
  - `app/application-desk.css` (quote motion)
- Existing project design references: `DESIGN.md`, `REDESIGN-SPEC.md`, and `REDESIGN-TRACKER.md`.
- Figma PDF exports in `figma-export/`.

## Landing design

**Purpose:** help job seekers turn real experience into evidence-led, role-specific resumes without inventing claims.

**Flow:** hero with product proof → trust principles → animated statement → explainable workflow → tools → template previews → closing action.

**Hero**

- Tagline: **“RoleSharp: One step ahead towards a successful career.”**
- A live evidence review sits beside the claim, so the proposition is demonstrated instead of abstractly illustrated.
- Primary action: **Check your resume**. Secondary action: **Browse templates**.

**Quote sequence**

1. `Do you know what it takes to secure a job rather than Degree and Skills?`
2. `well!`
3. `A perfect resume that explains you more than yourself!!`
4. `So, choose RoleSharp to tailor your resume.`

The sequence is intersection-triggered, respects reduced-motion preferences, and holds the final sentence visibly before motion starts. It cannot render as a blank section. The RoleSharp lockup uses the official R mark followed directly by `oleSharp`.

**Visual system**

- Navy product canvas; warm paper resume; restrained blue and amber evidence states.
- Editorial display type paired with compact product-interface sans serif.
- Product evidence takes the place of stock imagery, decorative gradients, and generic feature-card layouts.
- The desktop hero locks the tagline into four deliberate lines; mobile reflows without suppressing the product proof.

## Figma exports

- `figma-export/rolesharp_design_foundations.pdf` — **RoleSharp 2.0 — System direction** frame.
- `figma-export/rolesharp_landing_desktop.pdf` — **01 — Landing • desktop** frame.

Figma source at packaging time was the connected unsaved bridge document **Untitled** (`unsaved-mw4xqm1z-9vnz9p8c`). The bridge provides frame exports but not a portable `.fig` file. The included PDFs are the portable visual handoff. To make the source itself available on another device, save the Figma document to a shared Figma project before switching devices.

## Verification

- `npm run -s typecheck`
- `npm run -s test:frontend` → 104 / 104 passing
- Focused lint on landing source
- Browser review at desktop and mobile widths

## Current working-tree manifest

Every listed source file is included in this copy.

+ - `M .gitignore`
 - ` M app/[locale]/page.tsx`
 - ` M app/about/page.tsx`
 - ` M app/admin/admin-modern.css`
 - ` M app/admin/admin-panel.tsx`
 - ` M app/admin/admin-shared.tsx`
 - ` M app/admin/admin-surfaces.css`
 - ` M app/admin/login.tsx`
 - ` M app/admin/sidebar.tsx`
 - ` M app/admin/views/actions-view.tsx`
 - ` M app/admin/views/analytics-view.tsx`
 - ` M app/admin/views/auto-mail-view.tsx`
 - ` M app/admin/views/blog-view.tsx`
 - ` M app/admin/views/campaigns-view.tsx`
 - ` M app/admin/views/communications-view.tsx`
 - ` M app/admin/views/customer-care-view.tsx`
 - ` M app/admin/views/emails-view.tsx`
 - ` M app/admin/views/feature-access-view.tsx`
 - ` M app/admin/views/feature-flag-view.tsx`
 - ` M app/admin/views/jobs-admin-view.tsx`
 - ` M app/admin/views/legal-view.tsx`
 - ` M app/admin/views/mail-connections-view.tsx`
 - ` M app/admin/views/notifications-view.tsx`
 - ` M app/admin/views/offers-view.tsx`
 - ` M app/admin/views/overview-view.tsx`
 - ` M app/admin/views/payments-view.tsx`
 - ` M app/admin/views/pricing-view.tsx`
 - ` M app/admin/views/resumes-view.tsx`
 - ` M app/admin/views/settings-view.tsx`
 - ` M app/admin/views/staff-view.tsx`
 - ` M app/admin/views/students-view.tsx`
 - ` M app/admin/views/support-view.tsx`
 - ` M app/admin/views/system-view.tsx`
 - ` M app/admin/views/users-view.tsx`
 - ` M app/admin/views/workflows-view.tsx`
 - ` M app/admin/workspace-bar.tsx`
 - ` M app/affiliate/page.tsx`
 - ` M app/app-shell.tsx`
 - ` M app/application-queue/queue-panel.tsx`
 - ` M app/auto-apply/page.tsx`
 - ` M app/blog/BlogPosts.tsx`
 - ` M app/blog/[slug]/page.tsx`
 - ` M app/blog/page.tsx`
 - ` M app/build/page.tsx`
 - ` M app/campaign-settings/campaign-settings-client.tsx`
 - ` M app/checker/page.tsx`
 - ` M app/companies/CompaniesPage.tsx`
 - ` M app/companies/[company]/page.tsx`
 - ` M app/companies/page.tsx`
 - ` M app/compare/[slug]/page.tsx`
 - ` M app/compare/page.tsx`
 - ` M app/compat/legacy-bridge.css`
 - ` M app/contact/page.tsx`
 - ` M app/cover-letter-examples/page.tsx`
 - ` M app/cover-letter-templates/page.tsx`
 - ` M app/daily-matches/daily-matches-client.tsx`
 - ` M app/dashboard/page.tsx`
 - ` M app/email-connection/connection-panel.tsx`
 - ` M app/help/page.tsx`
 - ` M app/integrations/page.tsx`
 - ` M app/internships/[country]/page.tsx`
 - ` M app/internships/page.tsx`
 - ` M app/interview-prep/page.tsx`
 - ` M app/interview-questions/[role]/page.tsx`
 - ` M app/interview-questions/[role]/question-practice-studio.tsx`
 - ` M app/interview-questions/page.tsx`
 - ` M app/interview-questions/role-bank-explorer.tsx`
 - ` M app/job-alerts/page.tsx`
 - ` M app/job-search-guide/page.tsx`
 - ` M app/jobs/[country]/page.tsx`
 - ` M app/jobs/jobs-finder.tsx`
 - ` M app/jobs/page.tsx`
 - ` M app/layout.tsx`
 - ` M app/learn/page.tsx`
 - ` M app/nav.tsx`
 - ` M app/notifications/page.tsx`
 - ` M app/page.tsx`
 - ` M app/press/page.tsx`
 - ` M app/pricing/page.tsx`
 - ` M app/refund/page.tsx`
 - ` M app/resume-examples/page.tsx`
 - ` M app/resume-keyword-report-2026/page.tsx`
 - ` M app/resume-maker/page.tsx`
 - ` M app/resume-templates/page.tsx`
 - ` M app/resume-templates/template-catalog.tsx`
 - ` M app/resumes/[id]/page.tsx`
 - ` M app/roles/RolesPage.tsx`
 - ` M app/roles/[role]/page.tsx`
 - ` M app/roles/page.tsx`
 - ` M app/settings/page.tsx`
 - ` M app/social-rewards/page.tsx`
 - ` M app/students/page.tsx`
 - ` M app/talent/page.tsx`
 - ` M app/theme-toggle.tsx`
 - ` M app/tools/page.tsx`
 - ` M app/tools/tools-catalogue.tsx`
 - ` M app/tracker/page.tsx`
 - ` M app/workspace-context-nav.tsx`
 - ` M components/LegalDocumentPage.tsx`
 - ` M components/tools/MicroGeneratorTool.tsx`
 - ` M components/tools/micro-generator-page.tsx`
 - ` M components/ui/CountryPicker.tsx`
 - ` M components/ui/primitives/Button.tsx`
 - ` M components/ui/primitives/Shells.tsx`
 - ` M components/ui/primitives/ToolShell.tsx`
 - ` M next.config.ts`
 - ` M package.json`
 - ` M tests/e2e/account-admin-workspaces.spec.ts`
 - ` M tests/e2e/customer-page-families.spec.ts`
 - ` M tests/e2e/landing-redesign.spec.ts`
 - ` M tests/e2e/phase-6-mobile-analytics.spec.ts`
 - ` M tests/frontend-regression.test.ts`
 - `?? .agents/`
 - `?? .figma-export.BbEhCF/`
 - `?? .superdesign/`
 - `?? app/application-desk.css`
 - `?? app/build/generation-review.tsx`
 - `?? app/build/skill-fields.tsx`
 - `?? app/dev/frontend-review/`
 - `?? app/language-picker.tsx`
 - `?? app/reading-surfaces.css`
 - `?? app/tracker/application-list.tsx`
 - `?? audits/frontend-uiux-audit-2026-11-05.md`
 - `?? components/marketing/ApplicationDesk.tsx`
 - `?? components/marketing/LandingQuote.tsx`
 - `?? components/marketing/RoleSharpLanding.module.css`
 - `?? components/marketing/RoleSharpLanding.tsx`
 - `?? components/marketing/public-growth.css`
 - `?? components/reading/`
 - `?? public/fonts/instrument-serif-OFL.txt`
 - `?? public/fonts/instrument-serif-latin-italic.woff2`
 - `?? public/fonts/instrument-serif-latin.woff2`
 - `?? scripts/audit-frontend-review.mjs`
 - `?? scripts/preview-frontend-seed.sql`
 - `?? scripts/preview-frontend.mjs`
 - ` .gitignore                                         |    1 +`
 - ` app/[locale]/page.tsx                              |   61 +-`
 - ` app/about/page.tsx                                 |   56 +-`
 - ` app/admin/admin-modern.css                         |  345 ++++-`
 - ` app/admin/admin-panel.tsx                          |   16 +-`
 - ` app/admin/admin-shared.tsx                         |    3 -`
 - ` app/admin/admin-surfaces.css                       |   17 +-`
 - ` app/admin/login.tsx                                |  154 +-`
 - ` app/admin/sidebar.tsx                              |  120 +-`
 - ` app/admin/views/actions-view.tsx                   |    2 +-`
 - ` app/admin/views/analytics-view.tsx                 |    2 +-`
 - ` app/admin/views/auto-mail-view.tsx                 |    2 +-`
 - ` app/admin/views/blog-view.tsx                      |    2 +-`
 - ` app/admin/views/campaigns-view.tsx                 |    2 +-`
 - ` app/admin/views/communications-view.tsx            |    2 +-`
 - ` app/admin/views/customer-care-view.tsx             |    2 +-`
 - ` app/admin/views/emails-view.tsx                    |    2 +-`
 - ` app/admin/views/feature-access-view.tsx            |    2 +-`
 - ` app/admin/views/feature-flag-view.tsx              |    2 +-`
 - ` app/admin/views/jobs-admin-view.tsx                |    2 +-`
 - ` app/admin/views/legal-view.tsx                     |    2 +-`
 - ` app/admin/views/mail-connections-view.tsx          |    2 +-`
 - ` app/admin/views/notifications-view.tsx             |    2 +-`
 - ` app/admin/views/offers-view.tsx                    |    2 +-`
 - ` app/admin/views/overview-view.tsx                  |   71 +-`
 - ` app/admin/views/payments-view.tsx                  |    2 +-`
 - ` app/admin/views/pricing-view.tsx                   |    2 +-`
 - ` app/admin/views/resumes-view.tsx                   |    2 +-`
 - ` app/admin/views/settings-view.tsx                  |    2 +-`
 - ` app/admin/views/staff-view.tsx                     |    2 +-`
 - ` app/admin/views/students-view.tsx                  |    2 +-`
 - ` app/admin/views/support-view.tsx                   |    2 +-`
 - ` app/admin/views/system-view.tsx                    |    2 +-`
 - ` app/admin/views/users-view.tsx                     |    2 +-`
 - ` app/admin/views/workflows-view.tsx                 |    2 +-`
 - ` app/admin/workspace-bar.tsx                        |   42 +-`
 - ` app/affiliate/page.tsx                             |   42 +-`
 - ` app/app-shell.tsx                                  |    2 +`
 - ` app/application-queue/queue-panel.tsx              |   12 +-`
 - ` app/auto-apply/page.tsx                            |   24 +-`
 - ` app/blog/BlogPosts.tsx                             |   52 +-`
 - ` app/blog/[slug]/page.tsx                           |  126 +-`
 - ` app/blog/page.tsx                                  |   30 +-`
 - ` app/build/page.tsx                                 |  149 +-`
 - ` app/campaign-settings/campaign-settings-client.tsx |   39 +-`
 - ` app/checker/page.tsx                               |   12 +-`
 - ` app/companies/CompaniesPage.tsx                    |   78 +-`
 - ` app/companies/[company]/page.tsx                   |   21 +-`
 - ` app/companies/page.tsx                             |   29 +-`
 - ` app/compare/[slug]/page.tsx                        |    7 +-`
 - ` app/compare/page.tsx                               |   82 +-`
 - ` app/compat/legacy-bridge.css                       |   17 +-`
 - ` app/contact/page.tsx                               |   33 +-`
 - ` app/cover-letter-examples/page.tsx                 |   11 +-`
 - ` app/cover-letter-templates/page.tsx                |   24 +-`
 - ` app/daily-matches/daily-matches-client.tsx         |   29 +-`
 - ` app/dashboard/page.tsx                             |   31 +-`
 - ` app/email-connection/connection-panel.tsx          |   24 +-`
 - ` app/help/page.tsx                                  |   75 +-`
 - ` app/integrations/page.tsx                          |   39 +-`
 - ` app/internships/[country]/page.tsx                 |    3 +-`
 - ` app/internships/page.tsx                           |    5 +-`
 - ` app/interview-prep/page.tsx                        |   27 +-`
 - ` app/interview-questions/[role]/page.tsx            |    4 +-`
 - ` .../[role]/question-practice-studio.tsx            |  101 +-`
 - ` app/interview-questions/page.tsx                   |   17 +-`
 - ` app/interview-questions/role-bank-explorer.tsx     |   79 +-`
 - ` app/job-alerts/page.tsx                            |   50 +-`
 - ` app/job-search-guide/page.tsx                      |    5 +-`
 - ` app/jobs/[country]/page.tsx                        |    3 +-`
 - ` app/jobs/jobs-finder.tsx                           |   53 +-`
 - ` app/jobs/page.tsx                                  |    9 +-`
 - ` app/layout.tsx                                     |   10 +-`
 - ` app/learn/page.tsx                                 |   38 +-`
 - ` app/nav.tsx                                        |   21 +-`
 - ` app/notifications/page.tsx                         |   29 +-`
 - ` app/page.tsx                                       |  128 +-`
 - ` app/press/page.tsx                                 |   13 +-`
 - ` app/pricing/page.tsx                               |  105 +-`
 - ` app/refund/page.tsx                                |    3 +-`
 - ` app/resume-examples/page.tsx                       |    7 +-`
 - ` app/resume-keyword-report-2026/page.tsx            |    9 +-`
 - ` app/resume-maker/page.tsx                          |  104 +-`
 - ` app/resume-templates/page.tsx                      |   59 +-`
 - ` app/resume-templates/template-catalog.tsx          |  245 +---`
 - ` app/resumes/[id]/page.tsx                          |   14 +-`
 - ` app/roles/RolesPage.tsx                            |   41 +-`
 - ` app/roles/[role]/page.tsx                          |   13 +-`
 - ` app/roles/page.tsx                                 |   29 +-`
 - ` app/settings/page.tsx                              |  132 +-`
 - ` app/social-rewards/page.tsx                        |   15 +-`
 - ` app/students/page.tsx                              |   28 +-`
 - ` app/talent/page.tsx                                |   10 +-`
 - ` app/theme-toggle.tsx                               |   85 +-`
 - ` app/tools/page.tsx                                 |    9 +-`
 - ` app/tools/tools-catalogue.tsx                      |   50 +-`
 - ` app/tracker/page.tsx                               |   46 +-`
 - ` app/workspace-context-nav.tsx                      |    4 +-`
 - ` components/LegalDocumentPage.tsx                   |    9 +-`
 - ` components/tools/MicroGeneratorTool.tsx            |   99 +-`
 - ` components/tools/micro-generator-page.tsx          |   16 +-`
 - ` components/ui/CountryPicker.tsx                    |    1 +`
 - ` components/ui/primitives/Button.tsx                |   17 +-`
 - ` components/ui/primitives/Shells.tsx                |   20 +-`
 - ` components/ui/primitives/ToolShell.tsx             |   10 +-`
 - ` next.config.ts                                     |    2 +-`
 - ` package.json                                       |    1 +`
 - ` tests/e2e/account-admin-workspaces.spec.ts         |    5 +-`
 - ` tests/e2e/customer-page-families.spec.ts           |   15 +-`
 - ` tests/e2e/landing-redesign.spec.ts                 |   27 +-`
 - ` tests/e2e/phase-6-mobile-analytics.spec.ts         |   30 +-`
 - ` tests/frontend-regression.test.ts                  | 1515 +++++++++++++++-----`
 - ` 112 files changed, 3067 insertions(+), 2227 deletions(-)`

## Reopen locally

```bash
cd rolesharp_redesign2_0
npm install
npm run dev -- --port 34110
```

Open `http://127.0.0.1:34110/`.

## Safety

This is a local copy. It does not contain `.git`, `node_modules`, build output, logs, or `.env` files. No branch, commit, or tracked source file was modified to create this handoff.
