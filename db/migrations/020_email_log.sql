create table if not exists email_log (
  id          bigint generated always as identity primary key,
  recipient   text not null,
  subject     text not null,
  type        text not null,  -- 'verification' | 'password_reset' | 'support_reply' | 'student_verify' | 'admin_notify'
  status      text not null default 'sent',  -- 'sent' | 'failed'
  error_msg   text,
  created_at  timestamptz not null default now()
);
create index if not exists email_log_created_at_idx on email_log (created_at desc);
create index if not exists email_log_type_idx on email_log (type);
