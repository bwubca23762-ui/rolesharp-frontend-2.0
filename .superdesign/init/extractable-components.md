# Extractable components

## AppShell
- Source: `app/app-shell.tsx`
- Category: layout
- Description: Global public shell with skip link, navigation, workspace context and footer.
- Extractable props: `activeRoute`, `showWorkspaceContext`, `showToolContext`.
- Hardcoded: RoleSharp brand treatment, skip-link behavior, semantic shell order.

## MarketingShell
- Source: `components/ui/primitives/Shells.tsx`
- Category: layout
- Description: Marketing canvas wrapper.
- Extractable props: none.
- Hardcoded: full-height document surface.

## ToolWorkspaceNav
- Source: `components/tools/ToolWorkspaceNav.tsx`
- Category: layout
- Description: Compact current-workspace breadcrumb and related tools disclosure.
- Extractable props: `workspaceName`, `workspaceHref`, `relatedTools`.
- Hardcoded: link order and disclosure treatment.

## Button
- Source: `components/ui/primitives/Button.tsx`
- Category: basic
- Description: Pill action with blue primary and amber premium variants.
- Extractable props: `variant`, `size`, `isLoading`, `fullWidth`.
- Hardcoded: focus ring, active compression, motion reduction behavior.

## Card
- Source: `components/ui/primitives/Card.tsx`
- Category: basic
- Description: Semantic surface card.
- Extractable props: `variant`.
- Hardcoded: corner/rule/surface token language.
