-- AI-generated blog posts, stored as JSONB matching the BlogPost shape in
-- lib/blog.ts. File posts (lib/blog-posts.ts) stay as-is; these merge on top.
create table if not exists blog_posts (
  slug           text primary key,
  data           jsonb not null,          -- full BlogPost object
  status         text not null default 'published', -- published | draft
  source         text not null default 'ai',        -- ai | manual
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists blog_posts_status_idx on blog_posts (status, created_at desc);
