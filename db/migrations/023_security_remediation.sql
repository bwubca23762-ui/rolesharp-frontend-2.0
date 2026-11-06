alter table users add column if not exists pending_email text;
alter table users add column if not exists auth_version integer not null default 0;

create unique index if not exists users_pending_email_lower_unique
  on users (lower(pending_email))
  where pending_email is not null;

create unique index if not exists users_telegram_user_id_unique
  on users (telegram_user_id)
  where telegram_user_id is not null;

create unique index if not exists student_claims_user_id_unique
  on student_claims (user_id);

create table if not exists generation_reservations (
  id uuid primary key,
  user_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists generation_reservations_user_created_idx
  on generation_reservations (user_id, created_at desc);
