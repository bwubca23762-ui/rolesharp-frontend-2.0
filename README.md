# RoleSharp

RoleSharp is a Next.js resume and job-search application backed by PostgreSQL, Redis, and isolated workers.

## Local setup

1. Copy `.env.example` to `.env.local` and provide local PostgreSQL, Redis, and authentication values.
2. Leave all Jobs workflow and provider-send flags `false` unless you are running an isolated fake-provider test namespace.
3. Run database migrations in filename order.
4. Install and verify with `npm ci`, `npm run check`, `npm test`, `npm run test:db`, and `npm run build`.
5. Start the web process with `npm run dev`. Jobs workers and their exact queue allowlists are documented separately.

`npm run qa:jobs` runs the production-build browser suite plus desktop/mobile Lighthouse. Deployment verification also provides `verify:jobs:f1` through `verify:jobs:f4`; these gates require fresh release flags-off and isolated-smoke evidence where applicable and never enable a production capability.

Never use production mailbox credentials or real recipients in tests. RoleSharp Apply sends application email only for explicit posting-backed recipients; it does not automate ATS or job-board forms.

## System documentation

- [What changed and what to do next](ROLESHARP-PROGRESS.md) — read the top block first
- [Complete architecture map](docs/ARCHITECTURE.md)
- [Design system](DESIGN.md), and [the current visual layer on top of it](REDESIGN-SPEC.md)
- [Security policy](SECURITY.md)

Anything under `docs/reports/`, `docs/archive/`, `audits/`, or with a date in its
filename is historical evidence, not current guidance.

## Jobs workflow documentation

- [Setup and worker boundaries](docs/JOBS-WORKFLOWS-SETUP.md)
- [Google OAuth verification](docs/GOOGLE-MAILBOX-VERIFICATION.md)
- [Microsoft app registration](docs/MICROSOFT-MAILBOX-REGISTRATION.md)
- [Operations and incident response](docs/JOBS-WORKFLOWS-RUNBOOK.md)
- [Rollback and reconciliation](docs/JOBS-WORKFLOWS-ROLLBACK.md)

## Local Frontend 2.0 review

Install dependencies with `npm ci` and ensure PostgreSQL 17 tools are available (set `PG_BIN` to the directory containing `initdb`, `pg_ctl` and `psql` if needed). Run `npm run preview:frontend` and open `http://127.0.0.1:34110/dev/frontend-review`.

Use **Demo sign-in** and the fictional credentials printed by the launcher. The prototype checker, Studio, jobs, workspace and tracker use the application's APIs directly. Choose a template, edit and review your evidence, generate a saved resume, or update an application stage and reload to check persistence. The local server creates a disposable, seeded PostgreSQL database. Resume generation uses the built-in local tailor and saves results to that database. Restarting the launcher resets the sample workspace.

The preview binds to loopback. Live integrations such as mail, payment, and job submission are outside this demo.
