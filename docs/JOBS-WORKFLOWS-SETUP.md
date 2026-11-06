# Jobs workflows: setup and worker boundaries

RoleSharp has two separate workflows: Daily Matches uses the verified RoleSharp account email through the notification transport, while RoleSharp Apply uses one separately connected Gmail or Microsoft sender. Login OAuth, notification delivery, connected-mailbox sending, and manual ATS application are distinct permissions.

## Configuration

Start from `.env.example`. Keep these runtime capabilities disabled by default:

```text
JOBS_WORKFLOWS_ENABLED=false
ROLE_APPLY_GMAIL_SEND_ENABLED=false
ROLE_APPLY_MICROSOFT_SEND_ENABLED=false
```

Production uses `JOB_WORKFLOW_NAMESPACE=production` and `QUEUE_PREFIX=rolesharp:prod:`. Local development uses a non-production namespace and prefix. `MAIL_TOKEN_KEYS` is a comma-separated key ring of `version:base64` entries where every decoded key is exactly 32 bytes. `MAIL_TOKEN_ACTIVE_KEY_VERSION` selects the write key. Never reuse `AUTH_SECRET`, an OAuth client secret, or a deploy key.

`MAIL_CALLBACK_ORIGINS` contains origins only. Every configured redirect URI must use an allowlisted origin; production origins must be HTTPS. Gmail/Microsoft connection credentials must be different OAuth applications from Google login credentials.

## Database and processes

Apply `db/migrations/*.sql` in lexical order with `ON_ERROR_STOP=1`. Migrations are expand-only for this release and are safe to rerun. Then use the exact process boundaries:

```text
npm run worker:recommendation-agent
npm run worker:auto-apply-agent
npm run worker:blog
```

The Recommendation Agent owns the non-overlapping scheduler plus `jobs-match`,
`jobs-digest`, and `notification-outbox`. The Auto-Apply Agent owns only
`application-package` and `mailbox-dispatch`. Both workflow agents drain for up
to 75 seconds on `SIGTERM`; their systemd units therefore use a 90-second stop
timeout. The blog worker remains separate, owns only durable administrative
blog generation, and drains for up to five minutes. The former scheduler,
match, mail, and outbox services are superseded and must remain disabled.

Queue payloads contain durable IDs and a schema version only. Never enqueue job descriptions, profile facts, recipients, message bodies, resume bytes, tokens, authorization codes, or sensitive answers. PostgreSQL is the authoritative claim, retry, quota, cooldown, and receipt ledger.

## Safe local verification

Use only synthetic users, reserved `.test` addresses, in-process provider fakes, and a local notification sink. Network-deny tests must reject unregistered `fetch`, HTTP(S), TCP, and DNS traffic. Do not put `MAIL_ADAPTER=fake` or `NOTIFICATION_TRANSPORT=local_sink` in production configuration.

The disposable smoke runner creates a uniquely named PostgreSQL database, Redis prefix, and sink directory, exercises one digest and one application-email attempt, copies hash-only evidence, then verifies cleanup. Run it only from an environment whose production workflow/provider flags are all `false`:

```text
npm run smoke:jobs -- --evidence /absolute/path/to/redacted-evidence
```

Fake transports additionally require `JOBS_SMOKE_MODE=true` and an exact, mutually consistent smoke run ID, database name, namespace, queue prefix, and sink path. The runner supplies these values; setting only `MAIL_ADAPTER=fake` is insufficient and fails closed.
