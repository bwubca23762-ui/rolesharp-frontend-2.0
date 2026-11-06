#!/usr/bin/env bash
# Disposable database + real Next API handlers. Requires PostgreSQL with pgvector.
set -euo pipefail
cd "$(dirname "$0")/.."
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl)")}"
QA_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/rolesharp-admin-qa.XXXXXX")"
EVIDENCE="${ADMIN_QA_EVIDENCE:-.omo/evidence/admin-write-smoke}"
mkdir -p "$EVIDENCE"
QA_SERVER_PID=""
cleanup() {
  if [[ -n "$QA_SERVER_PID" ]]; then kill "$QA_SERVER_PID" 2>/dev/null || true; wait "$QA_SERVER_PID" 2>/dev/null || true; fi
  "$PG_BIN/pg_ctl" -D "$QA_ROOT/db" -m fast stop >/dev/null 2>&1 || true
  rm -rf -- "$QA_ROOT"
}
trap cleanup EXIT
"$PG_BIN/initdb" -D "$QA_ROOT/db" -A trust -U rolesharp_qa > "$EVIDENCE/database-init.log" 2>&1
"$PG_BIN/pg_ctl" -D "$QA_ROOT/db" -l "$QA_ROOT/postgres.log" -o '-h 127.0.0.1 -p 54381' start
"$PG_BIN/createdb" -h 127.0.0.1 -p 54381 -U rolesharp_qa rolesharp_admin_qa
{
  "$PG_BIN/psql" -h 127.0.0.1 -p 54381 -U rolesharp_qa -d rolesharp_admin_qa -v ON_ERROR_STOP=1 -f db/schema.sql
  for migration in db/migrations/*.sql; do
    "$PG_BIN/psql" -h 127.0.0.1 -p 54381 -U rolesharp_qa -d rolesharp_admin_qa -v ON_ERROR_STOP=1 -f "$migration"
  done
} > "$EVIDENCE/migrations.log" 2>&1
# No production environment or provider credentials are inherited. Next dev only
# loads .env.local; disable its voice integration explicitly. No workers start.
env -i PATH="$PATH" HOME="$HOME" \
  NODE_ENV=development LOCAL_DEV_MODE=true DISABLE_DB=false \
  DATABASE_URL=postgresql://rolesharp_qa@127.0.0.1:54381/rolesharp_admin_qa \
  REDIS_URL=redis://127.0.0.1:6399 SITE_URL=http://127.0.0.1:34105 \
  AUTH_SECRET=disposable-local-admin-smoke-only GCP_VOICE_ENABLED=false \
  NOWPAYMENTS_API_KEY=isolated-test-only NOWPAYMENTS_IPN_SECRET=isolated-ipn-test-only \
  SMTP_HOST=127.0.0.1 SMTP_PORT=25281 SMTP_SECURE=false SMTP_IGNORE_TLS=true SMTP_FROM=qa@example.test \
  JOBS_WORKFLOWS_ENABLED=false ROLE_APPLY_GMAIL_SEND_ENABLED=false ROLE_APPLY_MICROSOFT_SEND_ENABLED=false \
  JOBS_QA_DIST_DIR=.next-qa-build \
  node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 34105 > "$EVIDENCE/server.log" 2>&1 &
QA_SERVER_PID=$!
for attempt in {1..60}; do
  kill -0 "$QA_SERVER_PID"
  if curl -s --max-time 2 http://127.0.0.1:34105/api/admin/session >/dev/null; then break; fi
  sleep 1
done
node scripts/admin-write-smoke.mjs > "$EVIDENCE/results.log" 2>&1
node scripts/payment-email-smoke.mjs > "$EVIDENCE/payment-email.log" 2>&1
cat "$EVIDENCE/results.log"
