-- Gateway order references must identify exactly one local invoice. New order
-- IDs also include a UUID, so this constraint remains safe under concurrency.
create unique index if not exists crypto_pay_order_unique
  on crypto_payments (order_id);

-- A worker retry must reuse the first credit spend instead of decrementing the
-- balance again. Refunds already have the matching one-per-resume constraint.
create unique index if not exists credit_events_premium_resume_spend_once
  on credit_events (kind, resume_id)
  where kind = 'premium_resume_spend';
