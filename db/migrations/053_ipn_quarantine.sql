-- Rejected NOWPayments callbacks, kept so a wrong IPN secret is recoverable.
--
-- Why this exists: verifyIpn() failing returns 400 and the callback is gone.
-- With a wrong NOWPAYMENTS_IPN_SECRET on the box every genuine callback is
-- dropped that way, the order stays at 'waiting' forever, and the customer paid
-- for nothing. That happened at least once on 2026-08-06 and there was no way
-- afterwards to say which callback it had been.
--
-- Two things this makes possible that were impossible before:
--   1. Testing a candidate secret against a real signed payload, instead of
--      spending a real payment to find out whether it verifies.
--   2. Replaying the dropped callbacks once the right secret is installed, so
--      the stuck orders grant themselves rather than being reconciled by hand.
--
-- Only callbacks whose order_id matches a row this app created are stored, so
-- probes against /api/* cannot grow this table and everything in it is a
-- candidate for replay. Bodies carry payout addresses: this is payment data
-- with the same sensitivity as crypto_payments, must never be rendered in the
-- admin UI, and is deleted on successful replay.
-- A delivered callback is deleted, not flagged, so every row present is by
-- definition still pending. There is no replayed_at column for that reason: it
-- would only ever hold null, and a `where replayed_at is null` filter would
-- read like it excluded something.
create table if not exists ipn_quarantine (
  id          bigserial primary key,
  order_id    text not null,
  signature   text not null,
  body        text not null,
  received_at timestamptz not null default now(),
  replay_note text  -- why the last replay attempt was refused, if one was
);

create index if not exists ipn_quarantine_order_idx on ipn_quarantine (order_id);
create index if not exists ipn_quarantine_received_idx on ipn_quarantine (received_at);
