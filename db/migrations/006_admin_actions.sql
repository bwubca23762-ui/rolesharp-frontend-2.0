create table if not exists admin_actions (
  id bigserial primary key,
  action text not null,
  target_user_id text,
  target_email text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on admin_actions (created_at desc);
create index if not exists admin_actions_target_idx on admin_actions (target_email, created_at desc);
