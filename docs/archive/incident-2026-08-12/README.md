> Historical incident record. These SQL files are superseded by the migrations. Do not run them against a current deployment.

# 2026-08-12 student-flow incident

Migration 048 half-applied to production during a failed deploy on 2026-08-12,
leaving constraints and triggers live that the release actually serving
(`20260804094521-813`, Aug 4) could not satisfy. Every student verification and
every student claim was failing.

Run order, all against production `resumeai`:

| file | when | state |
|---|---|---|
| `01-stopgap-applied.sql` | applied 2026-08-12 ~16:25 UTC | **live in production** |
| `02-stopgap-revert.sql` | **after** the new release is serving | **not yet run** |
| `03-verify-student-flow.sql` | any time; rolls itself back | read-only proof |

`01` defaults the five offer-pin columns on `student_verification_tokens` and
`student_claims` to the published `student_premium` v1 row, so the old code's
INSERTs satisfy the NOT NULL, both composite FKs and the digest CHECK that 048
added.

**`02` must be run once the new release is live.** Leaving the defaults in place
would let future code silently pin new rows to v1, which is exactly the integrity
hole 048 exists to close.

`03` exercises the four live paths (token insert, claim insert, cron stamp,
unsubscribe) inside a transaction it rolls back itself.

Invoke through the deploy key, e.g.:

```bash
wsl -e bash -lc 'cd "/mnt/d/Istak/Messages App/rolesharp" && B64=$(base64 -w0 docs/archive/incident-2026-08-12/02-stopgap-revert.sql) && ssh -i ~/.ssh/rolesharp_deploy_key -o IdentitiesOnly=yes root@<origin-ip> "echo $B64 | base64 -d | docker exec -i resume-pg psql -U postgres -d resumeai -v ON_ERROR_STOP=1"'
```
