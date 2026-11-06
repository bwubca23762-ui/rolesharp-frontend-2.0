-- Email verification for password accounts.
-- Existing users are trusted so deploy does not lock out current customers.
alter table users add column if not exists email_verified_at timestamptz;
update users set email_verified_at = coalesce(email_verified_at, created_at, now()) where email_verified_at is null;

create table if not exists email_verification_tokens (
  id bigserial primary key,
  user_id uuid references users(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_verification_user_idx on email_verification_tokens (user_id, created_at desc);
create index if not exists email_verification_expires_idx on email_verification_tokens (expires_at);
