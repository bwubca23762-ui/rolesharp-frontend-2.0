# RoleSharp — Deployment Handoff

**Date:** 2026-08-12
**Release candidate:** `1b1f33d` (branch `deploy/restore-infra`)
**Target:** `rolesharp.com` — `root@<origin-ip>`, `/opt/resume-ai`
**Status:** ⚠️ **NOT DEPLOYED — blocked, requires you to run it**

---

## Why I could not deploy

Three hard blockers, verified rather than assumed:

| Check | Result |
|---|---|
| SSH key `/root/.ssh/rolesharp_vps_20260729` | **Permission denied** — not present in this environment |
| TCP reachability to `<origin-ip>:22` | **Network is unreachable** |
| Working tree is your real repo? | **No** — this is the copy at `D:\Istak\Messages App\rolesharp` |

`deploy.sh` rsyncs **`./`** — the current directory. Even with credentials, running it
from here would ship a copy rather than your working tree at `D:\CodexWork\rolesharp`.

There is also a judgement blocker independent of access. This script, in one run:

- executes **all 26 migrations** against the live production database
- restarts six systemd units
- rewrites `/etc/nginx/sites-available/rolesharp` and reloads nginx
- purges the entire Cloudflare cache

That is a consequential, irreversible-in-parts operation on a live product. It should
be launched by a person who can watch it and react — not fired off by an agent.

**A fourth risk you should weigh:** the six test suites have still never run
(esbuild platform mismatch, see the audit). Nothing in this release candidate has
automated test coverage backing it.

---

## What is being shipped

Four commits, 29 files, +1,855 / −36.

```
1b1f33d  Update progress log with audit fixes and structure cleanup
fd52928  Move retained reports into docs/reports; ignore outputs scratch dir
548f118  Fix typecheck, default to light theme, reorganize docs
fda389a  Add release tooling, worker services and line-ending policy
```

### Risk classification

| Change | Files | Risk | Note |
|---|---|---|---|
| Doc moves, new reports | 16 | **None** | rsync'd but never executed |
| `tsconfig` / `.gitignore` | 3 | **None** | build-time only, `next build` unaffected |
| **Light theme default** | `app/layout.tsx`, `app/theme-toggle.tsx` | **Low — user-visible** | every visitor without a stored preference sees light instead of dark |
| **`deploy.sh` rewrite** | +177 lines | **HIGH** | changes the deploy process itself |
| **3 new systemd units** | recommendation-agent, auto-apply-agent, blog-worker | **HIGH** | new always-on services |
| **4 new release scripts** | verify / smoke / rollback / schema-digest | **Medium** | run during deploy; failure aborts it |

**The theme change is the only thing users will notice. The infrastructure changes
carry all the actual risk** — and they arrived in commit `fda389a`, which was the
uncommitted work I rescued. It has never been deployed or exercised on the VPS.

> Read that again before you run this. You are deploying a **rewritten deploy
> script plus three new services simultaneously** — the script that would roll you
> back is itself part of the change.

---

## Preflight — verified locally ✅

Everything `deploy.sh` installs exists in the tree:

```
✅ deploy/resume-web.service                     ✅ deploy/cloudflare-real-ip.conf
✅ deploy/resume-worker.service                  ✅ deploy/nginx-site.conf
✅ deploy/rolesharp-jobs.service                 ✅ scripts/verify-jobs-release.sh
✅ deploy/rolesharp-recommendation-agent.service ✅ scripts/run-jobs-smoke.sh
✅ deploy/rolesharp-auto-apply-agent.service     ✅ scripts/schema-digest.ts
✅ deploy/rolesharp-blog-worker.service          ✅ requirements-jobs.txt
✅ db/schema.sql                                 ✅ 26 migrations, 001 → 026, no gaps
```

- `tsc --noEmit` → **0 errors**
- `git fsck` → clean · working tree clean · 414 files tracked

**Not verified — needs the VPS:** `.env` contents, `SITE_URL`, feature-flag state,
Postgres readiness, disk space. `deploy.sh` checks all of these itself and aborts
before touching anything if they fail. Those guards are good; let them do their job.

---

## Steps

