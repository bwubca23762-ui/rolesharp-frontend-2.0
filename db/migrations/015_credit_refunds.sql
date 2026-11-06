-- Refunds for generation jobs that failed after the credit was spent.
-- One refund per resume, ever — the worker's failed-handler insert relies on
-- this unique index for idempotency (duplicate callbacks / retries no-op).
create unique index if not exists credit_events_refund_once
  on credit_events (kind, resume_id) where kind = 'refund_failed_generation';

-- Spend/refund lookups by resume were seq-scans.
create index if not exists credit_events_resume_idx
  on credit_events (resume_id) where resume_id is not null;
