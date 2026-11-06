#!/usr/bin/env bash
# Deploy resume-ai (RoleSharp) to the VPS.
# CRITICAL: the build must load /opt/resume-ai/.env so SITE_URL (and other vars)
# are present at BUILD time — otherwise Next bakes the fallback IP into canonical
# / OG / sitemap tags and Google indexes the raw IP instead of rolesharp.com.
set -euo pipefail

# The origin IP is deliberately not in this file. Cloudflare fronts the site and
# ufw only admits Cloudflare ranges, so publishing the origin address in a repo
# gives an attacker the one piece of information that setup is built to withhold
# and costs nothing to keep out. Export this once in your shell profile:
#   export ROLESHARP_SSH_HOST=rolesharp-admin@<origin-ip>
HOST="${ROLESHARP_SSH_HOST:-}"
if [ -z "$HOST" ]; then
  echo "ROLESHARP_SSH_HOST is not set (expected 'rolesharp-admin@<origin-ip>')." >&2
  exit 1
fi
KEY="${ROLESHARP_SSH_KEY:-/root/.ssh/rolesharp_vps_20260729}"
# accept-new pins the host key on first contact and REFUSES a changed key
# (StrictHostKeyChecking=no silently accepted a MITM'd host).
# A production build can spend several minutes in static generation with little
# terminal output. Keep the authenticated transport alive during that phase so
# a quiet connection cannot strand an otherwise completed release before its
# smoke checks and activation steps.
SSH_BIN=(ssh -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o ServerAliveInterval=30 -o ServerAliveCountMax=6)
# Production disables root SSH. All deployment operations execute through the
# dedicated key-only administrator and its tightly scoped passwordless sudo;
# this keeps the release workflow usable without reopening root login.
remote_ssh() {
  local remote_host="$1"
  local command="$2"
  "${SSH_BIN[@]}" "$remote_host" "sudo -n bash -lc $(printf '%q' "$command")"
}
SSH=remote_ssh
RSYNC_SSH="${SSH_BIN[*]}"
REMOTE="/opt/resume-ai"
EXPECTED_SITE_URL="https://rolesharp.com"
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$$"
RELEASE="$REMOTE/releases/$RELEASE_ID"
SOURCE_COMMIT="$(git rev-parse HEAD 2>/dev/null || printf 'unversioned')"
EVIDENCE="$REMOTE/data/deploy-evidence/$RELEASE_ID"

echo "==> local preflight"
test -f "$KEY" || { echo "missing SSH key: $KEY" >&2; exit 1; }
command -v rsync >/dev/null || { echo "rsync is required" >&2; exit 1; }
$SSH "$HOST" "test -f $REMOTE/.env" 2>/dev/null
PREFLIGHT_RC=$?
# A dead SSH connection exits non-zero too — report THAT instead of lying
# about a missing .env (which sent us chasing a file that exists).
if [ $PREFLIGHT_RC -eq 255 ]; then
  echo "ssh to $HOST failed during preflight (transient?)" >&2
  exit 1
fi
if [ $PREFLIGHT_RC -ne 0 ]; then
  echo "missing $REMOTE/.env on the VPS" >&2
  exit 1
