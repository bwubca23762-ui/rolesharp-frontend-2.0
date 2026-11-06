# Jobs workflows rollback and reconciliation

1. Set all four Jobs workflow flags to false and verify their persisted hashes.
2. Stop the Recommendation Agent first, then stop the Auto-Apply Agent. Allow their configured 75-second drains inside the 90-second systemd timeout.
3. Mark abandoned application and digest rows that crossed their durable sending boundary `unknown`; never retry or label them accepted.
4. Cancel pre-boundary queued/reserved work and run projection-only reconciliation for tracker/admin views.
5. Atomically repoint `/opt/resume-ai/current` to the prior build that is compatible with the expanded schema.
6. Restart the web process and existing non-Jobs worker, verify both health endpoints, and prove the Jobs workers make zero claims/provider calls while flags are off.
7. Retain the expanded schema. Do not run destructive schema downgrade or restore in production. A destructive database restore is staging-only and requires a separately verified backup.

An isolated fake smoke database/prefix/sink must be cleaned independently. Validate the exact database name, Redis prefix, sink directory, and process IDs before removal; then assert no smoke database, keys, sink files, or processes remain.

The committed rollback helper is read-only unless both an exact prior release ID and `--execute` are supplied:

```text
bash scripts/rollback-jobs-release.sh --target-release YYYYMMDDhhmmss-PID --execute
```

It first reruns flags-off release verification, stops the Recommendation Agent before the Auto-Apply Agent, invokes guarded reconciliation, atomically changes the release symlink, and restarts only the web, existing resume worker, and ingestion service. It deliberately retains the expanded database schema and leaves both Jobs workflow agents stopped.
