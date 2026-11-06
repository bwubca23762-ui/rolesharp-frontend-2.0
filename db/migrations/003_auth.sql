-- Auth: users log in (email+password). Tier lives on the user now.
alter table users add column if not exists password_hash text;
alter table users add column if not exists premium_until timestamptz;
alter table users add column if not exists created_at timestamptz not null default now();

-- resumes belong to a user (in addition to legacy device_id)
alter table resumes add column if not exists user_id_text text; -- store user uuid as text for simple joins
alter table resumes add column if not exists interview jsonb;
alter table resumes add column if not exists linkedin text;

create index if not exists resumes_user_text_idx on resumes (user_id_text, created_at desc);
create unique index if not exists users_email_uniq on users (lower(email));
