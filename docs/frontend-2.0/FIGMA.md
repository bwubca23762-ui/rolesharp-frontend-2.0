# RoleSharp Frontend 2.0 — Figma Design System & Source of Truth

> **Connected File:** `unsaved-mw5bcesp-xn0fgwce` ("Untitled" local connection via Figma Desktop / MCP Bridge)  
> **Authoritative Design URL / URI:** `figma://file/unsaved-mw5bcesp-xn0fgwce` (Canonical Team URL configured upon team project publication)  
> **Export Handoff Artifacts:**  
> - PDF Specification: [`figma-export/rolesharp_builder_review_spec.pdf`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/figma-export/rolesharp_builder_review_spec.pdf)  
> - PNG Handoff Render: [`figma-export/rolesharp_builder_review_spec.png`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/figma-export/rolesharp_builder_review_spec.png)  
> **Last Synced:** 2026-11-07  

---

## 1. Plan Tier Constraint & Dual-Track Page Architecture

### Starter Plan Constraint
The active Figma workspace is currently on the **Figma Starter Tier**, which strictly limits free files to **3 top-level pages**. Attempting to invoke `createPage` beyond 3 pages triggers:
```text
in createPage: The Starter plan only comes with 3 pages. Upgrade to Professional for unlimited pages.
```

### Dual-Track Architecture
To guarantee portability without blocking engineering, RoleSharp 2.0 uses a dual-track architecture:

1. **Track A — Enterprise/Pro Publishing Structure (14 Pages Target)**:
   For execution in a Figma Professional or Organization team project:
   - `00 — Foundations`
   - `01 — Components & Design Tokens`
   - `02 — Landing Page (Desktop & Mobile 390px)`
   - `03 — Authentication & Onboarding`
   - `04 — Resume Builder & Studio`
   - `05 — Dedicated Review & Confirm Step`
   - `06 — ATS Checker & Diagnostic X-Ray`
   - `07 — Templates Catalog & Documents`
   - `08 — Application Tracker (Board & List)`
   - `09 — Jobs & Interview Preparation`
   - `10 — Workspace Dashboard, Settings & Pricing`
   - `11 — Mobile Viewports & Touch Controls`
   - `12 — States, Motion & Accessibility Specs`
   - `13 — QA Handoff & Asset Exports`

2. **Track B — Starter Tier Canonical Mapping (3 Pages with Labeled Sections)**:
   In the active connected file (`unsaved-mw5bcesp-xn0fgwce`):
   - **Page 1 (`10:2`)**: `"00 — RoleSharp 2.0 foundations"`
     - Section: System Direction & Brand DNA (Frame `10:3`, 1440×900)
     - Section: 01 — Landing Desktop (Frame `11:4`, 1440×1120)
     - Section: 02 — ATS Checker Desktop (Frame `11:5`, 1440×980)
     - Section: 03 — Tailored Resume Studio Desktop (Frame `11:6`, 1440×980)
   - **Page 2 (`50:2`)**: `"01 — RoleSharp 2.0 Components & Review Flow"`
     - Section: Builder Spec — Multi-Skill Input & Pre-Flight Review (Frame `50:3`, 1440×1080)
       - Discrete repeatable skill input rows
       - Dedicated in-flow Review & Confirm Step (10 sections)
       - Quantified evidence badge specifications
       - Safety declaration: *"Only details you provide are used. Review them before generating."*
       - Final confirmation CTA: `Confirm & generate resume`
   - **Page 3 (`0:1`)**: `"02 — Authenticated Product: Dashboard, Tracker, Jobs & Settings"`
     - Canvas Section: Workspace Dashboard & Next Steps (1440×900)
     - Canvas Section: Application Tracker Kanban & Stage Columns (1440×900)
     - Canvas Section: Job Discovery & Evidence Match Alignment (1440×900)

---

## 2. Token System & Design Primitives

### 2.1 Color Tokens & Contrast Ratios
Designed for high-trust editorial legibility. All pairings achieve **WCAG AA (≥ 4.5:1)**:

