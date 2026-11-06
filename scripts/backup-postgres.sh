#!/usr/bin/env bash
# Create a verified, encrypted PostgreSQL backup without exposing dump bytes to
# the application process. This is intentionally root-only on the VPS.
set -euo pipefail

BACKUP_DIR="${ROLESHARP_BACKUP_DIR:-/opt/resume-ai/data/backups}"
PASSPHRASE_FILE="${ROLESHARP_BACKUP_PASSPHRASE_FILE:-/root/.backup-passphrase}"
RETENTION_DAYS="${ROLESHARP_BACKUP_RETENTION_DAYS:-7}"
GNUPG_HOME="${ROLESHARP_BACKUP_GNUPG_HOME:-/var/lib/rolesharp-backup/gnupg}"
JSON_OUTPUT=false

if [[ "${1:-}" == "--json" ]]; then
  JSON_OUTPUT=true
elif [[ $# -ne 0 ]]; then
  echo "usage: $0 [--json]" >&2
  exit 64
fi

[[ -r "$PASSPHRASE_FILE" ]] || {
  echo "backup passphrase file is missing or unreadable" >&2
  exit 1
}

umask 027
install -d -o root -g root -m 0700 "$BACKUP_DIR"
install -d -o root -g root -m 0700 "$GNUPG_HOME"
export GNUPGHOME="$GNUPG_HOME"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$BACKUP_DIR/resumeai-$timestamp.dump.gpg"
temporary="$(mktemp "$BACKUP_DIR/.resumeai-$timestamp.XXXXXX.dump.gpg")"
verification="$(mktemp "$BACKUP_DIR/.verify-$timestamp.XXXXXX.dump")"
container_verification="/tmp/rolesharp-backup-$timestamp.dump"
cleanup() {
  rm -f -- "$temporary" "$verification"
  docker exec resume-pg rm -f -- "$container_verification" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# The archive is encrypted before it is written to disk. Decrypting to a
# root-only temporary file forces GPG to verify the entire encrypted stream;
# pg_restore -l is then a non-mutating PostgreSQL archive check. The plaintext
# is deleted from both host and container immediately afterwards.
docker exec resume-pg pg_dump -Fc -U postgres resumeai \
  | gpg --batch --yes --no-options --pinentry-mode loopback --symmetric --cipher-algo AES256 \
      --passphrase-file "$PASSPHRASE_FILE" --output "$temporary"
gpg --batch --yes --no-options --pinentry-mode loopback --decrypt \
  --passphrase-file "$PASSPHRASE_FILE" --output "$verification" "$temporary"
chmod 0600 "$verification"
docker cp "$verification" "resume-pg:$container_verification"
docker exec resume-pg pg_restore -l "$container_verification" >/dev/null
docker exec resume-pg rm -f -- "$container_verification"
rm -f -- "$verification"

chmod 0600 "$temporary"
mv -f -- "$temporary" "$destination"
trap - EXIT
find "$BACKUP_DIR" -type f -name '*.dump.gpg' -mtime "+$RETENTION_DAYS" -delete
bytes="$(stat -c '%s' "$destination")"

if "$JSON_OUTPUT"; then
  printf '{"ok":true,"file":"%s","bytes":%s}\n' "$destination" "$bytes"
else
  printf 'backup=%s bytes=%s\n' "$destination" "$bytes"
fi