fi
$SSH "$HOST" "set -a; . $REMOTE/.env; set +a; \
  test \"\${SITE_URL:-}\" = '$EXPECTED_SITE_URL' && \
  test -n \"\${DATABASE_URL:-}\" && \
  test \"\${LOCAL_DEV_MODE:-false}\" = false && \
  test \"\${DISABLE_DB:-false}\" = false && \
  test -n \"\${AUTH_SECRET:-}\" && \
  test -n \"\${ADMIN_TOTP_SECRET:-}\" && \
  test \"\${JOBS_WORKFLOWS_ENABLED:-false}\" = false && \
  test \"\${ROLE_APPLY_GMAIL_SEND_ENABLED:-false}\" = false && \
  test \"\${ROLE_APPLY_MICROSOFT_SEND_ENABLED:-false}\" = false && \
  test \"\${MAIL_ADAPTER:-provider}\" != fake && \
  test \"\${NOTIFICATION_TRANSPORT:-provider}\" != local_sink && \
  test \"\${JOBS_SMOKE_MODE:-false}\" != true" || {
  echo "VPS core settings must be configured and every Jobs workflow/provider/fake flag must be off before deploying" >&2
  exit 1
}
$SSH "$HOST" "docker exec resume-pg pg_isready -U postgres -d resumeai >/dev/null" || {
  echo "VPS Postgres is not ready" >&2
  exit 1
}
$SSH "$HOST" "test \"\$(docker exec resume-pg psql -At -v ON_ERROR_STOP=1 -U postgres -d resumeai -c \
  \"select count(*)=0 from feature_flags where enabled and name in ('jobs_daily_matches','role_apply_prepare','role_apply_gmail_send','role_apply_microsoft_send')\")\" = t" || {
  echo "one or more production Jobs workflow database flags are enabled; refusing deployment" >&2
  exit 1
}

echo "==> create isolated release $RELEASE_ID"
$SSH "$HOST" "set -e
  { getent group rolesharp >/dev/null || groupadd --system rolesharp; }
  { id -u rolesharp >/dev/null 2>&1 || useradd --system --gid rolesharp --home-dir '$REMOTE' --shell /usr/sbin/nologin rolesharp; }
  install -d -m 0755 '$REMOTE/releases' '$RELEASE'
  install -d -o rolesharp -g rolesharp -m 0750 '$REMOTE/data/deploy-evidence' '$EVIDENCE'"

echo "==> rsync release (excluding secrets and runtime data)"
rsync -az --rsync-path="sudo -n rsync" \
  --exclude node_modules --exclude '.next*' --exclude .git --exclude .omo --exclude .local --exclude .venv-jobs \
  --exclude '.workbuddy-ai' --exclude 'outputs' \
  --exclude '.ssh' --exclude '*.pem' --exclude '*.key' --exclude '*private*key*' \
  --exclude 'C*Usershyper' --exclude '.rotate-vps-key.sh' --exclude 'audits' \
  --exclude 'data' \
  --exclude '__pycache__' --exclude '*.py[cod]' \
  --exclude '.env' --exclude '.env.local' --exclude '.env.production' \
  -e "$RSYNC_SSH" ./ "$HOST:$RELEASE/"

echo "==> create release and schema manifests"
$SSH "$HOST" "set -euo pipefail
  cd '$RELEASE'
  # Next rewrites next-env.d.ts to point at the active build directory. It is a
  # generated declaration, so verify immutable source while excluding that file.
  find . -type f ! -name '.release-*' ! -name 'next-env.d.ts' -print0 | sort -z | xargs -0 sha256sum > .release-manifest.sha256
  { sha256sum db/schema.sql; find db/migrations -maxdepth 1 -type f -name '*.sql' -print0 | sort -z | xargs -0 sha256sum; } > .release-schema.sha256
  sha256sum .release-manifest.sha256 .release-schema.sha256 > '$EVIDENCE/source-manifests.sha256'"

