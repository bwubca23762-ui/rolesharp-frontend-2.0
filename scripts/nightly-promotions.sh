#!/usr/bin/env bash
# Nightly free-promotion drain for the Brevo free slot (owner decision
# 2026-10): every UTC day the quota refreshes and this runs at 00:20 —
# rewards announcement first (finishes, then becomes a no-op), then the
# platform-features tour (reaches every verified user once, then catches new
# signups daily). Both scripts are idempotent and resumable; when nobody new
# remains the pair exits in seconds and the quota simply goes unused rather
# than spamming anyone twice. The transactional budget is untouched —
# verification and Daily Matches mail keep their own lane.
set -u
cd /opt/resume-ai/current || exit 1
set -a
. /opt/resume-ai/.env
set +a
LOG=/var/log/social-announce.log
{
  echo "=== nightly promotions $(date -u +%FT%TZ) ==="
  node --import tsx scripts/mail-social-announce.ts 2>&1
  node --import tsx scripts/mail-platform-features.ts 2>&1
} >> "$LOG" 2>&1
