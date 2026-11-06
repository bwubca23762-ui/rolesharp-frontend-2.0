#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROLESHARP_ENV_FILE:-/opt/resume-ai/.env}"
REQUIRE_FLAGS_OFF=false

while (($#)); do
  case "$1" in
    --production-flags-off) REQUIRE_FLAGS_OFF=true; shift ;;
    --env-file) ENV_FILE="${2:-}"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

cd "$ROOT"
test -f "$ENV_FILE" || { echo "missing environment file" >&2; exit 1; }
test -f .release-manifest.sha256 || { echo "missing release manifest" >&2; exit 1; }
test -f .release-schema.sha256 || { echo "missing schema manifest" >&2; exit 1; }
test -f .release-metadata.json || { echo "missing release metadata" >&2; exit 1; }
sha256sum -c --quiet .release-manifest.sha256
sha256sum -c --quiet .release-schema.sha256
source_manifest_digest="$(sha256sum .release-manifest.sha256 | cut -d' ' -f1)"
recorded_source_manifest_digest="$(node -e 'const fs=require("fs");const value=JSON.parse(fs.readFileSync(".release-metadata.json","utf8")).sourceManifestDigest;process.stdout.write(typeof value === "string" ? value : "")')"
test "$recorded_source_manifest_digest" = "$source_manifest_digest" || {
  echo "source manifest digest does not match the release record" >&2
  exit 1
}

for unit in rolesharp-recommendation-agent rolesharp-auto-apply-agent; do
  test -f "deploy/$unit.service" || { echo "missing $unit.service" >&2; exit 1; }
  grep -Fq 'User=rolesharp' "deploy/$unit.service"
  grep -Fq 'NoNewPrivileges=true' "deploy/$unit.service"
  grep -Fq 'ProtectSystem=strict' "deploy/$unit.service"
  grep -Fq 'TimeoutStopSec=90' "deploy/$unit.service"
done
grep -Fq 'worker:recommendation-agent' deploy/rolesharp-recommendation-agent.service
grep -Fq 'worker:auto-apply-agent' deploy/rolesharp-auto-apply-agent.service
grep -Fq 'new Worker("jobs-match"' worker/recommendation-agent.ts
grep -Fq 'new Worker("jobs-digest"' worker/recommendation-agent.ts
grep -Fq 'new Worker("notification-outbox"' worker/recommendation-agent.ts
grep -Fq 'new Worker("application-package"' worker/auto-apply-agent.ts
grep -Fq 'new Worker("mailbox-dispatch"' worker/auto-apply-agent.ts
grep -Fq '"worker:recommendation-agent": "tsx worker/recommendation-agent.ts"' package.json
grep -Fq '"worker:auto-apply-agent": "tsx worker/auto-apply-agent.ts"' package.json
grep -Fq 'systemctl disable --now rolesharp-match-worker.service rolesharp-mail-worker.service' deploy.sh

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
if [[ "$REQUIRE_FLAGS_OFF" = true ]]; then
  for flag in JOBS_WORKFLOWS_ENABLED ROLE_APPLY_GMAIL_SEND_ENABLED ROLE_APPLY_MICROSOFT_SEND_ENABLED; do
    test "${!flag:-false}" = false || { echo "$flag must be false" >&2; exit 1; }
  done
  test "${MAIL_ADAPTER:-provider}" != fake || { echo "production MAIL_ADAPTER cannot be fake" >&2; exit 1; }
  test "${NOTIFICATION_TRANSPORT:-provider}" != local_sink || { echo "production notification transport cannot be local_sink" >&2; exit 1; }
  test "${JOBS_SMOKE_MODE:-false}" != true || { echo "production smoke mode must be false" >&2; exit 1; }
  flags_off="$(docker exec resume-pg psql -At -v ON_ERROR_STOP=1 -U postgres -d resumeai -c \
    "select count(*)=4 and bool_and(not enabled) from feature_flags where name in ('jobs_daily_matches','role_apply_prepare','role_apply_gmail_send','role_apply_microsoft_send')")"
  test "$flags_off" = t || { echo "database Jobs workflow flags are not all present and disabled" >&2; exit 1; }
fi

schema_digest="$(npm exec -- tsx scripts/schema-digest.ts)"
test "$schema_digest" = "$(tr -d '[:space:]' < .release-database-schema.digest)" || {
  echo "database schema digest does not match the release record" >&2
  exit 1
}
printf '{"releaseVerified":true,"productionFlagsOff":%s,"schemaDigest":"%s"}\n' "$REQUIRE_FLAGS_OFF" "$schema_digest"
