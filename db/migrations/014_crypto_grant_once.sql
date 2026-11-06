-- Make crypto-webhook premium granting exactly-once, even under concurrent or
-- duplicate NOWPayments IPN callbacks. The webhook previously read the stored
-- status, then granted premium if it wasn't already paid — a read-then-write
-- race two callbacks could both pass, double-granting premium days.
alter table crypto_payments add column if not exists premium_granted_at timestamptz;

-- Backfill already-paid orders so a re-sent webhook for an order processed
-- before this migration does not grant a second time.
update crypto_payments
  set premium_granted_at = coalesce(premium_granted_at, updated_at, now())
  where status in ('finished', 'confirmed', 'sending');