### 1 — Sync the commits back to your working tree

They exist **only** in the copy right now.

```bash
cd D:\CodexWork\rolesharp
git remote add cowork "D:/Istak/Messages App/rolesharp"
git fetch cowork deploy/restore-infra
git log --oneline HEAD..cowork/deploy/restore-infra   # review before merging
git merge --ff-only cowork/deploy/restore-infra
git remote remove cowork
```

If `--ff-only` is rejected, your working tree has commits the copy doesn't.
**Stop and reconcile manually — do not force.**

### 2 — Restore the toolchain and actually run the tests

Required regardless — `node_modules` currently holds Windows binaries.

```bash
npm ci
npm run typecheck
npm run test:security
npm run test:frontend
npm run test:ats
npm run test:seo
npm run test:internship-reports
```

**This is the first real test run in this whole effort.** If anything fails here,
stop and fix before deploying — do not treat red tests as noise.

### 3 — Push to origin

```bash
git push -u origin deploy/restore-infra
```

`deploy/restore-infra` has no upstream. Push before deploying so a rollback target
exists somewhere other than one Windows disk.

### 4 — Deploy

```bash
export ROLESHARP_SSH_KEY=/path/to/rolesharp_vps_20260729
bash deploy.sh 2>&1 | tee deploy-$(date +%Y%m%d-%H%M%S).log
```

Run it from a machine with the key and network access, **in a session you are
watching**. Keep the log — it is your post-mortem if anything misbehaves.

The script gates itself, in order: env validation → Postgres ready → feature flags
off → isolated release build → **verified pre-migration backup** → migrations →
no-op rerun proof → fake-provider smoke → atomic symlink activation with automatic
rollback → health checks → sitemap validation → anonymous `/api/jobs` must stay
blocked → daily backup cron.

If activation fails it restores the previous release symlink, disables the three new
agents, and restarts the old services on its own.

### 5 — Verify by hand afterwards

```bash
ssh -i $ROLESHARP_SSH_KEY root@<origin-ip> \
  'systemctl is-active resume-web resume-worker rolesharp-jobs \
     rolesharp-recommendation-agent rolesharp-auto-apply-agent rolesharp-blog-worker'

curl -sS -o /dev/null -w '%{http_code}\n' https://rolesharp.com/
```

Then open the site in a **private window** and confirm the theme change: with no
stored preference it should follow your OS setting, defaulting to **light**. This
is the only visitor-facing change in the release.

---

## Rollback

Automatic on activation failure. Manual, if something surfaces later:

```bash
ssh -i $ROLESHARP_SSH_KEY root@<origin-ip>
ls -1 /opt/resume-ai/releases | sort | tail -5
ln -sfn /opt/resume-ai/releases/<PREVIOUS_ID> /opt/resume-ai/current.next
mv -Tf /opt/resume-ai/current.next /opt/resume-ai/current
systemctl disable --now rolesharp-recommendation-agent \
  rolesharp-auto-apply-agent rolesharp-blog-worker
systemctl restart resume-web resume-worker rolesharp-jobs
```

Disabling the three new agents matters — the previous release does not contain their
scripts, and leaving the units enabled sends them into a restart loop.

**Database rollback is separate and harder.** Migrations are forward-only. The
pre-migration dump is written to
`/opt/resume-ai/data/backups/resumeai-pre-<RELEASE_ID>.dump` and verified with
`pg_restore -l` before migrations run — that dump is your only path back. This is
exactly the open audit item *"encrypted off-host backups + verified restore"*: the
backup exists and is integrity-checked, but it **sits on the same host**, and the
restore procedure has never been rehearsed.

---

## Recommendation

Split it. The two risk profiles do not belong in one deploy:

1. **First** — theme + tsconfig + docs. User-visible but trivially reversible.
2. **Then**, separately, once the first is stable — the rewritten `deploy.sh`,
   the three new agents, and the release scripts.

Shipping a new deploy script and three new always-on services in the same run as a
UI change means that if the site misbehaves afterward, you will not know which half
caused it. Landing them separately costs one extra deploy and buys you a clean
bisect.

If you would rather ship it all at once, do it when you have an hour to watch, not
at end of day.
