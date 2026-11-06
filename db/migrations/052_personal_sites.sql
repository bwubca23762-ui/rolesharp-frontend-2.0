-- Personal sites: a resume the owner has explicitly put on the open web.
-- Rerunnable. This migration publishes nothing and exposes nobody: every
-- default here is the private one, and a row only becomes readable by a
-- stranger once published_at is set by the owner.

create table if not exists personal_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  -- Lowercase at rest so "Jane" and "jane" can never be two people. The check
  -- mirrors handleError() in lib/personal-site.ts; the reserved-word list lives
  -- there because it changes with the route table, not with the schema.
  handle text not null unique check (handle ~ '^[a-z0-9](?:[a-z0-9]|-[a-z0-9])*$' and length(handle) between 3 and 30),
  resume_id uuid not null references resumes(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  -- Contact details are the part a stranger should not get for free. Off until
  -- the owner says otherwise.
  show_contact boolean not null default false,
  -- Reachable and findable are different decisions. Only the owner makes the
  -- second one; until then the page renders noindex.
  indexable boolean not null default false,
  -- Owner-entered work links. Validated in lib/personal-site.ts on the way in
  -- and cleaned again on the way out, because stored JSON is not trusted input.
  portfolio jsonb not null default '[]'::jsonb,
  -- Null means unpublished, which means the public route 404s.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The public route looks up by handle and only ever wants published rows.
create index if not exists personal_sites_published_idx on personal_sites (handle) where published_at is not null;

-- The public directory and the sitemap list indexable sites only. Published
-- means reachable by link; indexable is the separate, explicit decision to be
-- findable, and only that one puts a page in a crawlable list.
create index if not exists personal_sites_indexable_idx on personal_sites (published_at desc)
  where published_at is not null and indexable;
