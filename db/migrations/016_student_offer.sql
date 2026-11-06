-- Student offer: verified academic email → 6 months Premium.
-- premium_until stays the single source of truth for expiry; we only record
-- WHERE the premium came from and which academic email was used.
alter table users add column if not exists premium_source text;
alter table users add column if not exists student_email text;

-- Verification tokens (same hashed-token pattern as email_verification_tokens).
create table if not exists student_verification_tokens (
  id bigserial primary key,
  user_id text not null,
  student_email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists student_verif_token_idx on student_verification_tokens (token_hash);
create index if not exists student_verif_user_idx on student_verification_tokens (user_id, created_at desc);

-- Lifetime claims. Deliberately NOT tied to the users table by FK: deleting an
-- account must not free the academic email for a second 6-month grant.
create table if not exists student_claims (
  student_email text primary key,
  user_id text,
  claimed_at timestamptz not null default now(),
  warn30_sent_at timestamptz,
  expired_sent_at timestamptz,
  winback_sent_at timestamptz,
  winback_opt_out boolean not null default false
);
create index if not exists student_claims_user_idx on student_claims (user_id);
