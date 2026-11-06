# Bulk mail setup — the SES path

Transactional mail (email verification, receipts, contact replies) stays on
the Cloudflare Email transport with its own **200/day** account quota — that
number is Cloudflare's, verified via their `/email/sending/limits` endpoint,
and `EMAIL_DAILY_LIMIT=200` in `.env` mirrors it. It must never carry bulk
streams: a day of 900 job alerts would leave nothing for signup verification.

Bulk streams — **job alerts today, Daily Matches (E5) next** — send through
the numbered SMTP pool in `lib/bulk-mail.ts`. Redis stores only the
per-account daily counters (`mail:bulk:{n}:{utc-day}`); one Redis connection
serves the whole pool. The 200/day ceiling lives on the provider account, not
in Redis — that is why extra Redis accounts could never have raised it.

**Owner decision (2026-09-16): Amazon SES is THE bulk transport.** The
earlier three-Brevo-free-accounts plan was superseded: the AWS account came
with a $100 credit (SES at ~27k/mo ≈ $2.70 of that credit — years of free
sending), and Brevo free-tier tripling carried ToS risk plus triple DKIM
setup under a `p=reject` DMARC. Brevo remains viable as an *additional* pool
slot later, nothing more.

## 1. AWS account (done, with one open gate)

- Account `524320818023` (Soul91), region **ap-south-1 (Mumbai)**.
- Pricing: **à la carte** ($0.10/1k). VDM / engagement tracking / optimized
  shared delivery / auto-validation / dedicated IPs / tenants: ALL DISABLED —
  they bill per use on à la carte and are not wanted.
- Domain identity `rolesharp.com` created: Easy DKIM RSA_2048, custom MAIL
  FROM `mail.rolesharp.com` (fix the doubled `mail.rolesharp.com.rolesharp.com`
  typo if you ever recreate the identity), MX-failure behavior "use default".
- DNS (Cloudflare, all grey-cloud): 3 DKIM CNAMEs
  (`aywysmx6ziyh2anzrx6qsq44b46gjwul._domainkey`, `dsb2azoawxaps5effqwz2srygxzolivg._domainkey`,
  `tgnqwdmws55w4kztjkwnmgwt5phjusvo._domainkey` → `*.dkim.amazonses.com`),
  MX `mail.rolesharp.com` → `feedback-smtp.ap-south-1.amazonses.com` (prio 10),
  TXT `mail.rolesharp.com` → `v=spf1 include:amazonses.com ~all`.
  Root SPF/MX belong to Cloudflare Email Routing — untouched. Root DMARC is
  `v=DMARC1; p=reject;` — SES mail passes it via DKIM alignment; do not add a
  second `_dmarc` record.
- **BLOCKED as of 2026-09-16**: AWS placed the account on hold pending KYC
  (CERT-In). Documents uploaded once (one file rejected), upload link expired,
  Support case filed for a fresh link. Until verification clears: no
  production access, no sending.

## 2. After the AWS hold lifts — the exact remaining clicks

1. **Account dashboard → Request production access** — Mail type:
   Transactional · website `https://rolesharp.com` · use case: "RoleSharp
   sends opt-in job-alert emails that users configure themselves. Every email
   carries a one-click unsubscribe link. Volume will ramp gradually to
   ~1,000/day. Bounces and complaints are monitored." (~24h approval)
2. **SMTP settings → Create SMTP credentials** → the username + password.
3. **Budget guard**: Billing → Budgets → monthly cost budget **$5**, email
   alerts at 80%/100% (budgets alert; they do not hard-stop — at our volume
   the $100 credit makes the real bill $0 for years).
4. **Quota**: production starts at 200/day and rises automatically with clean
   bounce/complaint rates. File **Service Quotas → Amazon SES → Daily sending
   quota → 1,000/day** to accelerate; approval tracks reputation.
5. Add to `/opt/resume-ai/.env` as **slot 1** (the pool takes `BULK_SMTP_1..10_*`):

```
BULK_DAILY_LIMIT=300
BULK_SMTP_1_HOST=email-smtp.ap-south-1.amazonaws.com
BULK_SMTP_1_PORT=587
BULK_SMTP_1_SECURE=false
BULK_SMTP_1_USER=<SES SMTP username>
BULK_SMTP_1_PASS=<SES SMTP password>
BULK_SMTP_1_FROM="RoleSharp <alerts@rolesharp.com>"
```

6. `sudo systemctl restart resume-worker resume-web`.
7. Verify: first sends show `transport='bulk:1'` in
   `email_log` (`select transport, status, count(*) from email_log group by
   1,2;`), counters in Redis (`docker exec resume-redis redis-cli --scan
   --pattern 'mail:bulk:*'`), SES → Sending statistics for bounce/complaint
   rates (keep bounces < 10%).

## 3. How the pool behaves (transport-agnostic)

- **Rotation**: least-used account first (ties by index). With one slot it is
  trivially that slot; adding Brevo or another SES region later is env-only.
- **Budgets**: each slot gets `BULK_DAILY_LIMIT` (default 300) per UTC day,
  counted in Redis with the same midnight-expiry pattern as the transactional
  counter.
- **Failure isolation**: a provider error on one slot logs
  `email_log.status='failed'` with `transport='bulk:N'` and the mail moves to
  the next slot. When every slot is exhausted the worker ends its tick
  (`BulkBudgetExhaustedError`) and resumes on the next tick/day —
  `job_alerts.last_sent_at` only advances on success, nothing is lost.
- **No fallback to the legacy `SMTP_*` relay**: production carries
  `SMTP_HOST=127.0.0.1` for the legacy local relay, and a silent fallback
  would have flipped alerts onto local Postfix on day one (pinned by test).
- **Throughput shape**: the job-alerts worker ticks every 30 minutes and
  picks up to 100 due alerts per tick — 900/day drains across ~9 ticks
  (~4.5h of deliberate spread, which bulk senders want).

## 4. Adding Brevo later (optional extra slot, not the plan)

A Brevo free account is 300/day and needs domain authentication BEFORE use —
the root DMARC is `p=reject`, so unauthenticated Brevo mail is rejected by
receivers. Add its DKIM/SPF records to Cloudflare (SPF is one record per
domain — merge includes; if two accounts propose the same DKIM selector,
authenticate the second on a subdomain like `b2.rolesharp.com`, which passes
relaxed-alignment DMARC). Then it is just the next numbered slot.
