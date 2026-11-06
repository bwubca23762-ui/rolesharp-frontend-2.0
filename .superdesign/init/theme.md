# Theme tokens

## Compact summary

| Token | Value/use |
| --- | --- |
| Primary | `#123B7A` / solid action; hover `#0B2D61` |
| Brand blue (button legacy) | `#0A84FF` → `#0066CC` |
| Premium amber | `#D97706`; highlight `#F59E0B` |
| Canvas / surface | `#F7F9FC`, `#FFFFFF`, `#F0F4F9`, `#E6EDF5` |
| Ink / muted | `#10243E`, `#52647A` |
| Border | `#D5DFEA` |
| Dark canvas/surface | `#061426`, `#0B1D34`, `#112943` |
| Success / warning / danger | `#047857`, `#C2410C`, `#B91C1C` |
| Display / body / data | Plus Jakarta Sans / DM Sans / Geist Mono |
| Type | display clamp 36–52px, h1 clamp 32–44px, h2 clamp 23–34px, body 15px, label 12px |
| Radius | 6, 8, 10, 12, 16, 20px; controls use full pill when compact |
| Content width | 1200px max; gutters 16/24/32px |
| Motion | 150/200/300ms eased out; transform + opacity only; full reduced-motion fallback |

## Design constraints

RoleSharp is a calm, technical career workspace: warm paper in light mode and deep navy in dark mode. The signature is the scan frame, score rings and evidence rows. The primary journey is evidence → explanation → user-controlled action. No purple gradients, neon, decorative blob art, stock-person hero photos or ungrounded outcome claims. Use sentence case. All body text needs AA contrast. Marketing flourish must not leak into high-intent task surfaces.

## Source locations

- Complete token implementation: `app/globals.css`.
- Motion contracts: `app/landing-motion.css`, `components/motion.tsx`.
- Full written system: `DESIGN.md`.
