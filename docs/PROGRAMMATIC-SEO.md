# Programmatic SEO — linking map and quality floor

How the data-driven pages connect to each other and to the tools, so topical
authority flows one way: into surfaces where a visitor can actually do
something. Written when the first programmatic surface shipped; extend this
map BEFORE adding the next surface, not after (Teal's own post-mortem on 3M
job pages: they pre-planned linking late and spent months repairing an entity
split between "resume site" and "job site").

## Current surfaces

| Surface | Template | Data source | Quality floor |
|---|---|---|---|
| `/salaries` | hub | live postings | — (tool page) |
| `/salaries/[role]/[country]` | `app/salaries/[role]/[country]/page.tsx` | `jobs` (structured yearly salaries) + `roles` taxonomy, stats via `getSalaryStats` | ≥ 8 salary-bearing postings; unknown slugs 404 (`dynamicParams = false`) |

**City level is deliberately absent**: the ingestor does not populate
`jobs.city` (0 of ~227K rows as of 2026-08-28). When ingestion starts filling
`city`, a `[city]` level slots UNDER the country pages
(`/salaries/[role]/[country]` stays canonical; cities become children) — do
not ship a city page before the data exists.

## The linking map

```
/salaries (hub)
  └─ /salaries/[role]/[country]     (24 strongest on the hub, all in sitemap)
       ├─ siblings (same role, other markets) — linked ONLY when prebuilt
       ├─ /roles/[role]             (entity bridge → role pillar)
       ├─ /jobs                     (tool intent → live listings)
       └─ /checker                  (tool intent → the free funnel)
```

Every programmatic template must carry, in this order:

1. **Up** — a link to its hub (`/salaries`, later `/companies`, `/roles`).
2. **Sideways** — sibling pages from the same candidate set, linked only when
   the sibling is itself prebuilt (never link a 404).
3. **Into a tool** — the page names the thing the visitor can *do* (check a
   resume, see live jobs). Pages that only inform compete with AI Overviews;
   pages that let you act survive them.

## Rules for the next surface

- **One matcher, one candidate source**: role→postings matching goes through
  `roleWords` in `lib/salary-data.ts` — the same matcher `getSalaryStats`
  applies — and candidates and sitemap entries come from the SAME memoized
  list (`candidatesPromise`, 6h TTL), so a URL in the sitemap can never 404.
  The TTL side of that bargain: the sitemap reflects a sample loss within 6h,
  not within its own 1h revalidate window.
- **Quality floor**: a page exists only when the underlying sample clears the
  honesty threshold (salary pages: ≥ 8 postings — the same bar the /salaries
  tool states). No number on a page may be invented or model-generated.
- **Stagger publishing**: grow the candidate limit (currently 150) by
  100–300/week, not 10,000 at once — index coverage, not raw count, is the
  metric.
- **Prune honestly**: a page whose sample falls below the floor 404s on
  revalidation and leaves the sitemap. Zero-traffic pages after 6 months are
  a template problem, not a pruning problem.
- **One entity**: every new surface bridges into the existing tool hub. If a
  surface cannot name the tool it feeds, it is a content page for the blog,
  not a programmatic template.
