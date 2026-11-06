-- Indexes left over from the retired per-resume payment model.
--
-- resumes.order_id, resumes.amount_cents, and resumes.device_id have no
-- remaining references anywhere in the application, the workers, or the
-- scripts — payment moved to crypto_payments and quota moved to
-- generation_reservations. Their indexes are therefore pure write cost: every
-- insert and update to resumes maintains three B-trees nothing reads.
--
-- The COLUMNS are deliberately left in place. Migrations here are expand-only
-- and idempotent by convention, a dropped column cannot be recovered from a
-- schema change alone, and the space they occupy on a table this size is not
-- worth the one-way door. Dropping an index is reversible by recreating it;
-- dropping a column is not.
--
-- resumes.paid is NOT in this list and must not be added to it: markPaid()
-- still writes it (lib/db/resumes.ts) and app/api/resume/[id]/route.ts still
-- reads it, so resumes_paid_idx stays.
drop index if exists resumes_order_idx;
drop index if exists resumes_device_day;
