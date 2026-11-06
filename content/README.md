# content/

Homes for first-class content/data modules migrated out of `lib/` (blog posts,
competitor data) during the Phase 6 monolith refactor. Compatibility barrels
remain in `lib/` so existing `@/lib/blog-posts`, `@/lib/competitors`, etc.
imports keep working until consumers are updated.

Phase 3 CSS compatibility staging lives separately in `app/compat/`; its
aggregator preserves the tracked `app/globals-compat.css` cascade byte-for-byte.
