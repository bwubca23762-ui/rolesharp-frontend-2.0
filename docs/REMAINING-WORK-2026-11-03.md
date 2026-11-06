# Remaining-work follow-up — 3 November 2026

Deployment was paused at the owner's request. No production configuration, account, publication, or deployment was changed in this pass.

## Functional fixes verified with a real database

A disposable local PostgreSQL 17 database was initialized with `db/schema.sql` and all migrations through 076. A separate local Next server exercised the actual handlers using synthetic users and a seeded named staff session. No production data was copied. No workers or external providers ran.

The 47-request integration run verified:

- User ID lookup and named staff session resolution.
- Credit subtraction at the zero floor, subsequent additions and ledger accuracy. Fixed a bug where subtracting 10 from a balance of 3 recorded -10 instead of -3. The balance is locked and the applied delta is calculated inside the transaction.
- Feature approval, suspension, restoration and revocation with persisted state and four audit events.
- Support replies, resolution and reopening.
- Internship report approval, rejection, pending state and deletion. Fixed duplicate/misattributed moderation audit records; each tested operation has one attributed record containing the report ID.
- Usage-limit changes and reset.
- Legal draft creation/editing, publication and rejection of edits after publication.
- Offer draft creation/editing and publication. Fixed a real HTTP 500: JS canonical JSON hashes differed from PostgreSQL's `offer_terms_digest`, so the database rejected writes. Both create and update now use the existing database digest function; no migration is needed.
- Student extension, revocation, release and repeat claim compatibility. Two claims retain two immutable grant receipts after release; no historical grant is deleted.
- Notification draft creation/editing and publication.
- Communication preview, draft editing, activation, pause, resume and cancellation. No recipients were admitted and no messages were sent.
- Staff invitation, role assignment/removal and account revocation. External Google OAuth is not simulated by this seeded session.

Reproduce on macOS with PostgreSQL 17 and pgvector installed:

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin bash scripts/run-admin-write-smoke.sh
```

The runner uses loopback ports 54381 and 34105, creates its own temporary database cluster, and stops/removes it on exit. It saves evidence under `.omo/evidence/admin-write-smoke/`. It never connects to the production database. The HTTP fixture identity check prevents mutations if the server is connected to a different database.

## Admin controls and frontend cleanup

- Recovery-admin sessions no longer show Approve/Restore or approval-cap controls that require a named staff account. Suspend/Revoke remain available, matching backend policy. Browser regression tests cover this and the existing failed-confirmation recovery.
- Auto Apply renders the same three FAQ questions and answers used in its structured data.
- Social Rewards is included in the static sitemap.
- Footer links expose the job-search guide, keyword report and personal portfolio page.
- Shortened 18 descriptions and seven titles flagged by the prior search audit; retained access requirements and removed an unsupported watermark claim from the humanizer metadata.
- Added the missing Open Graph type on nine tool pages and a page-specific Open Graph URL for Social Rewards.
- The role page previously reported missing in the database-free scan, `/roles/data-analyst`, returns HTTP 200 in production. Company/role sitemap coverage depends on actual database evidence and should not be filled with invented local records.

## Verification and limits

All 664 unit tests pass. TypeScript and ESLint pass. Both targeted admin browser tests pass. The fresh 47-request database run passes and its cluster/server are cleaned up.

The prior live admin read audit and 28-test browser run remain documented in `ADMIN-VERIFICATION-2026-11-03.md`. These new writes were tested locally, not on customer accounts.

Production delivery through email providers, payment settlement, Google OAuth, infrastructure operations (restart/backup), every role combination, and every possible data state are not certified by these tests. Razorpay remains deferred. Private/no-store responses are intentionally not changed merely to silence a search-audit recommendation.

All changes remain local. Deploy only after the release build and final checks are recorded below.

## Final checks

- Production build: passed after the final metadata changes (290 static pages generated).
- Search audit: 256 pages; no remaining title/description length, Open Graph, FAQ visibility or orphan-navigation findings. Remaining findings are 33 private-cache recommendations, 22 database-dependent company sitemap entries, and the local database-free role link (verified HTTP 200 in production). The audit's overall boolean remains false; it is not represented as a blanket pass.
- Final search evidence: `.omo/evidence/remaining-work/search-final/summary.json`.
- Unit, type/lint, browser and build logs: `.omo/evidence/remaining-work/`.
- `git diff --check`: passed. Generated `next-env.d.ts` is unchanged from Git.
- Disposable local server/database processes exited and their temporary cluster was removed.

This completes this repair and verification pass. External-provider and infrastructure operations listed above remain outside its verified coverage. Production is unchanged and deployment remains paused.
