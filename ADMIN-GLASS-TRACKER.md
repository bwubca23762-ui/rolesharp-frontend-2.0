# Admin Glass UI — Execution Tracker

Master spec: "Obsidian & Signal High-Tech Glass UI Command Center" (owner
prompt, 2026-10-30). Rules: every batch keeps `npm run check`, the full
node suite, and `npm run build` green; visual adoption is per-view so a
half-done batch never breaks a working admin surface.

## Current checkpoint — 2026-11-05

The owner authorized the verified changes to be pushed and deployed. The current
release candidate completes the operational repairs below; activation evidence
and its exact source commit are recorded by deploy.sh in the VPS release metadata.

- The local audit found and fixed a real Feature Flags render crash in the
  shared admin Button's `asChild` composition, plus the breadcrumb Fragment
  warning. Rendering tests now cover icons, shortcuts, loading labels, and links.
- Communications now has recipient/status inspection, exact-email suppression
  search, saved-audience estimates, and bounded expired-claim recovery. Provider
  attempts are never reset. Recovery and currency accounting have PostgreSQL tests.
- Notification, communications, and legal refreshes preserve unsaved drafts.
  Failed confirmed actions stay open. Support reply drafts remain ticket-specific.
- Admin mutations reject malformed bodies; limits cannot silently reset from
  an empty payload. Premium and email-verification actions must be explicit.
  Flag changes have one staff-attributed audit row in the mutation transaction.
- Analytics CSV SQL is repaired. Overview shows six truthful daily/cohort charts,
  separately denominated Razorpay totals, and unavailable queue telemetry honestly.
- Builder paper geometry remains fixed while zooming/fitting laptop rails.
  Paper colors remain legible in dark mode; the selected zoom control keeps contrast.
- Workflow rollout percentages now persist and gate stable user cohorts at the
  actual processing/sending boundaries. Global safety switches remain binary.
- New social claims default to pending moderation. Approval awards once;
  rejection never grants credits. Existing awards are preserved.
- Validation: 682 tests, check/build gates, 79 real local admin API assertions,
  41 GET boundary checks, 28 catalogue routes, 27 desktop admin pages, and 27
  production-build mobile admin pages. Detailed evidence and limits are in
  `docs/reports/2026-11-05-overhaul-verification.md`.

Live Razorpay order creation passed at ₹999 (99,900 paise); the yearly price is
₹6,499. No capture was attempted. One authorized email to support@rolesharp.com
was queued by the production provider; inbox delivery remains unconfirmed.
The phase checklist below is historical batch planning, not a substitute for
the current verification report or a claim that every proposed expansion shipped.

## Phase 1 — Design system (`app/admin/*.css`)
- [x] 1.1 Cascade order verified: admin/layout.tsx loads admin-workflows →
      analytics → admin-modern → admin-shadcn, so admin-modern wins ties;
      admin-shadcn.css is token-repoint only (no duplicate selectors).
      Full merge of compat/admin.css into admin-modern happens per-view
      during Phase 4 reskins (compat blocks like .admin-refresh-btn supply
      properties modern does not redefine — blind deletion would strip
      styling).
- [x] 1.2 Obsidian canvas + aura + 32px micro-grid + three glass tiers
      (`rsx-shell` L1, `rsx-card` L2, `rsx-overlay` L3) — additive,
      namespaced `.rsx-*` in admin-modern.css.
- [x] 1.3 `.rsx-mono` telemetry typography lock (Geist Mono + tabular-nums).
- [x] 1.4 Five status pills (healthy/warning/critical/active/staged) with
      pulsing 7px dots + reduced-motion guard.
- [ ] 1.5 Adoption: swap `admin-chart-card`/`admin-table-card`/StatCard
      chrome to `rsx-card`/`rsx-canvas` per view (Phase 4 batches).

## Phase 2 — Primitives (`components/ui/admin/*`)
- [x] 2.1 Button system: 9 visual styles (signal, cyber, frosted, success,
      warning, danger-glass, outline, ghost, link) + xs/icon-sm/icon-xs
      sizes + `loadingText`, `leftIcon`, `rightIcon`, `shortcut` props.
      Backward compatible — existing variants unchanged.
- [x] 2.2 DataTable upgrades SHIPPED: sticky frosted header (opt-out prop),
      density switcher (compact/standard/comfortable, persisted),
      column-visibility dropdown (last column protected), one-click CSV/JSON
      current-view export with toast, opt-in row selection + floating glass
      bulk-action dock with count/clear/contextual actions.
- [x] 2.3 Copyable-ID upgrade SHIPPED: emerald check swap 1.5s + success
      micro-toast.
- [x] 2.4 Confirmation consolidation status: `useAdminConfirm`
      (type-to-confirm) is the admin entry point and now awaits its action
      (e029017); ConfirmActionDialog remains for simple confirm+reason flows
      (jobs-admin, promo, feature-access). Full merge into one component
      lands with Batch B's drawer work (both render through AccessibleDialog).

