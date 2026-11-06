#!/usr/bin/env bash
set -euo pipefail

REMOTE="${ROLESHARP_REMOTE_ROOT:-/opt/resume-ai}"
TARGET_RELEASE=""
EXECUTE=false
while (($#)); do
  case "$1" in
    --target-release) TARGET_RELEASE="${2:-}"; shift 2 ;;
    --execute) EXECUTE=true; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
test "$EXECUTE" = true || { echo "read-only by default; pass --execute" >&2; exit 2; }
[[ "$TARGET_RELEASE" =~ ^[0-9]{14}-[0-9]+$ ]] || { echo "invalid target release id" >&2; exit 2; }
TARGET="$REMOTE/releases/$TARGET_RELEASE"
test -d "$TARGET" || { echo "target release does not exist" >&2; exit 1; }
test "$(readlink -f "$TARGET")" = "$TARGET" || { echo "target release path mismatch" >&2; exit 1; }

cd "$REMOTE/current"
bash scripts/verify-jobs-release.sh --production-flags-off
systemctl disable --now rolesharp-recommendation-agent.service rolesharp-auto-apply-agent.service || true
systemctl disable --now rolesharp-jobs-scheduler.service rolesharp-match-worker.service \
  rolesharp-mail-worker.service rolesharp-outbox-worker.service || true
set -a
# shellcheck disable=SC1091
. "$REMOTE/.env"
set +a
JOBS_ROLLBACK_RECONCILE=true npm exec -- tsx scripts/reconcile-jobs-workflows.ts --apply

ln -sfn "$TARGET" "$REMOTE/current.next"
mv -Tf "$REMOTE/current.next" "$REMOTE/current"
systemctl restart resume-web.service resume-worker.service rolesharp-jobs.service
timeout 30 bash -c "until curl -fsS -H 'Host: rolesharp.com' http://127.0.0.1:3000/ >/dev/null; do sleep 1; done"
for service in resume-web resume-worker rolesharp-jobs; do
  test "$(systemctl is-active "$service")" = active || { echo "$service is not active" >&2; exit 1; }
done
echo "rolled back application release to $TARGET_RELEASE; expanded schema retained; workflow agents remain stopped"
