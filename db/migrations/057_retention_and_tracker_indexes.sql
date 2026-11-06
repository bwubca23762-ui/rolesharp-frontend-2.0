-- NON_TRANSACTIONAL: CREATE INDEX CONCURRENTLY cannot run inside BEGIN/COMMIT.
-- Production migration runners must execute this file as a standalone psql
-- operation with ON_ERROR_STOP enabled, exactly as deploy.sh does.
--
-- Indexes only. Anything that can roll back lives in 055 instead.

-- deploy.sh reruns every migration on every deploy, so a CONCURRENTLY build
-- interrupted midway would leave an INVALID index behind, and the matching
-- `if not exists` below would then skip it forever — the index would exist, be
-- unusable, and never repair itself. Drop invalid leftovers before rebuilding.
do $$
declare bad text;
begin
  for bad in
    select c.relname from pg_index i
    join pg_class c on c.oid = i.indexrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not i.indisvalid and n.nspname = current_schema()
      and c.relname in (
        'applications_user_updated_idx',
        'notification_outbox_purge_idx',
        'communication_recipients_purge_idx',
        'ipn_quarantine_received_idx'
      )
  loop
    execute format('drop index if exists %I', bad);
  end loop;
end $$;

-- listApplications() orders by (updated_at desc, id desc) and paginates on that
-- same keyset, but the only matching index was (user_id_text, created_at desc).
-- Every tracker load therefore sorted the user's entire row set. The column
-- order here mirrors the ORDER BY exactly so the sort disappears.
create index concurrently if not exists applications_user_updated_idx
  on applications (user_id_text, updated_at desc, id desc);

-- scripts/retention-purge.ts deletes by these predicates nightly. page_views,
-- product_events and email_log already carry a created_at index; these three
-- did not, and without them the purge sequential-scans the table every night.
create index concurrently if not exists notification_outbox_purge_idx
  on notification_outbox (purge_after) where purge_after is not null;
create index concurrently if not exists communication_recipients_purge_idx
  on communication_recipients (purge_after) where purge_after is not null;
create index concurrently if not exists ipn_quarantine_received_idx
  on ipn_quarantine (received_at);
