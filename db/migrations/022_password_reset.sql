alter table users add column if not exists reset_token text;
alter table users add column if not exists reset_token_expires_at timestamptz;
create index if not exists users_reset_token_idx on users (reset_token) where reset_token is not null;
