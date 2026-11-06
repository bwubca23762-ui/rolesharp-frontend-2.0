# VPS hardening runbook — Phase 5 of docs/SECURITY-REMEDIATION-TODO.md

Host: `<origin-ip>` (rolesharp.com origin), Ubuntu 24.04. Run blocks in order.
Every block ends with a verification — do not continue past a failed check.

**Already automated in `deploy.sh` (runs on next deploy — no manual action):**
`rolesharp` system user creation, hardened `resume-web`/`resume-worker` systemd
units, nginx `cloudflare-real-ip.conf` snippet, `.env` tightened to `root:rolesharp 0640`,
initial `pg_dump` + verified daily backup cron (7-day retention).

This runbook covers what deploy.sh deliberately does NOT touch (SSH, firewall,
OS updates, the Claude proxy, off-host backups) because a mistake there can
lock you out or take the site down.

## 0A. Security remediation deployment prerequisites

Before restarting `resume-web`, use `deploy.sh`: it builds an isolated release,
backs up PostgreSQL, then applies every `db/migrations/*.sql` file in lexical
order with `psql -v ON_ERROR_STOP=1`. Migration `028_role_search_index.sql` is
explicitly non-transactional because it uses `CREATE INDEX CONCURRENTLY`; do not
wrap the migration set in one transaction. The current release also requires
migrations `041_blog_generation_jobs.sql` and `042_schema_validation.sql`, plus
the `rolesharp-blog-worker`, `rolesharp-recommendation-agent`, and
`rolesharp-auto-apply-agent` services. The two workflow agents replace the old
match, mail, outbox, and scheduler units; `deploy.sh` disables those legacy
units before activation. Set a unique Base32 `ADMIN_TOTP_SECRET` in
`/opt/resume-ai/.env` and enroll it in an authenticator app. Production admin
login intentionally fails closed when this secret is absent; do not deploy the
new build first and lock yourself out.

```bash
# Run on the VPS as the deployment user, using the project's migration process.
cd /opt/resume-ai && ./deploy.sh
# Generate a secret locally, transfer it through your password manager, and add
# it to the root-owned environment file (never commit it):
LC_ALL=C tr -dc 'A-Z2-7' </dev/urandom | head -c 32; echo
chmod 640 /opt/resume-ai/.env
systemctl restart resume-web resume-worker rolesharp-blog-worker \
  rolesharp-recommendation-agent rolesharp-auto-apply-agent
systemctl is-active rolesharp-blog-worker rolesharp-recommendation-agent \
  rolesharp-auto-apply-agent # expect: active for all
```

Verify that `/admin` accepts the authenticator code and that a password-reset
request still succeeds. Never paste the TOTP secret into chat, logs, or source.

---

## 0. Preflight — do this from your Mac, keep TWO terminals open

```bash
# Terminal A — stays logged in as root the whole time (your lifeline)
ssh -i /root/.ssh/rolesharp_vps_20260729 root@<origin-ip>

# Terminal B — used to test each change
```

## 1. Create a non-root admin user with your key (before touching SSH config)

```bash
# In Terminal A:
adduser --disabled-password --gecos "" admin
usermod -aG sudo admin
install -d -m 700 -o admin -g admin /home/admin/.ssh
cp /root/.ssh/authorized_keys /home/admin/.ssh/authorized_keys
chown admin:admin /home/admin/.ssh/authorized_keys
chmod 600 /home/admin/.ssh/authorized_keys
echo "admin ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-admin && chmod 440 /etc/sudoers.d/90-admin
```

**Verify (Terminal B) — MUST succeed before step 5:**
```bash
ssh -i /root/.ssh/rolesharp_vps_20260729 admin@<origin-ip> "sudo id"
# expect: uid=0(root) ...
```

## 2. Encrypted, off-host backups + restore test

deploy.sh already creates local dumps. Add encryption + off-host copy + restore proof.