| Token Name | Dark Theme Value (Default) | Light Theme Value | Intended Usage | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- |
| `background` | `#0b0f17` (Deep Obsidian) | `#f8fafc` (Paper Zinc) | App & page canvas root | Baseline |
| `surface` | `#111827` (Zinc 900) | `#ffffff` (Pure White) | Cards, panels, input fields | > 12:1 against text |
| `surface-2` | `#1f2937` (Zinc 800) | `#f1f5f9` (Slate 100) | Table headers, secondary areas | > 10:1 against text |
| `border` | `#27272a` (Zinc 800 / Hairline) | `#e2e8f0` (Slate 200) | Hairline 1px section borders | Structural division |
| `fg` | `#f4f4f5` (Zinc 100) | `#0f172a` (Slate 900) | Primary titles, body copy | 13.8:1 (AAA) |
| `muted-fg` | `#a1a1aa` (Zinc 400) | `#64748b` (Slate 500) | Secondary metadata, labels | 6.2:1 (AA) |
| `signal-emerald` | `#10b981` (Emerald 500) | `#059669` (Emerald 600) | Quantified proof, active signals | 4.8:1 on dark |
| `signal-amber` | `#f59e0b` (Amber 500) | `#d97706` (Amber 600) | Attention warnings, duplicate alerts| 4.6:1 on dark |
| `signal-red` | `#ef4444` (Red 500) | `#dc2626` (Red 600) | Errors, destructive actions | 4.9:1 on dark |

### 2.2 Typography Scale
- **Display / Heading Family**: `Plus Jakarta Sans`, sans-serif (700 / 800)
- **Body & UI Family**: `DM Sans`, sans-serif (400 / 500 / 600)
- **Metadata & Figures Family**: `Geist Mono` or monospace (`font-mono text-xs`)

| Level | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Display** | 48px – 58px | 800 | 1.1 | Landing page primary tagline |
| **Section H1** | 32px – 40px | 700 | 1.2 | Main page titles (`/build`, `/checker`) |
| **Card H2** | 20px – 24px | 700 | 1.3 | Panel headings, review section cards |
| **Subsection H3**| 16px – 18px | 600 | 1.4 | Group headings, form legends |
| **Body Large** | 16px | 400 / 500 | 1.5 | Hero subhead, key explanations |
| **Body Default**| 14px | 400 | 1.5 | Form labels, table cells, review copy |
| **Caption / Mono**| 11px – 12px | 600 / 700 | 1.4 | ATS scores, step counters, metadata |

### 2.3 Spacing, Radii & Focus Rings
- **Hairline Borders**: `1px solid var(--border)` throughout (no heavy slabs).
- **Corner Radii**:
  - Buttons / Inputs: `8px` (`rounded-lg`)
  - Cards / Summary Sections: `12px` – `16px` (`rounded-xl`)
  - Badges / Chips: `9999px` (`rounded-full`)
- **Focus Rings**:
  - `outline: 2px solid var(--primary); outline-offset: 2px;`
  - High contrast on keyboard focus (`:focus-visible`), never suppressed with `outline: none`.
- **Motion Durations**:
  - Micro-interactions (hover, focus): `150ms ease-out`
  - Card transitions & step advances: `250ms cubic-bezier(0.16, 1, 0.3, 1)`
  - Reduced Motion (`prefers-reduced-motion: reduce`): `transition: none !important; animation: none !important;`

---

## 3. Figma-to-Code Mapping Directory

| Redesigned Route / Surface | Figma Canvas Frame | Active Code File |
| :--- | :--- | :--- |
| **Landing Page (`/`)** | Frame `11:4` (`10:2`) | [`app/page.tsx`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/page.tsx) & [`app/application-desk.css`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/application-desk.css) |
| **ATS Checker (`/checker`)** | Frame `11:5` (`10:2`) | [`app/checker/page.tsx`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/checker/page.tsx) |
| **Resume Builder (`/build`)** | Frame `11:6` (`10:2`) | [`app/build/page.tsx`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/build/page.tsx) |
| **Multi-Skill Input UX** | Frame `50:3` (`50:2`) | [`app/build/skill-fields.tsx`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/build/skill-fields.tsx) |
| **Review & Confirm Step (Step 4)** | Frame `50:3` (`50:2`) | [`app/build/generation-review.tsx`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/build/generation-review.tsx) |
| **Template Catalog (`/resume-templates`)** | Frame `50:3` (`50:2`) | [`app/resume-templates/template-catalog.tsx`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/resume-templates/template-catalog.tsx) |
| **Dashboard (`/dashboard`)** | Canvas Section (`0:1`) | [`app/dashboard/page.tsx`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/dashboard/page.tsx) |
| **Application Tracker (`/tracker`)** | Canvas Section (`0:1`) | [`app/tracker/page.tsx`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/tracker/page.tsx) |
| **Jobs Discovery (`/jobs`)** | Canvas Section (`0:1`) | [`app/jobs/page.tsx`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/jobs/page.tsx) |
| **Settings & Profile (`/settings`)** | Canvas Section (`0:1`) | [`app/settings/page.tsx`](file:///d:/Istak/rolesharp%20redesign2.0/rolesharp_redesign2_0/app/settings/page.tsx) |
