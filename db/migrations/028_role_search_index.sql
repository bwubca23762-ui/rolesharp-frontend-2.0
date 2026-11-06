-- NON_TRANSACTIONAL: CREATE INDEX CONCURRENTLY cannot run inside BEGIN/COMMIT.
-- Production migration runners must execute this file as a standalone psql
-- operation with ON_ERROR_STOP enabled, exactly as deploy.sh does.
-- Role autocomplete uses ILIKE '%term%' and similarity(title, term).
-- A trigram GIN index prevents a sequential scan as the occupation catalogue
-- grows. CONCURRENTLY avoids blocking reads/writes on the live table.
create extension if not exists pg_trgm;

create index concurrently if not exists roles_title_trgm
  on roles using gin (title gin_trgm_ops);