echo "==> build isolated release before touching the live process"
$SSH "$HOST" "set -euo pipefail
  cd '$RELEASE'
  set -a
  . '$REMOTE/.env'
  set +a
  if [ -n \"\${INDEXNOW_KEY:-}\" ]; then
    case \"\$INDEXNOW_KEY\" in
      *[!a-zA-Z0-9-]*) echo 'Invalid IndexNow key format' >&2; exit 1 ;;
    esac
    if [ ! -f \"public/\$INDEXNOW_KEY.txt\" ] || [ \"\$(cat \"public/\$INDEXNOW_KEY.txt\")\" != \"\$INDEXNOW_KEY\" ]; then
      echo 'The configured IndexNow key needs a matching public verification file' >&2
      exit 1
    fi
  fi
  npm ci --include=dev --no-audit --no-fund
  python3 -m venv .venv-jobs
  .venv-jobs/bin/pip install --disable-pip-version-check -r requirements-jobs.txt
  rm -rf .next
  npm run build
  ln -sfn '$REMOTE/data' data
  install -d -o rolesharp -g rolesharp -m 0755 .next/cache/images .next/server/app
  chown -R rolesharp:rolesharp .next/cache .next/server/app"

echo "==> verified pre-migration database backup"
$SSH "$HOST" "set -euo pipefail
  install -d -o root -g root -m 0700 '$REMOTE/data/backups'
  umask 027
  test -r /root/.backup-passphrase
  docker exec resume-pg pg_dump -Fc -U postgres resumeai | gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 --passphrase-file /root/.backup-passphrase -o '$REMOTE/data/backups/resumeai-pre-$RELEASE_ID.dump.gpg'
  test -s '$REMOTE/data/backups/resumeai-pre-$RELEASE_ID.dump.gpg'
  verify_dump='$REMOTE/data/backups/.verify-pre-$RELEASE_ID.dump'
  container_verify='/tmp/rolesharp-verify-pre-$RELEASE_ID.dump'
  rm -f "\$verify_dump"
  gpg --batch --yes --pinentry-mode loopback --decrypt --passphrase-file /root/.backup-passphrase --output "\$verify_dump" '$REMOTE/data/backups/resumeai-pre-$RELEASE_ID.dump.gpg'
  chmod 0600 "\$verify_dump"
  docker cp "\$verify_dump" "resume-pg:\$container_verify"
  docker exec resume-pg pg_restore -l "\$container_verify" > '$EVIDENCE/pre-migration-backup.list'
  docker exec resume-pg rm -f -- "\$container_verify"
  rm -f "\$verify_dump"
  test -s '$EVIDENCE/pre-migration-backup.list'
  sha256sum '$REMOTE/data/backups/resumeai-pre-$RELEASE_ID.dump.gpg' > '$EVIDENCE/pre-migration-backup.sha256'"

echo "==> run DB migrations (idempotent, in order) only after build succeeds"
# Two things went wrong here before and both are fixed:
#
# 1. This loop had no `set -euo pipefail`. The exit status of a `for` loop is the
#    status of its LAST iteration, so a migration failing anywhere except the
#    final file was silently swallowed and the deploy carried straight on.
# 2. psql ran without --single-transaction, so every top-level statement
#    autocommitted. That is what let 048 abort halfway and still leave its
#    triggers installed in production while the migration itself had failed.
#
# Files marked NON_TRANSACTIONAL (028 uses CREATE INDEX CONCURRENTLY, which
# Postgres refuses inside BEGIN/COMMIT) still run without the flag.
$SSH "$HOST" "set -euo pipefail
  for f in \$(find '$RELEASE'/db/migrations -maxdepth 1 -type f -name '*.sql' | sort); do
    echo \"-- \$(basename \$f)\";
    if grep -q NON_TRANSACTIONAL \"\$f\"; then tx=; else tx=--single-transaction; fi
    docker exec -i resume-pg psql -v ON_ERROR_STOP=1 \$tx -U postgres -d resumeai < \"\$f\";
  done"

echo "==> prove migration no-op rerun and record deployed schema"
$SSH "$HOST" "set -euo pipefail
  for f in \$(find '$RELEASE'/db/migrations -maxdepth 1 -type f -name '*.sql' | sort); do
    if grep -q NON_TRANSACTIONAL \"\$f\"; then tx=; else tx=--single-transaction; fi
    docker exec -i resume-pg psql -v ON_ERROR_STOP=1 \$tx -U postgres -d resumeai < \"\$f\" >/dev/null
  done
  cd '$RELEASE'
  set -a
  . '$REMOTE/.env'
  set +a
  npm exec -- tsx scripts/schema-digest.ts > .release-database-schema.digest
  test \"\$(tr -d '[:space:]' < .release-database-schema.digest)\" != ''
  source_manifest_digest=\"\$(sha256sum .release-manifest.sha256 | cut -d' ' -f1)\"
  printf '{\"releaseId\":\"%s\",\"sourceCommit\":\"%s\",\"sourceManifestDigest\":\"%s\",\"schemaDigest\":\"%s\"}\\n' \
    '$RELEASE_ID' '$SOURCE_COMMIT' \"\$source_manifest_digest\" \
    \"\$(tr -d '[:space:]' < .release-database-schema.digest)\" > .release-metadata.json
  bash scripts/verify-jobs-release.sh --production-flags-off > '$EVIDENCE/release-verification.json'"

echo "==> run disposable fake-provider smoke (production flags remain off)"
$SSH "$HOST" "set -euo pipefail
  cd '$RELEASE'
  set -a
  . '$REMOTE/.env'
  set +a
  bash scripts/run-jobs-smoke.sh --evidence '$EVIDENCE'"

echo "==> install hardened services and atomically activate release"
$SSH "$HOST" "set -euo pipefail
  { getent group rolesharp >/dev/null || groupadd --system rolesharp; } && \
  { id -u rolesharp >/dev/null 2>&1 || useradd --system --gid rolesharp --home-dir $REMOTE --shell /usr/sbin/nologin rolesharp; } && \
  install -d -o rolesharp -g rolesharp -m 0750 $REMOTE/data && \
  install -d -o root -g root -m 0700 $REMOTE/data/backups && \
  chown root:rolesharp $REMOTE/.env && chmod 0640 $REMOTE/.env && \
  install -m 0644 '$RELEASE'/deploy/resume-web.service /etc/systemd/system/resume-web.service && \
  install -m 0644 '$RELEASE'/deploy/resume-worker.service /etc/systemd/system/resume-worker.service && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-jobs.service /etc/systemd/system/rolesharp-jobs.service && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-recommendation-agent.service /etc/systemd/system/rolesharp-recommendation-agent.service && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-auto-apply-agent.service /etc/systemd/system/rolesharp-auto-apply-agent.service && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-blog-worker.service /etc/systemd/system/rolesharp-blog-worker.service && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-job-alerts.service /etc/systemd/system/rolesharp-job-alerts.service && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-ops-helper.service /etc/systemd/system/rolesharp-ops-helper.service && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-watchdog.service /etc/systemd/system/rolesharp-watchdog.service && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-watchdog.timer /etc/systemd/system/rolesharp-watchdog.timer && \
  install -m 0750 '$RELEASE'/scripts/backup-postgres.sh /usr/local/sbin/rolesharp-postgres-backup && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-postgres-backup.service /etc/systemd/system/rolesharp-postgres-backup.service && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-postgres-backup.timer /etc/systemd/system/rolesharp-postgres-backup.timer && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-communications.service /etc/systemd/system/rolesharp-communications.service && \
  install -m 0644 '$RELEASE'/deploy/rolesharp-communications.timer /etc/systemd/system/rolesharp-communications.timer && \
  chmod 0755 '$RELEASE'/scripts/watchdog.sh && \
  install -m 0644 '$RELEASE'/deploy/cloudflare-real-ip.conf /etc/nginx/snippets/cloudflare-real-ip.conf && \
  install -m 0644 '$RELEASE'/deploy/nginx-site.conf /etc/nginx/sites-available/rolesharp && \
  nginx -t
  systemctl daemon-reload
  systemctl disable --now rolesharp-match-worker.service rolesharp-mail-worker.service \
    rolesharp-outbox-worker.service rolesharp-jobs-scheduler.service || true
  systemctl enable resume-web.service resume-worker.service rolesharp-jobs.service \
    rolesharp-recommendation-agent.service rolesharp-auto-apply-agent.service \
    rolesharp-blog-worker.service rolesharp-job-alerts.service rolesharp-ops-helper.service
  # The watchdog is a timer, not a service to restart below: enabling it with
  # --now starts the timer without firing a probe mid-deploy.
  systemctl enable --now rolesharp-watchdog.timer
  systemctl enable --now rolesharp-postgres-backup.timer
  # The communications outbox drains one batch per tick (Type=oneshot on a
  # timer). Enabling it here means campaign sends move without hand runs.
  systemctl enable --now rolesharp-communications.timer

  previous=\$(readlink -f '$REMOTE/current' 2>/dev/null || printf '%s' '$REMOTE')
  ln -sfn '$RELEASE' '$REMOTE/current.next'
  mv -Tf '$REMOTE/current.next' '$REMOTE/current'

  if systemctl restart resume-web resume-worker rolesharp-jobs \
       rolesharp-recommendation-agent rolesharp-auto-apply-agent rolesharp-blog-worker \
       rolesharp-job-alerts rolesharp-ops-helper &&
     systemctl reload nginx &&
     timeout 30 bash -c \"until curl -fsS -H 'Host: rolesharp.com' http://127.0.0.1:3000/ >/dev/null; do sleep 1; done\" &&
     test \"\$(systemctl is-active resume-web)\" = active &&
     test \"\$(systemctl is-active resume-worker)\" = active &&
     test \"\$(systemctl is-active rolesharp-jobs)\" = active &&
     test \"\$(systemctl is-active rolesharp-recommendation-agent)\" = active &&
     test \"\$(systemctl is-active rolesharp-auto-apply-agent)\" = active &&
     test \"\$(systemctl is-active rolesharp-blog-worker)\" = active &&
     test \"\$(systemctl is-active rolesharp-job-alerts)\" = active &&
     test \"\$(systemctl is-active rolesharp-ops-helper)\" = active; then
    printf '%s\n' '$RELEASE_ID' > '$REMOTE/current-release'
    echo 'release activated'
    # Nothing pruned these before, so releases/ had grown to 32G across 22 trees
    # (each carries its own node_modules and .next). Keep the 5 newest plus
    # whatever 'current' points at -- that is enough to roll back by hand.
    keep=\$(readlink -f '$REMOTE/current')
    ls -1d '$REMOTE'/releases/*/ 2>/dev/null | sort | head -n -5 | while read -r old; do
      [ \"\$(readlink -f \"\$old\")\" = \"\$keep\" ] && continue
      echo \"pruning release \$(basename \"\$old\")\"
      rm -rf -- \"\$old\"
    done
  else
    echo 'activation failed; restoring previous release' >&2
    ln -sfn \"\$previous\" '$REMOTE/current.next'
    mv -Tf '$REMOTE/current.next' '$REMOTE/current'
    # The previous release may not contain the new agent scripts. Disable the
    # workflow agents rather than leaving unsupported units restart-looping.
    systemctl disable --now rolesharp-recommendation-agent rolesharp-auto-apply-agent \
      rolesharp-blog-worker || true
    systemctl restart resume-web resume-worker rolesharp-jobs || true
    exit 1
  fi"

echo "==> purge Cloudflare cache (so deploys are visible immediately)"
# Uses CF_ZONE_ID + CF_PURGE_TOKEN from the server's .env. Best-effort: a
# missing token must never fail the deploy — it just means purge by hand.
$SSH "$HOST" 'set -a; . /opt/resume-ai/.env; set +a;
if [ -n "${CF_ZONE_ID:-}" ] && [ -n "${CF_PURGE_TOKEN:-}" ] && \
   [ "${CF_ZONE_ID#paste_}" = "${CF_ZONE_ID}" ] && \
   [ "${CF_PURGE_TOKEN#paste_}" = "${CF_PURGE_TOKEN}" ]; then
  curl -s -m10 -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_PURGE_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"purge_everything\":true}" | grep -o "\"success\":[a-z]*" || echo "purge request failed"
else
  echo "CF_ZONE_ID / CF_PURGE_TOKEN missing or placeholder — skipping purge"
fi'

echo "==> health check"
sleep 4
$SSH "$HOST" "test \"\$(systemctl is-active resume-web)\" = active && \
  test \"\$(systemctl is-active resume-worker)\" = active && \
  test \"\$(systemctl is-active rolesharp-jobs)\" = active && \
  test \"\$(systemctl is-active rolesharp-recommendation-agent)\" = active && \
  test \"\$(systemctl is-active rolesharp-auto-apply-agent)\" = active && \
  test \"\$(systemctl is-active rolesharp-blog-worker)\" = active && \
  test \"\$(systemctl is-enabled rolesharp-match-worker 2>/dev/null || true)\" != enabled && \
  test \"\$(systemctl is-enabled rolesharp-mail-worker 2>/dev/null || true)\" != enabled && \
  test \"\$(systemctl is-enabled rolesharp-outbox-worker 2>/dev/null || true)\" != enabled && \
  test \"\$(systemctl is-enabled rolesharp-jobs-scheduler 2>/dev/null || true)\" != enabled && \
  cd '$RELEASE' && bash scripts/verify-jobs-release.sh --production-flags-off >/dev/null && \
  echo 'web=active worker=active ingestion=active recommendation-agent=active auto-apply-agent=active blog=active legacy-workflows=disabled flags=off'"

HOME_STATUS="$(curl -sS -m12 -o /dev/null -w '%{http_code}' "$EXPECTED_SITE_URL/")"
test "$HOME_STATUS" = "200" || { echo "homepage returned HTTP $HOME_STATUS" >&2; exit 1; }

LOCALE_STATUS="$(curl -sS -m12 -o /dev/null -w '%{http_code}' "$EXPECTED_SITE_URL/en-us")"
test "$LOCALE_STATUS" = "200" || { echo "locale page returned HTTP $LOCALE_STATUS" >&2; exit 1; }

BAD_LOCALE_STATUS="$(curl -sS -m12 -o /dev/null -w '%{http_code}' "$EXPECTED_SITE_URL/zz-zz")"
test "$BAD_LOCALE_STATUS" = "404" || { echo "bad locale returned HTTP $BAD_LOCALE_STATUS" >&2; exit 1; }

# Validate the sitemap against the ORIGIN app directly (via SSH → localhost:3000,
# matching the nginx proxy_pass upstream). Curling the public IP fails TLS
# verification because the origin uses a Cloudflare Origin CA cert that only
# Cloudflare trusts; and curling through Cloudflare can hit a stale cache.
# The canonical sitemap may be either a single urlset or an index. Validate the
# format served by the origin so a stale CDN response cannot mask deploy issues.
SITEMAP="$($SSH "$HOST" "curl -sS -m30 -H 'Host: rolesharp.com' http://127.0.0.1:3000/sitemap.xml" || true)"
printf '%s' "$SITEMAP" | grep -Eq '<(urlset|sitemapindex)([ >])' || {
  echo "invalid sitemap: missing <urlset> or <sitemapindex>" >&2
  echo "--- diagnostics ---" >&2
  $SSH "$HOST" "curl -sS -m20 -H 'Host: rolesharp.com' -o /tmp/sitemap-check.out -w 'HTTP %{http_code}, %{size_download} bytes, %{time_total}s\n' http://127.0.0.1:3000/sitemap.xml; head -c 400 /tmp/sitemap-check.out; echo; journalctl -u resume-web --no-pager -n 20 -o cat | tail -12" >&2 || true
  exit 1
}
printf '%s' "$SITEMAP" | grep -q "<loc>$EXPECTED_SITE_URL/" || { echo "sitemap has no canonical site URLs" >&2; exit 1; }
PAGES_SEG="$SITEMAP"
if printf '%s' "$SITEMAP" | grep -q '<sitemapindex'; then
  printf '%s' "$SITEMAP" | grep -q "<loc>$EXPECTED_SITE_URL/sitemaps/" || { echo "sitemap index has no segment entries" >&2; exit 1; }
  PAGES_SEG="$($SSH "$HOST" "curl -sS -m60 -H 'Host: rolesharp.com' http://127.0.0.1:3000/sitemaps/pages.xml" || true)"
  printf '%s' "$PAGES_SEG" | grep -q '<urlset' || { echo "pages segment invalid: missing <urlset>" >&2; exit 1; }
fi
printf '%s' "$PAGES_SEG" | grep -q "<loc>$EXPECTED_SITE_URL" || { echo "pages segment has no $EXPECTED_SITE_URL <loc> entries" >&2; exit 1; }
# Warm the remaining segments without blocking the deploy.
# Warm every LIVE segment (the index's own list). resumes-* retired as empty
# documents on 2026-10-06 — warming them was wasted work.
$SSH "$HOST" "for s in pages blog jobs hubs salaries interview-questions people; do curl -sS -m120 -o /dev/null -H 'Host: rolesharp.com' http://127.0.0.1:3000/sitemaps/\$s.xml || true; done >/dev/null 2>&1 &" || true
# Best-effort: warn (never fail) if the CDN copy is still stale.
if ! curl -fsS -m12 "$EXPECTED_SITE_URL/sitemap.xml" | grep -q '<sitemapindex'; then
  echo "WARNING: Cloudflare is still serving a stale sitemap — purge the CF cache (set CF_ZONE_ID/CF_PURGE_TOKEN in /opt/resume-ai/.env or purge in the dashboard)."
fi
if printf '%s' "$SITEMAP" | grep -q 'localhost'; then
  echo "sitemap contains localhost URLs" >&2
  exit 1
fi

# Anonymous job API requests must remain blocked; redirects are also acceptable.
JOBS_STATUS="$(curl -sS -m12 -o /dev/null -w '%{http_code}' "$EXPECTED_SITE_URL/api/jobs")"
case "$JOBS_STATUS" in
  401|403|302|307|308) ;;
  *) echo "anonymous /api/jobs returned unsafe HTTP $JOBS_STATUS" >&2; exit 1 ;;
esac

echo "$EXPECTED_SITE_URL = $HOME_STATUS, locale=$LOCALE_STATUS, bad-locale=$BAD_LOCALE_STATUS, sitemap=valid, anonymous-jobs=$JOBS_STATUS"

echo "==> verify encrypted DB backup service"
$SSH "$HOST" 'test -r /root/.backup-passphrase && \
systemctl start rolesharp-postgres-backup.service && \
test "$(systemctl show -p Result --value rolesharp-postgres-backup.service)" = success && \
find /opt/resume-ai/data/backups -maxdepth 1 -type f -name "*.dump.gpg" -size +0c | grep -q . && \
(crontab -l 2>/dev/null | grep -v "pg_dump.*resumeai") | crontab -'

# Installed here, not left to the runbook, because the retention windows this
# runs are ones the privacy policy already states as fact to users. A purge
# script that depends on someone remembering to schedule it is how the previous
# three retention promises ended up unimplemented for a year. Runs after the
# 03:00 backup so a purge is always captured in a dump taken before it.
echo "==> setup daily retention purge"
$SSH "$HOST" '(crontab -l 2>/dev/null | grep -v "retention-purge"; echo "40 3 * * * cd /opt/resume-ai/current && set -a && . /opt/resume-ai/.env && set +a && npx tsx scripts/retention-purge.ts >> /var/log/retention-purge.log 2>&1") | crontab -'

echo "==> done"