## Phase 3 — Command shell
- [x] 3.1 Sidebar SHIPPED: collapse toggle (grid shifts via
      html[data-admin-rail], persisted), quick-filter (auto-opens matching
      groups, hides non-matches), collapsible categories + live counter
      badges (pre-existing), pinned favorites (up to 4, persisted, hover pin
      buttons), staff identity pod (pre-existing).
- [x] 3.2 Global ⌘K palette SHIPPED (command-palette.tsx): permission-
      filtered route jump + instant actions (Purge CDN cache, Toggle
      maintenance flag) with busy state + status line; Escape/arrows/Enter;
      rs-admin-toast event surfaced as a toast in admin-panel.
- [x] 3.3 Telemetry top bar SHIPPED: 'Updated Ns ago' live clock, subsystem
      health pills (rsx pills, system.read-gated, from /api/admin/services),
      auto-refresh cadence select (off/15/30/60) with in-option countdown
      that fires the full refresh pipeline (onRefresh + invalidateAll +
      ADMIN_REFRESH_EVENT + services).
- [x] 3.4 Login: Google OAuth deep-link now preserves the entry route
      (e029017); glass restyle lands with Batch C.
- [x] 3.5 Session/stats reliability: fresh=1 cache bypass, stats-stale Retry
      card, refresh event reaches all views (e029017).

## Phase 4 — Views & panels (batches D+, one module group per batch)
- [x] Already shipped (e029017 + this branch): every reported broken button
      fixed; needs-user Activate; full-dataset KPI stats + CSVs; audit
      To-date filter + full-dataset attributed CSV; failed-payments WHERE;
      care-desk busy state; support status filter + refresh; blog refresh;
      analytics honest labels; promo banners + confirm; gateways
      touched-fields + cancel; social-rewards error state; panels fail
      loudly; save-then-act publishing; de-duplicated staff-attributed
      audit writes.
- [ ] D1 Overview telemetry grid + activity feed + health matrix + tiles
- [ ] D2 Analytics funnel + tool/SEO leaderboard + export presets
- [ ] D3 Users 360° drawer + bulk dock (checkbox column already present and
      working — the reported missing-column bug does not exist in this tree)
- [ ] D4 Resumes slide-over preview/JSON inspector + export triggers
- [ ] D5 Payments IPN quarantine inspector + invoice resend + gateway cards
- [ ] D6 Offers diff viewer + promo campaign manager + pricing preview
- [ ] D7 Students anti-farming badges + batch toolbar + social-rewards
      proof inspector
- [ ] D8 Helpdesk 3-pane + canned macros (customerCare viewToPath verified
      correct: "/admin/customer-care")
- [ ] D9 Jobs ingestion deck + workflows telemetry
- [ ] D10 Communications preview sandbox + outbox inspector + token health
      (mail-connections perms already standardized on mail.read/mail.manage;
      notifications CTA regex verified — no change needed in this tree)
- [~] D11 Blog IndexNow push SHIPPED (header button → /api/admin/indexnow with
      toast); internship evidence verifier + legal tracker remain
- [~] D12 Audit JSON diff inspector SHIPPED (expandable details → dark
      terminal panel with pretty JSON + actor/method/target); flag matrix,
      RBAC grid, terminal stream, backup/rate-limit panels remain

## Phase 5 — Backend reliability
- [x] 5.1 `adminFetchJson` safe fetch helper (admin-helpers.ts) + first
      adopter (customer-care resolve). Remaining views adopt during Phase 4
      batches.
- [x] 5.2 Every admin POST/PATCH/PUT/DELETE branch returns NextResponse.json
      (e029017: flags, job-listings, users, students, internship-reports,
      mail-connections, queue).
- [x] 5.3 job-listings parses the body exactly once (e029017).
- [x] 5.4 Credit adjustments already run inside withTransaction
      (users.credits + credit_events + admin_actions atomically).
- [x] 5.5 Student release re-claim fixed via migration 075 (ledger UNIQUE
      constraints dropped; claims table enforces active uniqueness).
- [x] 5.6 Audit route already LEFT JOINs staff_accounts (actor_email +
      actor_name); recordAdminAction attributes staff_account_id +
      authentication method on every mutation (dedupe in e029017).
- [x] 5.7 RBAC: mail-connections on mail.read/mail.manage (migration 074);
      indexnow accepts content.publish OR system.manage; support POST
      requires support.manage. Backup/log routing through ops-helper:
      verify during D12 (deploy.sh already provisions the daily backup).

## Phase 6 — Gates (every batch)
- [x] Batch B+C: tsc + eslint clean, node suite 655/655, build clean.
- [ ] Per future batch: same gates + targeted e2e
      (tests/e2e/account-admin-workspaces.spec.ts) + DOM probes at
      1440/1280 (expanded + collapsed) and 375px.
