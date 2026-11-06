-- Stable request receipts for credit-spending actions. A key is scoped to one
-- user and action kind and cannot be silently reused for different input.
create table if not exists action_idempotency (
  user_id uuid not null references users(id) on delete cascade,
  action_kind text not null,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  credit_event_id bigint references credit_events(id) on delete set null,
  response jsonb,
  status text not null default 'started' check (status in ('started','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, action_kind, idempotency_key)
);

create index if not exists action_idempotency_created_idx
  on action_idempotency(created_at);
