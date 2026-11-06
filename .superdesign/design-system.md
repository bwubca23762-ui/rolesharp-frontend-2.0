# RoleSharp 2.0 design direction

## Product and audience

RoleSharp helps serious job seekers turn verified experience and one specific job into a credible, ATS-aware application, then prepare, organize and follow up. The audience is time-pressed, globally distributed and sceptical of AI-generated claims. Every screen must feel grounded, legible and in control.

## Design thesis

**Evidence, not ornament.** The new direction increases confidence by making the candidate's source material, target role, score rationale and next safe action visible. It should look like a precise career instrument, not a generic AI landing page.

## Visual system

- Canvas: #F7F9FC with white document surfaces; optional inky navy moments only for proof/closing blocks.
- Ink: #10243E; muted information #52647A; hairlines #D5DFEA.
- Action: deep blue #123B7A with brighter controlled action affordances #0A84FF/#0066CC. Amber #D97706 only denotes premium/selected brand emphasis.
- Fonts: Plus Jakarta Sans for display, DM Sans for reading, Geist Mono for labels/data. No serif, no purple, no neon.
- Geometry: 4px rhythm, 12–20px card radius, 1200px desktop content lane, generous 16/24/32px responsive gutters.
- Components: blue primary buttons; quiet outline secondary buttons; scan-frame corners; evidence rows; compact chips only for real status or category.
- Illustration: product-native evidence/report visualisation, not stock imagery or decorative gradients.

## Motion

Use motion only to communicate state: upload accepted, score progress, evidence expanded, saved, export ready. Limit hero motion to one brief transform/opacity entrance. Respect reduced motion; no perpetual parallax, magnetic buttons or visual noise.

## UX rules

- One unmistakable primary next action per high-intent screen.
- Disclose access requirements before work begins.
- Explain score/confidence and user consequence in plain language.
- Keep generated output, export and recovery reachable at mobile widths.
- Never promise interview, ATS or hiring outcomes; express capability and limits.

## Initial screen plan

1. Landing desktop: a single split hero around `Check my resume` with a quiet secondary `Tailor to a job`, live evidence snapshot and a three-step proof row.
2. ATS checker desktop: source and target input on left, a score/explanation/result rail on right; inputs are progressively disclosed and the outcome is always reachable.
3. Tailored builder desktop: job context stepper, evidence-led content workbench and stable resume preview; anonymous state has a clear account continuity gate.
4. Jobs desktop: explicit member access gate beside search, representative result preview and country coverage, keeping the tailor handoff trustworthy.
5. Pricing desktop: compare value with calm fixed-term options; no fear language, misleading benchmarks or giant promotional clutter.

Use ONLY this system's fonts, colours, spacing and component styles. Do not introduce any fonts, colours or visual styles not defined here.
