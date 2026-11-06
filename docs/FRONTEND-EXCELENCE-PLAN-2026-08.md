# Frontend Excellence Plan — full app visual/UX upgrade (2026-08)

Owner ask: "all webpages update like after-login user sections, buttons,
full-stack best UI buttons and features in best positions; find mistakes and
fix them; best visuals, best context; remove clutter where pages have too much;
add missing things in a stylish way."

## Ground rules (from DESIGN.md + honesty law)

- Workspace surfaces stay on the light canvas; no marketing flourishes in task
  tools (DESIGN.md A1).
- No invented numbers anywhere; sample data stays labelled "sample".
- Every change keeps: unit 429 green, e2e green (axe included), typecheck/lint.
- Buttons: use `Button` primitives everywhere (variants primary/outline/ghost);
  consistent sizes (sm in rows, md/lg for hero CTAs); icon + label pairs.
- Consistent page header pattern via WorkspaceShell/ToolShell.

## Findings from the audit (mistakes to fix)

1. **Dashboard**: description text has a mojibake artifact ("activity �?" without
   hunting…"); resume card action rows can overflow with 3+ buttons; no quick
   link to tracker/daily-matches from the empty state.
2. **Settings**: panels are functional but visually flat — FeatureSection rows
   lack hierarchy; tab descriptions duplicated in two places.
3. **Tracker**: 482-line single form+table page; add-status uses raw selects;
   follow-up dates unstyled; table rows dense on mobile.
4. **resume-fixer / checker**: inline styles mixed with classes (`style={{ margin: 0 }}`),
   `.card`/`.row between` legacy compat classes inside otherwise-tokened markup;
   fixer rail duplicates content with PreviewModal on mobile (fine), but desktop
   rail lacks sticky offset var.
5. **build**: tierbar uses raw `<Button variant="ghost">` for pricing passes —
   reads as navigation, not purchase; country-gate section is plain.
6. **Login**: solid but long; terms checkbox row cramped on mobile.
7. **Landing close/footer CTA** already good after v5 — do not touch.

## Tracks (each = edit → gates → commit)

- **T1 Dashboard**: fix mojibake; restyle stat strip (accent top border already
  exists — align MetricCards); resume-card action row: primary Open + icon-only
  secondary actions with tooltips (title attrs); empty-state gets 3 quick links
  (Make, Check, Track applications).
- **T2 Settings**: give each FeatureSection a consistent header row (icon chip +
  title + one-line description); overview tab cards get hover lift; fix any
  mojibake found.
- **T3 Tracker**: status pills colored by state; follow-up date chips; mobile
  card layout for entries; primary action pinned.
- **T4 Auth/login**: spacing pass on terms row, Google button alignment, error/
  notice placement; signup invite banner styling.
- **T5 Tools polish**: checker/resume-fixer inline-style cleanup to token
  classes; build tierbar buttons become proper pricing CTAs (outline + primary);
  country-gate card treatment.
- **T6 Final sweep**: grep for remaining mojibake across app/ components/;
  axe e2e re-run; deploy; progress log entry.
