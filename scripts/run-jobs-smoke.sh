#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR=""
SMOKE_ROOT="${JOBS_SMOKE_ROOT:-/opt/resume-ai/data/jobs-smoke}"

while (($#)); do
  case "$1" in
    --evidence) EVIDENCE_DIR="${2:-}"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
test -n "$EVIDENCE_DIR" || { echo "--evidence is required" >&2; exit 2; }
case "$EVIDENCE_DIR" in /*) ;; *) echo "--evidence must be absolute" >&2; exit 2 ;; esac
case "$SMOKE_ROOT" in /opt/resume-ai/data/jobs-smoke|/tmp/rolesharp-jobs-smoke) ;; *) echo "unsafe JOBS_SMOKE_ROOT" >&2; exit 2 ;; esac

cd "$ROOT"
for command in docker node npm; do command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }; done
test -n "${DATABASE_URL:-}" || { echo "DATABASE_URL is required" >&2; exit 1; }
for flag in JOBS_WORKFLOWS_ENABLED ROLE_APPLY_GMAIL_SEND_ENABLED ROLE_APPLY_MICROSOFT_SEND_ENABLED; do
  test "${!flag:-false}" = "false" || { echo "$flag must be false before isolated smoke" >&2; exit 1; }
done

RUN_ID="run-$(date -u +%Y%m%d%H%M%S)-$$"
SMOKE_DB="rolesharp_smoke_${RUN_ID//-/_}"
SINK_DIR="$SMOKE_ROOT/$RUN_ID"
RUN_EVIDENCE="$EVIDENCE_DIR/isolated-smoke-$RUN_ID"
mkdir -p "$SINK_DIR" "$RUN_EVIDENCE"
chmod 0750 "$SINK_DIR" "$RUN_EVIDENCE"

database_created=false
cleanup() {
  status=$?
  set +e
  cleanup_failed=false
  database_removed=false
  if [[ -n "${QUEUE_PREFIX:-}" && "${QUEUE_PREFIX:-}" = "rolesharp:smoke:$RUN_ID:" ]]; then
    npm exec -- tsx scripts/cleanup-jobs-smoke.ts >"$RUN_EVIDENCE/redis-cleanup.json" 2>"$RUN_EVIDENCE/redis-cleanup.err"
    [[ $? -eq 0 ]] || cleanup_failed=true
  fi
  if [[ "$database_created" = true && "$SMOKE_DB" =~ ^rolesharp_smoke_run_[0-9]{14}_[0-9]+$ ]]; then
    docker exec resume-pg psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
      -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='$SMOKE_DB' and pid<>pg_backend_pid()" >/dev/null
    if docker exec resume-pg dropdb --if-exists -U postgres "$SMOKE_DB"; then database_removed=true; else cleanup_failed=true; fi
  fi
  expected_sink="$(readlink -f -m "$SMOKE_ROOT/$RUN_ID")"
  actual_sink="$(readlink -f -m "$SINK_DIR")"
  if [[ "$actual_sink" = "$expected_sink" && "$actual_sink" != "$SMOKE_ROOT" && -d "$actual_sink" ]]; then
    rm -rf -- "$actual_sink" || cleanup_failed=true
  fi
  printf '{"runId":"%s","databaseRemoved":%s,"sinkRemoved":%s}\n' \
    "$RUN_ID" "$database_removed" "$([[ ! -e "$SINK_DIR" ]] && echo true || echo false)" >"$RUN_EVIDENCE/cleanup.json"
  if [[ "$cleanup_failed" = true && "$status" -eq 0 ]]; then status=1; fi
  trap - EXIT INT TERM
  exit "$status"
}
trap cleanup EXIT INT TERM

docker exec resume-pg createdb -U postgres "$SMOKE_DB"
database_created=true
ORIGINAL_DATABASE_URL="$DATABASE_URL"
DATABASE_URL="$(DATABASE_URL="$ORIGINAL_DATABASE_URL" SMOKE_DB="$SMOKE_DB" node -e \
  'const u=new URL(process.env.DATABASE_URL);u.pathname=`/${process.env.SMOKE_DB}`;process.stdout.write(u.toString())')"
export DATABASE_URL

docker exec -i resume-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$SMOKE_DB" < db/schema.sql
while IFS= read -r migration; do
  docker exec -i resume-pg psql -v ON_ERROR_STOP=1 -U postgres -d "$SMOKE_DB" < "$migration"
done < <(find db/migrations -maxdepth 1 -type f -name '*.sql' -print | sort)

TOKEN_KEY="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64"))')"
export NODE_ENV=test LOCAL_DEV_MODE=true SITE_URL=https://smoke.invalid
export JOBS_SMOKE_MODE=true JOBS_SMOKE_RUN_ID="$RUN_ID" JOBS_SMOKE_SINK_DIR="$SINK_DIR"
export JOB_WORKFLOW_NAMESPACE="smoke-$RUN_ID" QUEUE_PREFIX="rolesharp:smoke:$RUN_ID:"
export JOBS_WORKFLOWS_ENABLED=true ROLE_APPLY_GMAIL_SEND_ENABLED=true ROLE_APPLY_MICROSOFT_SEND_ENABLED=false
export MAIL_ADAPTER=fake NOTIFICATION_TRANSPORT=local_sink
export MAIL_TOKEN_KEYS="1:$TOKEN_KEY" MAIL_TOKEN_ACTIVE_KEY_VERSION=1
export MAIL_CALLBACK_ORIGINS=https://smoke.invalid
export GMAIL_CONNECTION_CLIENT_ID=smoke-client GMAIL_CONNECTION_CLIENT_SECRET=smoke-secret
export GMAIL_CONNECTION_REDIRECT_URI=https://smoke.invalid/api/mail-connections/gmail/callback
# The production environment may have a Microsoft callback configured even
# when Microsoft sending is disabled.  Override it in the disposable smoke
# process too, otherwise config validation correctly rejects the mixed origin.
export MICROSOFT_CONNECTION_REDIRECT_URI=https://smoke.invalid/api/mail-connections/microsoft/callback

npm exec -- tsx scripts/jobs-smoke-fixture.ts seed >"$RUN_EVIDENCE/seed.json"
npm run worker:recommendation-agent -- --once >"$RUN_EVIDENCE/recommendation-agent.log" 2>&1
npm run worker:auto-apply-agent -- --once >"$RUN_EVIDENCE/auto-apply-agent.log" 2>&1
npm exec -- tsx scripts/jobs-smoke-fixture.ts verify >"$RUN_EVIDENCE/verify.log"
cp "$SINK_DIR/result.json" "$RUN_EVIDENCE/result.json"
cp "$SINK_DIR/events.jsonl" "$RUN_EVIDENCE/events.jsonl"
sha256sum "$RUN_EVIDENCE/result.json" "$RUN_EVIDENCE/events.jsonl" >"$RUN_EVIDENCE/evidence.sha256"
echo "isolated jobs smoke passed: $RUN_ID"