```bash
# In Terminal A — one-time: generate a backup passphrase, STORE IT IN YOUR PASSWORD MANAGER
openssl rand -base64 32 > /root/.backup-passphrase && chmod 600 /root/.backup-passphrase
cat /root/.backup-passphrase   # <— copy this into your password manager NOW

# Encrypting daily cron (replaces the plain-dump cron deploy.sh installed)
(crontab -l 2>/dev/null | grep -v "pg_dump.*resumeai"; \
 echo '0 3 * * * install -d -o rolesharp -g rolesharp -m 0750 /opt/resume-ai/data/backups && docker exec resume-pg pg_dump -Fc -U postgres resumeai | gpg --batch --symmetric --cipher-algo AES256 --passphrase-file /root/.backup-passphrase -o /opt/resume-ai/data/backups/resumeai-$(date +\%Y\%m\%d-\%H\%M).dump.gpg && find /opt/resume-ai/data/backups -name "*.dump.gpg" -mtime +7 -delete') | crontab -

# Run one now and verify it decrypts + restores into a scratch database
docker exec resume-pg pg_dump -Fc -U postgres resumeai | gpg --batch --symmetric --cipher-algo AES256 --passphrase-file /root/.backup-passphrase -o /opt/resume-ai/data/backups/restore-test.dump.gpg
gpg --batch --decrypt --passphrase-file /root/.backup-passphrase /opt/resume-ai/data/backups/restore-test.dump.gpg > /tmp/restore-test.dump
docker exec resume-pg createdb -U postgres restore_test
docker cp /tmp/restore-test.dump resume-pg:/tmp/restore-test.dump
docker exec resume-pg pg_restore -U postgres -d restore_test /tmp/restore-test.dump
docker exec resume-pg psql -U postgres -d restore_test -c "select count(*) from users;"   # expect a real number
docker exec resume-pg dropdb -U postgres restore_test && rm /tmp/restore-test.dump
```

**Off-host copy (run on your MAC, add to your calendar weekly or cron it):**
```bash
mkdir -p ~/Backups/rolesharp
scp -i /root/.ssh/rolesharp_vps_20260729 'root@<origin-ip>:/opt/resume-ai/data/backups/*.dump.gpg' ~/Backups/rolesharp/
```

## 3. Bind the Claude proxy to loopback + dedicated user

```bash
# In Terminal A — find how it's launched:
systemctl status antigravity-claude-proxy 2>/dev/null || grep -rl "antigravity\|8080" /etc/systemd/system/ | head
# Edit its unit: add/replace so it binds 127.0.0.1 (flag or env HOST=127.0.0.1 PORT=8080
# depending on the proxy; check its --help), and add:
#   User=claudeproxy
#   NoNewPrivileges=true
#   PrivateTmp=true
#   ProtectSystem=strict
#   ProtectHome=true
useradd --system --shell /usr/sbin/nologin claudeproxy 2>/dev/null || true
systemctl daemon-reload && systemctl restart antigravity-claude-proxy
```

**Verify:** `ss -tlnp | grep 8080` → must show `127.0.0.1:8080`, not `0.0.0.0:8080`.

## 4. Restrict origin 443 to Cloudflare + OS updates

```bash
# In Terminal A — allow Cloudflare ranges on 443/80, then remove the open rules.
for ip in $(curl -s https://www.cloudflare.com/ips-v4) $(curl -s https://www.cloudflare.com/ips-v6); do
  ufw allow from $ip to any port 443 proto tcp
  ufw allow from $ip to any port 80 proto tcp
done
ufw delete allow 443/tcp 2>/dev/null; ufw delete allow 80/tcp 2>/dev/null
ufw delete allow "Nginx Full" 2>/dev/null
ufw status numbered | head -30

# OS updates (site will briefly restart if the kernel updates → reboot)
apt-get update && apt-get upgrade -y
[ -f /var/run/reboot-required ] && echo "REBOOT REQUIRED — reboot in a low-traffic window: reboot"
```

**Verify:** `curl -sI https://rolesharp.com | head -1` → 200 (via Cloudflare works);
`curl -skI https://<origin-ip> --max-time 5` → should now TIME OUT (direct origin blocked).

## 5. SSH lockdown — LAST, only after step 1's verify passed

```bash
# In Terminal A:
printf 'PermitRootLogin no\nPasswordAuthentication no\nKbdInteractiveAuthentication no\n' > /etc/ssh/sshd_config.d/99-hardening.conf
sshd -t && systemctl reload ssh
```

**Verify (Terminal B) — while Terminal A stays open:**
```bash
ssh -i /root/.ssh/rolesharp_vps_20260729 admin@<origin-ip> "sudo systemctl is-active resume-web"   # expect: active
ssh root@<origin-ip> -o PreferredAuthentications=password -o PubkeyAuthentication=no 2>&1 | head -1   # expect: Permission denied
```
If Terminal B cannot log in as admin, revert in Terminal A:
`rm /etc/ssh/sshd_config.d/99-hardening.conf && systemctl reload ssh`

