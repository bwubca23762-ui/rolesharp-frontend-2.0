#!/usr/bin/env bash
# Restart the web service when it stops answering.
#
# systemd's Restart=always only reacts to the process *exiting*. The failure
# mode this exists for is the opposite one: the process alive and perfectly
# healthy as far as systemd is concerned, while every request hangs. That is
# precisely what an unbounded Redis command did before redisDeadline() bounded
# it -- /api/roles and /api/companies/search never returned in 90s and systemd
# saw nothing wrong, because nothing had crashed.
#
# Deliberately dumb: three probes, a cooldown, restart. No escalation, no
# alerting, no partial degradation logic. It runs as root from a timer, so the
# blast radius of a bug in here is a restart loop, which the cooldown bounds.
set -uo pipefail

URL="${WATCHDOG_URL:-http://127.0.0.1:3000/api/health}"
UNIT="${WATCHDOG_UNIT:-resume-web}"
ATTEMPTS="${WATCHDOG_ATTEMPTS:-3}"
TIMEOUT="${WATCHDOG_TIMEOUT:-10}"
GAP="${WATCHDOG_GAP:-5}"
COOLDOWN="${WATCHDOG_COOLDOWN:-600}"
STATE="${WATCHDOG_STATE:-/run/rolesharp-watchdog.last-restart}"

now="$(date +%s)"
rc=0

# Web: probe, then restart on repeated failure. Wrapped in a function so that a
# healthy web service falls through to the worker check below instead of
# exiting the script — when this was a bare `exit 0`, the worker was only ever
# checked on the runs where the website was ALSO down, i.e. almost never.
check_web() {
  for attempt in $(seq 1 "$ATTEMPTS"); do
    if curl -fsS -m "$TIMEOUT" -o /dev/null "$URL"; then
      return 0
    fi
    echo "health probe $attempt/$ATTEMPTS failed (${URL}, ${TIMEOUT}s timeout)" >&2
    [ "$attempt" -lt "$ATTEMPTS" ] && sleep "$GAP"
  done

  last="$(cat "$STATE" 2>/dev/null || echo 0)"
  case "$last" in ''|*[!0-9]*) last=0 ;; esac

  # A service that is crash-looping restarts itself far faster than this timer
  # can help with, and restarting into the same broken state repeatedly
  # destroys the evidence. One restart per cooldown window, then leave it alone
  # and let the alert be the fact that the site is still down.
  if [ "$((now - last))" -lt "$COOLDOWN" ]; then
    echo "$UNIT unhealthy, but it was restarted $((now - last))s ago (cooldown ${COOLDOWN}s); leaving it alone" >&2
    return 1
  fi

  echo "$now" > "$STATE"
  echo "$UNIT failed $ATTEMPTS consecutive health probes; restarting" >&2
  systemctl restart "$UNIT"
  return 0
}

check_web || rc=1

# ---------------------------------------------------------------------------
# Worker liveness.
#
# Everything above probes the web service only, which left the workers — the
# things that actually spend credits and send mail — with no check at all. They
# have no HTTP endpoint to probe, so the equivalent signal is the heartbeat key
# worker/index.ts refreshes every 30s with a 120s TTL. A wedged event loop stops
# refreshing it, the key expires, and its absence is the failure.
#
# Skipped entirely, never restarting anything, if redis-cli is unreachable: a
# watchdog that cannot tell "worker is wedged" from "I cannot see Redis" would
# restart a healthy worker every time Redis blipped.
WORKER_UNIT="${WATCHDOG_WORKER_UNIT:-resume-worker}"
WORKER_KEY="${WATCHDOG_WORKER_KEY:-worker:resume:heartbeat}"
WORKER_STATE="${WATCHDOG_WORKER_STATE:-/run/rolesharp-watchdog.last-worker-restart}"
# Set WATCHDOG_REDIS_CLI to e.g. "docker exec resume-redis redis-cli" when Redis
# runs in a container, matching how deploy.sh reaches Postgres.
REDIS_CLI="${WATCHDOG_REDIS_CLI:-redis-cli}"

check_worker() {
  if ! $REDIS_CLI PING >/dev/null 2>&1; then
    echo "worker check skipped: redis unreachable via '$REDIS_CLI'" >&2
    return 0
  fi

  if [ "$($REDIS_CLI EXISTS "$WORKER_KEY" 2>/dev/null)" = "1" ]; then
    return 0
  fi

# systemd already restarts a worker that exited. If the unit is not even
# running, that is its job, not ours — say so rather than fighting it.
  if ! systemctl is-active --quiet "$WORKER_UNIT"; then
    echo "$WORKER_UNIT is not active; leaving it to systemd Restart=always" >&2
    return 1
  fi

  worker_last="$(cat "$WORKER_STATE" 2>/dev/null || echo 0)"
  case "$worker_last" in ''|*[!0-9]*) worker_last=0 ;; esac
  if [ "$((now - worker_last))" -lt "$COOLDOWN" ]; then
    echo "$WORKER_UNIT heartbeat stale, but it was restarted $((now - worker_last))s ago (cooldown ${COOLDOWN}s); leaving it alone" >&2
    return 1
  fi

  echo "$now" > "$WORKER_STATE"
  echo "$WORKER_UNIT is running but its heartbeat ($WORKER_KEY) has expired; restarting" >&2
  systemctl restart "$WORKER_UNIT"
}

check_worker || rc=1
exit "$rc"
