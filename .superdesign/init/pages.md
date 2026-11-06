# Key page dependency trees

## `/` Home
Entry: `app/page.tsx`

- `app/page.tsx`
  - `components/ui/primitives/Shells.tsx`
  - `components/marketing/SmartTopBar.tsx`
  - `components/marketing/ModernHeroAndMethod.tsx`
  - `components/marketing/ProductDemoStage.tsx`
  - `app/company-marquee.tsx`
  - `components/marketing/FlagshipToolsSuite.tsx`
  - `components/marketing/TemplateStudio.tsx`
  - `components/marketing/ModernPlans.tsx`
  - `components/marketing/LandingClose.tsx`
  - `app/landing-motion.tsx`
  - `app/landing-motion.css`

## `/checker` ATS checker
Entry: `app/checker/page.tsx`

- `app/checker/page.tsx`
  - `components/ui/primitives/ToolShell.tsx`
  - checker workspace client/form controls
  - FAQ / footer inherited from `app/app-shell.tsx`

## `/build` Builder
Entry: `app/build/page.tsx`

- `app/build/page.tsx`
  - `components/ui/primitives/ToolShell.tsx`
  - authentication aware builder experience
  - document evidence / target job fields / preview and export state

## `/resume-templates`
Entry: `app/resume-templates/page.tsx`

- template hero + filter control
  - template preview cards
  - FAQ and related guides

## `/jobs`
Entry: `app/jobs/page.tsx`

- country/keyword search hero
  - member gate/result state
  - regional country index

## `/pricing`
Entry: `app/pricing/page.tsx`

- `components/marketing/ModernPlans.tsx`
  - comparison table
  - pricing FAQ
