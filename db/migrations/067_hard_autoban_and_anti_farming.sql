-- 067: Hard auto-ban & anti-farming security.
-- users.is_banned: sessions die immediately (lib/auth checks it on every
-- request); signup_ip powers signup-velocity auto-bans; banned_identifiers
-- carries the disposable-domain blacklist and auto-banned IPs.
alter table users
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_reason text,
  add column if not exists signup_ip text,
  add column if not exists last_ip text;

create index if not exists users_is_banned_idx on users (is_banned) where is_banned = true;
create index if not exists users_signup_ip_idx on users (signup_ip) where signup_ip is not null;

create table if not exists banned_identifiers (
  id bigserial primary key,
  kind text not null check (kind in ('ip', 'email_domain', 'fingerprint')),
  value text not null unique,
  reason text not null,
  auto_banned boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists banned_identifiers_kind_val on banned_identifiers(kind, value);

insert into banned_identifiers (kind, value, reason) values
  ('email_domain', 'tempmail.com', 'disposable_email_provider'),
  ('email_domain', 'mailinator.com', 'disposable_email_provider'),
  ('email_domain', 'guerrillamail.com', 'disposable_email_provider'),
  ('email_domain', '10minutemail.com', 'disposable_email_provider'),
  ('email_domain', 'yopmail.com', 'disposable_email_provider'),
  ('email_domain', 'trashmail.com', 'disposable_email_provider'),
  ('email_domain', 'sharklasers.com', 'disposable_email_provider'),
  ('email_domain', 'dispostable.com', 'disposable_email_provider'),
  ('email_domain', 'getairmail.com', 'disposable_email_provider'),
  ('email_domain', 'throwawaymail.com', 'disposable_email_provider'),
  ('email_domain', 'burnermail.io', 'disposable_email_provider'),
  ('email_domain', 'mytemp.email', 'disposable_email_provider')
on conflict (value) do nothing;
