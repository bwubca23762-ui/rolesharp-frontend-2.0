-- Customer care: support tickets + threaded messages.
create table if not exists support_tickets (
  id            bigint generated always as identity primary key,
  user_id_text  text,                       -- null for guest (logged-out) tickets
  email         text not null,
  name          text,
  subject       text not null,
  status        text not null default 'open',  -- open | resolved
  last_actor    text not null default 'user',  -- user | admin (who posted last)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on support_tickets (user_id_text, updated_at desc);
create index if not exists support_tickets_status_idx on support_tickets (status, updated_at desc);

create table if not exists support_messages (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references support_tickets(id) on delete cascade,
  author      text not null,                 -- user | admin
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on support_messages (ticket_id, created_at);
