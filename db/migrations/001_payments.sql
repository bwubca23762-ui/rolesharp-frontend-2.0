-- Payment gating: free preview, pay $1 to unlock PDF download.
alter table resumes add column if not exists paid boolean not null default false;
alter table resumes add column if not exists paid_at timestamptz;
alter table resumes add column if not exists candidate_name text;
alter table resumes add column if not exists order_id text;       -- gateway order/session id
alter table resumes add column if not exists amount_cents int default 100; -- $1.00

create index if not exists resumes_order_idx on resumes (order_id);
create index if not exists resumes_paid_idx on resumes (paid, created_at desc);