## 6. Remove global TLS 1.0/1.1 defaults

```bash
# In Terminal A:
sed -i 's/ssl_protocols.*/ssl_protocols TLSv1.2 TLSv1.3;/' /etc/nginx/nginx.conf
nginx -t && systemctl reload nginx
```

**Verify:** `grep ssl_protocols /etc/nginx/nginx.conf` → only TLSv1.2 TLSv1.3.

## 7. Final full verification

```bash
# In Terminal A (or as admin via sudo):
systemctl is-active resume-web resume-worker rolesharp-jobs nginx \
  rolesharp-recommendation-agent rolesharp-auto-apply-agent rolesharp-blog-worker # all: active
ss -tlnp | grep -E "3000|8080|5432|6379"                                  # all on 127.0.0.1
ufw status | head -20                                                     # 443/80 = CF ranges only, 22 = allowed
ls -la /opt/resume-ai/data/backups/ | tail -3                             # encrypted .dump.gpg present
curl -sI https://rolesharp.com | head -1                                  # HTTP/2 200
```

Then run a normal `./deploy.sh` from the Mac so the new systemd units + nginx
snippet + rolesharp user take effect, and confirm the site serves and the
worker processes a test generation.

## 8. Verification scope and remaining release gates

Repository-only verification is not a substitute for exercising the durable
workflows against the deployment services. Before enabling any workflow flag in
production, record evidence for all three layers below.

### Local/repository gates

- `npm test`, `npm run typecheck`, `npm run lint`, and a production `npm run build` must pass.
- `npm audit --omit=dev` must report zero production vulnerabilities.
- `npm run audit:search`, `npm run audit:ui`, and `git diff --check` must pass.
- CSS audit candidates are review-only because runtime-generated class names can
  look unused to static analysis; do not delete them without route coverage.

### PostgreSQL, Redis, and BullMQ integration gates

Run the destructive database harness only against a disposable database. It
resets the `public` schema and therefore intentionally refuses to start unless
both opt-in values are present:

```bash
DB_INTEGRITY_TEST=true \
DATABASE_URL='postgresql://.../disposable_rolesharp_test' \
npm run test:db
```

Use a PostgreSQL build with `pgcrypto`, and normally `pgvector`, available. The
harness verifies fresh and legacy migration paths, migration idempotency,
foreign keys, timezone constraints, deletion serialization, ownership,
idempotent credits, delivery/payment recovery, OAuth replay protection, daily
caps, retry/unknown provider outcomes, and workflow state transitions. Run the
jobs smoke test with a disposable Redis namespace to verify PostgreSQL/BullMQ
reconciliation and worker recovery. The repository CI provisions PostgreSQL 16
with pgvector and Redis 7, runs `npm run test:db`, and then exercises all route
methods against the production build. A release is not fully integration-verified
until that CI job and any required jobs-smoke evidence are retained.

### Live infrastructure gates

Repository work does not prove the state of the VPS, Cloudflare, systemd,
PostgreSQL, Redis, SMTP, OAuth applications, NOWPayments, firewall, SSH, or
backups. These require owner credentials and explicit approval. Do not infer
completion from a successful application build. Verify and retain evidence for:

- Encrypted off-host backup age and a completed restore drill.
- Non-root key-based SSH access before disabling root/password login.
- Cloudflare-only origin ingress and a blocked direct-origin request.
- Applied OS security updates and any required reboot.
- Active web and worker services, including `rolesharp-blog-worker`,
  `rolesharp-recommendation-agent`, and `rolesharp-auto-apply-agent`; confirm the
  four superseded workflow units are disabled.
- Authenticated readiness, queue age, expired leases, worker drain failures,
  PostgreSQL pool errors, Redis connectivity, and backup-age alerts.
- Test-mode provider transactions and webhook reconciliation before enabling
  payment or connected-mailbox features.

If any integration or live gate is unavailable, record it as **not run**, not as
passed, and keep the affected feature flag disabled.

## Record completion

Update `docs/SECURITY-REMEDIATION-TODO.md` Phase 5 checkboxes and append the
command outputs from step 7 under "Completion evidence". Include the CI evidence
for section 8, and leave unavailable integration or live gates explicitly open.
