# RoleSharp Frontend 2.0 — Architectural Decision Log (ADR)

> **Governance:** Supervisor / Design Director Agent  
> **Status:** Active & Enforced  

---

## Decision 1: "Ink & Signal" Editorial Direction vs. Generic AI Slop
- **Context**: Many contemporary AI tools use rainbow gradients, floating 3D spheres, excessive glassmorphism, decorative bento boxes, and artificial charts that undermine user trust.
- **Decision**: Adopt the "Ink & Signal" design philosophy. The UI is designed like a calm, high-precision career instrument: hairline borders (`1px solid var(--border)`), high-contrast typography, monospace metadata tags, and selective signal colors (emerald for verified evidence, amber for duplicate alerts/attention).
- **Tradeoff**: Avoids flashy visual tricks in favor of timeless, high-conversion typography and evidence-driven credibility.

---

## Decision 2: Dedicated In-Flow "Review & Confirm" Step vs. Fragile Full-Bleed Modal
- **Context**: Previously, resume generation relied on a full-bleed overlay modal. Modals suffer from focus traps, lost form state on accidental backdrop clicks, poor scrolling on mobile viewports (390px), and disconnect from wizard step tracking.
- **Decision**: Replace the modal with a dedicated, persisted wizard step (**Step 4: Review & Confirm**). It displays all 10 candidate data sections in-flow with green `✓ Quantified` badges, accessible `Edit section` return triggers, explicit safety copy (*"Only details you provide are used. Review them before generating."*), and a final confirmation CTA (`Confirm & generate resume`).
- **Tradeoff**: Wizard step count increases from 4 to 5, but candidate confidence, transparency, and data retention are significantly improved.

---

## Decision 3: Discrete Multi-Skill Input UX vs. Comma-Separated Textarea
- **Context**: A single comma-delimited textarea creates user anxiety, makes individual item reordering difficult, causes accidental deletions, and provides no inline duplicate detection.
- **Decision**: Implement discrete, repeatable skill inputs starting with 1 default row (`#1`) and an explicit `+ Add another skill` button. Support rapid keyboard input (`Enter` adds row and shifts focus, `ArrowUp`/`ArrowDown` navigates rows, `Backspace` on empty row removes it), accessible up/down reorder buttons, and polite duplicate warning alerts.
- **Tradeoff**: Increased DOM nodes per skill row; solved by lightweight native inputs and strict `string[]` state synchronization.

---

## Decision 4: Safe State Persistence vs. URL Query String Passing
- **Context**: Passing resume data, user details, or draft state through URL query strings risks PII leakage in browser histories, proxy logs, and referrer headers.
- **Decision**: Enforce that **zero candidate details or resume drafts are passed in URLs or query strings**. Draft persistence uses isolated client `localStorage` (`rs_resume_draft`), and authenticated persistence uses `POST /api/resumes` with session authentication.
- **Tradeoff**: Sharing a draft between devices requires logging in, rather than sending a URL link; prevents PII exposure.

---

## Decision 5: Sandboxed Local Review Fixtures vs. Modifying Real Database State
- **Context**: Running review tests against production databases or uncontrolled local tables risks corrupting developer data and creating environment drift.
- **Decision**: Implement a dedicated local fixture runner [`scripts/local-review-fixtures.ts`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/scripts/local-review-fixtures.ts) with npm scripts `npm run fixtures:seed` and `npm run fixtures:reset`. Fixtures operate exclusively on gitignored `.local/dev-store.json` and `.local/fictional-review-data.json`.
- **Safety Guard**: Strictly fails closed if `NODE_ENV === "production" && LOCAL_DEV_MODE !== "true"`.
- **Tradeoff**: Local preview uses scoped fictional data, guaranteeing zero impact on real production credentials or user data.

---

## Decision 6: Dual-Track Figma Architecture for Plan Tier Portability
- **Context**: The Figma Starter tier strictly limits files to 3 pages, triggering errors on automated page creation.
- **Decision**: Adopt a dual-track architecture: Track A (14-page target for Professional/Enterprise team publishing) and Track B (3 canonical pages utilizing labeled Canvas Sections on Starter tier).
- **Tradeoff**: Allows seamless local design execution and inspection without requiring paid Figma upgrades before review.

---

## Decision 7: Preservation of Native Backend Wire Format (`string[]`)
- **Context**: The frontend redesign must not alter backend schemas or worker payloads.
- **Decision**: The multi-skill component internally handles discrete objects with IDs for stable React keys, but serializes out directly as `string[]` to match `ProfileSchema.skills` in `lib/types.ts` and the backend queue consumer.
- **Tradeoff**: Component handles mapping between internal row state and pure string arrays, maintaining 100% backend backward compatibility.
